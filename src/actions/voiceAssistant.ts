"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/jwt";
import { revalidatePath } from "next/cache";
import { parseIntent, generateSpeechResponse, ParsedIntent } from "@/lib/gemini";

// Helper Jarak Levenshtein untuk pencocokan kata fonetis
function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = [];
  let i, j;
  for (i = 0; i <= a.length; i++) {
    tmp[i] = [i];
  }
  for (j = 0; j <= b.length; j++) {
    tmp[0][j] = j;
  }
  for (i = 1; i <= a.length; i++) {
    for (j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return tmp[a.length][b.length];
}

// Pencocokan Nama Karyawan dengan toleransi ejaan
function findClosestEmployee(query: string, employees: { id: string; name: string }[]): { id: string; name: string } | null {
  const normalize = (s: string) => s.toLowerCase().replace(/y/g, "i").replace(/[^a-z]/g, "");
  const normalizedQuery = normalize(query);
  let bestMatch: { id: string; name: string } | null = null;
  let highestSimilarity = 0;

  for (const emp of employees) {
    const empName = emp.name.toLowerCase();
    const normalizedName = normalize(empName);

    if (normalizedQuery.includes(normalizedName) || normalizedName.includes(normalizedQuery)) {
      return emp;
    }

    const queryWords = query.toLowerCase().split(/\s+/);
    for (const word of queryWords) {
      const normalizedWord = normalize(word);
      if (normalizedWord.length < 3) continue;

      const dist = getLevenshteinDistance(normalizedWord, normalizedName);
      const similarity = 1 - dist / Math.max(normalizedWord.length, normalizedName.length);

      if (similarity >= 0.70 && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = emp;
      }
    }
  }
  return bestMatch;
}

// Pencocokan Judul Tugas secara fuzzy berdasarkan kata kunci yang diucapkan
function matchTaskTitle(spokenTitle: string, tasks: { id: string; title: string }[]) {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const normalizedSpoken = normalize(spokenTitle);
  const spokenWords = normalizedSpoken.split(/\s+/).filter(w => w.length > 2);
  
  if (spokenWords.length === 0) return null;

  let bestTask = null;
  let highestScore = 0;

  for (const task of tasks) {
    const taskTitleNormalized = normalize(task.title);
    
    // 1. Pencocokan Substring Langsung
    if (taskTitleNormalized.includes(normalizedSpoken)) {
      return task;
    }

    // 2. Pembobotan Berdasarkan Jumlah Kata yang Terkandung
    let matchCount = 0;
    for (const word of spokenWords) {
      if (taskTitleNormalized.includes(word)) {
        matchCount++;
      } else {
        const taskWords = taskTitleNormalized.split(/\s+/);
        const hasSimilarWord = taskWords.some(tw => getLevenshteinDistance(word, tw) <= 1);
        if (hasSimilarWord) {
          matchCount++;
        }
      }
    }

    const score = matchCount / spokenWords.length;
    if (score > highestScore && score >= 0.5) {
      highestScore = score;
      bestTask = task;
    }
  }
  return bestTask;
}

/**
 * Server Action Utama untuk Memproses Perintah Suara Karyawan & Admin
 */
export async function processVoiceCommand(transcript: string): Promise<{ response: string; error?: string; parsedIntent?: string }> {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi habis. Silakan login kembali.", response: "Sesi Anda telah berakhir, silakan masuk kembali." };
  }

  const query = transcript.toLowerCase().trim();
  const userName = session.name;
  const userId = session.id;
  const isEmployee = session.role === "EMPLOYEE";
  const isAdmin = session.role === "ADMIN";

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

  // ==========================================
  // FALLBACK: SISTEM KATA KUNCI LOKAL (JIKA GEMINI API KEY KOSONG)
  // ==========================================
  if (!process.env.GEMINI_API_KEY) {
    console.warn("GEMINI_API_KEY is not set. Falling back to local keyword parsing.");
    return executeLocalKeywordFallback(query, session, { startOfDay, endOfDay, now });
  }

  // ==========================================
  // JALUR AI: INTEGRASI GEMINI API
  // ==========================================
  try {
    // 1. Parsing Intent & Parameter secara cerdas dengan Gemini
    const parsed: ParsedIntent = await parseIntent(transcript);
    console.log("Gemini parsed intent:", parsed);

    let databaseResult: any = null;
    let actionSuccess = false;

    // 2. Eksekusi Aksi Database Berdasarkan Intent
    switch (parsed.intent) {
      case "COMPLETE_TASK": {
        // Cari karyawan target
        let targetEmployeeId = userId;
        let targetEmployeeName = userName;

        if (isAdmin) {
          const employees = await db.employee.findMany({
            where: { role: "EMPLOYEE" },
            select: { id: true, name: true }
          });
          const matched = parsed.parameters?.employeeName 
            ? findClosestEmployee(parsed.parameters.employeeName, employees)
            : null;
          if (matched) {
            targetEmployeeId = matched.id;
            targetEmployeeName = matched.name;
          }
        }

        // Dapatkan semua tugas aktif karyawan tersebut
        const activeTasks = await db.task.findMany({
          where: {
            employeeId: targetEmployeeId,
            status: { not: "COMPLETED" }
          },
          select: { id: true, title: true }
        });

        const spokenTitle = parsed.parameters?.taskTitle || transcript;
        const matchedTask = matchTaskTitle(spokenTitle, activeTasks);

        if (matchedTask) {
          // Tandai tugas sebagai selesai di DB
          await db.task.update({
            where: { id: matchedTask.id },
            data: { status: "COMPLETED" }
          });

          // Revalidate dashboard agar tampilan UI langsung ter-update live
          revalidatePath("/dashboard");
          revalidatePath("/dashboard/jobdesk");

          actionSuccess = true;
          databaseResult = {
            success: true,
            action: "COMPLETE_TASK",
            employeeName: targetEmployeeName,
            taskTitle: matchedTask.title
          };
        } else {
          databaseResult = {
            success: false,
            action: "COMPLETE_TASK",
            employeeName: targetEmployeeName,
            searchedTitle: spokenTitle,
            message: "Tugas aktif tidak ditemukan."
          };
        }
        break;
      }

      case "QUERY_TASKS": {
        let targetEmployeeId = isEmployee ? userId : undefined;
        
        // Admin bisa memfilter nama karyawan tertentu
        if (isAdmin && parsed.parameters?.employeeName) {
          const employees = await db.employee.findMany({
            where: { role: "EMPLOYEE" },
            select: { id: true, name: true }
          });
          const matched = findClosestEmployee(parsed.parameters.employeeName, employees);
          if (matched) {
            targetEmployeeId = matched.id;
          }
        }

        databaseResult = await db.task.findMany({
          where: {
            employeeId: targetEmployeeId,
            status: parsed.parameters?.status ? (parsed.parameters.status.toUpperCase() as any) : undefined,
            OR: [
              { dueDate: null },
              {
                dueDate: {
                  gte: startOfDay,
                  lte: endOfDay
                }
              }
            ]
          },
          include: {
            employee: { select: { name: true } }
          }
        });
        break;
      }

      case "QUERY_ATTENDANCE": {
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        let targetEmployeeId = isEmployee ? userId : undefined;

        if (isAdmin && parsed.parameters?.employeeName) {
          const employees = await db.employee.findMany({
            where: { role: "EMPLOYEE" },
            select: { id: true, name: true }
          });
          const matched = findClosestEmployee(parsed.parameters.employeeName, employees);
          if (matched) targetEmployeeId = matched.id;
        }

        databaseResult = await db.attendance.findMany({
          where: {
            employeeId: targetEmployeeId,
            date: todayStr,
            status: parsed.parameters?.status ? (parsed.parameters.status.toUpperCase() as any) : undefined
          },
          include: {
            employee: { select: { name: true } },
            shift: { select: { name: true } }
          }
        });
        break;
      }

      case "QUERY_LEAVE": {
        let targetEmployeeId = isEmployee ? userId : undefined;

        if (isAdmin && parsed.parameters?.employeeName) {
          const employees = await db.employee.findMany({
            where: { role: "EMPLOYEE" },
            select: { id: true, name: true }
          });
          const matched = findClosestEmployee(parsed.parameters.employeeName, employees);
          if (matched) targetEmployeeId = matched.id;
        }

        databaseResult = await db.leaveRequest.findMany({
          where: {
            employeeId: targetEmployeeId,
            status: "APPROVED" // Cek cuti yang disetujui
          },
          include: {
            employee: { select: { name: true } }
          }
        });
        break;
      }

      case "QUERY_PAYROLL": {
        let targetEmployeeId = isEmployee ? userId : undefined;
        let targetEmployeeName = userName;

        if (isAdmin && parsed.parameters?.employeeName) {
          const employees = await db.employee.findMany({
            where: { role: "EMPLOYEE" },
            select: { id: true, name: true }
          });
          const matched = findClosestEmployee(parsed.parameters.employeeName, employees);
          if (matched) {
            targetEmployeeId = matched.id;
            targetEmployeeName = matched.name;
          }
        }

        if (targetEmployeeId) {
          const employee = await db.employee.findUnique({
            where: { id: targetEmployeeId },
            select: { dailySalary: true, name: true }
          });
          // Hitung absensi masuk bulan ini
          const currentMonth = now.getMonth() + 1;
          const currentYear = now.getFullYear();
          const datePrefix = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

          const attendances = await db.attendance.findMany({
            where: {
              employeeId: targetEmployeeId,
              date: { startsWith: datePrefix },
              status: { in: ["ON_TIME", "LATE"] }
            }
          });

          const dailySalary = employee?.dailySalary || 100000;
          databaseResult = {
            employeeName: employee?.name || targetEmployeeName,
            dailySalary: dailySalary,
            totalWorkDaysThisMonth: attendances.length,
            estimatedPayrollThisMonth: attendances.length * dailySalary
          };
        } else {
          // Tampilkan semua gaji karyawan
          const employees = await db.employee.findMany({
            where: { role: "EMPLOYEE" },
            select: { id: true, name: true, dailySalary: true }
          });
          databaseResult = employees;
        }
        break;
      }

      case "QUERY_SHIFTS": {
        databaseResult = await db.shift.findMany({
          where: { isActive: true }
        });
        break;
      }

      case "QUERY_NOTES": {
        databaseResult = await db.privateNote.findMany({
          where: {
            OR: [
              { isBroadcast: true },
              { employeeId: userId }
            ]
          },
          include: {
            createdBy: { select: { name: true } }
          }
        });
        break;
      }

      case "ADD_SHOPPING_ITEM": {
        const itemName = parsed.parameters?.itemName || "";
        const quantity = parsed.parameters?.quantity || 1;
        const unit = parsed.parameters?.unit || "Pcs";
        const notes = parsed.parameters?.notes || null;

        if (!itemName) {
          databaseResult = { success: false, message: "Nama barang tidak terdeteksi." };
        } else {
          try {
            const newItem = await db.shoppingItem.create({
              data: {
                itemName: itemName.trim(),
                quantity: Number(quantity),
                unit: unit.trim(),
                notes: notes ? notes.trim() : null,
                employeeId: userId,
                status: "PENDING",
              },
            });
            revalidatePath("/dashboard");
            revalidatePath("/dashboard/shopping");
            actionSuccess = true;
            databaseResult = {
              success: true,
              action: "ADD_SHOPPING_ITEM",
              itemName: newItem.itemName,
              quantity: newItem.quantity,
              unit: newItem.unit,
            };
          } catch (e) {
            console.error("Voice add shopping item failed:", e);
            databaseResult = { success: false, message: "Gagal menyimpan barang ke database." };
          }
        }
        break;
      }

      case "QUERY_SHOPPING_ITEMS": {
        const status = parsed.parameters?.status ? parsed.parameters.status.toUpperCase() : "PENDING";
        
        databaseResult = await db.shoppingItem.findMany({
          where: {
            employeeId: isAdmin ? undefined : userId,
            status: status as any,
          },
          include: {
            employee: { select: { name: true } }
          },
          orderBy: { createdAt: "desc" }
        });
        break;
      }

      default: {
        databaseResult = { message: "Conversational question or unknown database action query." };
        break;
      }
    }

    // 3. Sintesis hasil query database menjadi teks respons percakapan ramah dengan Gemini
    const speechResponse = await generateSpeechResponse(transcript, databaseResult, {
      userRole: session.role,
      userName: userName
    });

    return { response: speechResponse, parsedIntent: parsed.intent };

  } catch (error: any) {
    console.error("AI voice processing error:", error);
    return {
      error: error.message || "Gagal memproses AI.",
      response: "Maaf Boss, terjadi kendala saat menghubungi asisten AI Google Gemini."
    };
  }
}

/**
 * Logika Fallback Keyword-Based Lokal
 */
async function executeLocalKeywordFallback(
  query: string,
  session: any,
  timeBounds: { startOfDay: Date; endOfDay: Date; now: Date }
): Promise<{ response: string; error?: string }> {
  const { startOfDay, endOfDay, now } = timeBounds;
  const userName = session.name;
  const userId = session.id;
  const isEmployee = session.role === "EMPLOYEE";
  const isAdmin = session.role === "ADMIN";

  const isCompleteQuery =
    query.includes("selesai") ||
    query.includes("selesaikan") ||
    query.includes("beres") ||
    query.includes("bereskan") ||
    query.includes("ceklis") ||
    query.includes("sudah selesai") ||
    query.includes("tuntas") ||
    query.includes("tuntaskan");

  const isTaskQuery =
    query.includes("jobdesk") ||
    query.includes("jobdeks") ||
    query.includes("job desk") ||
    query.includes("job deks") ||
    query.includes("tugas") ||
    query.includes("pekerjaan") ||
    query.includes("kerjaan") ||
    query.includes("belum") ||
    query.includes("sisa");

  const isLateQuery =
    query.includes("terlambat") ||
    query.includes("telat") ||
    query.includes("absen terlambat") ||
    query.includes("absen telat");

  const isAddShoppingLocal = 
    query.includes("tambah belanja") || 
    query.includes("tambahkan belanja") ||
    (query.includes("daftar belanja") && (query.includes("tambah") || query.includes("tambahkan") || query.includes("input") || query.includes("masukkan"))) ||
    query.includes("tolong belikan") ||
    query.includes("beli bahan");

  const isQueryShoppingLocal =
    query.includes("belanjaan") || 
    query.includes("daftar belanja") ||
    query.includes("kebutuhan bahan");

  // A. KARYAWAN/ADMIN: Selesaikan/Ceklis Tugas secara lokal
  if (isCompleteQuery) {
    let targetEmployeeId = userId;
    let targetEmployeeName = userName;

    if (isAdmin) {
      const allEmployees = await db.employee.findMany({
        where: { role: "EMPLOYEE" },
        select: { id: true, name: true }
      });
      const mentioned = findClosestEmployee(query, allEmployees);
      if (mentioned) {
        targetEmployeeId = mentioned.id;
        targetEmployeeName = mentioned.name;
      }
    }

    // Dapatkan semua tugas aktif karyawan tersebut
    const activeTasks = await db.task.findMany({
      where: {
        employeeId: targetEmployeeId,
        status: { not: "COMPLETED" }
      },
      select: { id: true, title: true }
    });

    // Bersihkan kalimat untuk mendapatkan judul
    const cleanTitle = query
      .replace(/tolong/g, "")
      .replace(/selesaikanlah/g, "")
      .replace(/selesaikan/g, "")
      .replace(/ceklis/g, "")
      .replace(/sudah selesai/g, "")
      .replace(/sudah/g, "")
      .replace(/tugas/g, "")
      .replace(/jobdesk/g, "")
      .replace(/jobdeks/g, "")
      .replace(/job desk/g, "")
      .replace(/job deks/g, "")
      .replace(/pekerjaan/g, "")
      .replace(/kerjaan/g, "")
      .trim();

    const matchedTask = matchTaskTitle(cleanTitle, activeTasks);

    if (matchedTask) {
      await db.task.update({
        where: { id: matchedTask.id },
        data: { status: "COMPLETED" }
      });

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/jobdesk");

      return {
        response: isAdmin
          ? `Tugas "${matchedTask.title}" milik ${targetEmployeeName} berhasil ditandai selesai, Boss.`
          : `Tugas "${matchedTask.title}" berhasil diselesaikan, ${userName}. Kerja bagus!`
      };
    } else {
      return {
        response: `Maaf, saya tidak menemukan tugas aktif bernama "${cleanTitle}" untuk ${targetEmployeeName}.`
      };
    }
  }

  // 1. KARYAWAN: Tanya tugas
  if (isEmployee && isTaskQuery) {
    const pendingTasks = await db.task.findMany({
      where: {
        employeeId: userId,
        status: { not: "COMPLETED" },
        OR: [
          { dueDate: null },
          { dueDate: { gte: startOfDay, lte: endOfDay } }
        ]
      },
      select: { title: true }
    });

    if (pendingTasks.length === 0) {
      return {
        response: `Luar biasa ${userName}, tidak ada tugas yang belum selesai hari ini. Semua pekerjaan Anda sudah beres!`
      };
    } else {
      const titles = pendingTasks.map((t, idx) => `${idx + 1}, ${t.title}`).join(". ");
      return {
        response: `Ada ${userName}. Kamu memiliki ${pendingTasks.length} tugas yang belum selesai hari ini, yaitu: ${titles}.`
      };
    }
  }

  // 2. ADMIN: Keterlambatan
  if (isAdmin && isLateQuery) {
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const late = await db.attendance.findMany({
      where: { date: todayStr, status: "LATE" },
      include: { employee: { select: { name: true } }, shift: { select: { name: true } } }
    });

    if (late.length === 0) {
      return {
        response: `Bagus sekali Boss, tidak ada karyawan yang terlambat masuk hari ini. Semuanya hadir tepat waktu!`
      };
    } else {
      const names = late.map((a, idx) => `${idx + 1}, ${a.employee.name} pada shift ${a.shift?.name || "Biasa"}`).join(". ");
      return {
        response: `Hari ini ada ${late.length} karyawan terlambat masuk, yaitu: ${names}.`
      };
    }
  }

  // 3. ADMIN: Tugas
  if (isAdmin && isTaskQuery) {
    const allEmployees = await db.employee.findMany({
      where: { role: "EMPLOYEE" },
      select: { id: true, name: true }
    });
    const mentioned = findClosestEmployee(query, allEmployees);

    const pending = await db.task.findMany({
      where: {
        employeeId: mentioned ? mentioned.id : undefined,
        status: { not: "COMPLETED" },
        OR: [
          { dueDate: null },
          { dueDate: { gte: startOfDay, lte: endOfDay } }
        ]
      },
      include: { employee: { select: { name: true } } }
    });

    if (pending.length === 0) {
      return {
        response: mentioned 
          ? `Tidak ada tugas yang belum selesai untuk ${mentioned.name} hari ini, Boss.`
          : `Semua tugas karyawan telah selesai dikerjakan hari ini, Boss.`
      };
    } else {
      const listText = pending.map((t, idx) => {
        const assignee = t.employee?.name ? t.employee.name : (t.isClaimable ? "Siapa Cepat Dia Dapat" : "Belum ditunjuk");
        return `${idx + 1}, ${t.title} oleh ${assignee}`;
      }).join(". ");

      return {
        response: mentioned
          ? `Terdapat ${pending.length} tugas yang belum selesai untuk ${mentioned.name}, yaitu: ${listText}.`
          : `Terdapat ${pending.length} tugas karyawan yang belum selesai hari ini, yaitu: ${listText}.`
      };
    }
  }

  // 4. LOKAL: Tambah daftar belanjaan
  if (isAddShoppingLocal) {
    let textToParse = query
      .replace(/tolong/g, "")
      .replace(/tambahkan/g, "")
      .replace(/tambah/g, "")
      .replace(/input/g, "")
      .replace(/masukkan/g, "")
      .replace(/belikan/g, "")
      .replace(/beli/g, "")
      .replace(/ke daftar belanja/g, "")
      .replace(/ke belanjaan/g, "")
      .trim();

    const match = textToParse.match(/(.+?)\s+(\d+(?:[.,]\d+)?)\s*([a-zA-Z]+)?$/);
    
    let itemName = textToParse;
    let quantity = 1;
    let unit = "Pcs";

    if (match) {
      itemName = match[1].trim();
      quantity = parseFloat(match[2].replace(",", "."));
      if (match[3]) {
        unit = match[3].trim();
      }
    }

    if (!itemName) {
      return { response: "Maaf, nama barang belanjaan tidak jelas." };
    }

    try {
      const newItem = await db.shoppingItem.create({
        data: {
          itemName: itemName,
          quantity: quantity,
          unit: unit,
          notes: "Diinput via perintah suara lokal",
          employeeId: userId,
          status: "PENDING"
        }
      });

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/shopping");

      return {
        response: `Berhasil menambahkan ${newItem.quantity} ${newItem.unit} ${newItem.itemName} ke daftar belanja.`
      };
    } catch (e) {
      return { response: "Gagal menyimpan daftar belanja secara lokal." };
    }
  }

  // 5. LOKAL: Tanya daftar belanjaan pending
  if (isQueryShoppingLocal) {
    try {
      const items = await db.shoppingItem.findMany({
        where: {
          employeeId: isAdmin ? undefined : userId,
          status: "PENDING"
        },
        include: {
          employee: { select: { name: true } }
        },
        orderBy: { createdAt: "desc" }
      });

      if (items.length === 0) {
        return {
          response: "Daftar belanjaan saat ini kosong. Tidak ada bahan atau stok yang perlu dibeli."
        };
      }

      const listText = items.map((item, idx) => 
        `${idx + 1}, ${item.itemName} sebanyak ${item.quantity} ${item.unit} oleh ${item.employee.name}`
      ).join(". ");

      return {
        response: `Daftar belanjaan pending saat ini ada ${items.length} barang, yaitu: ${listText}.`
      };
    } catch (e) {
      return { response: "Gagal memuat daftar belanja secara lokal." };
    }
  }

  // Default Help
  return {
    response: isEmployee
      ? `Halo ${userName}! Saya asisten Burjolevelup. Kamu bisa bertanya tentang tugasmu hari ini.`
      : `Halo Boss ${userName}! Saya asisten Burjolevelup. Anda bisa bertanya tentang tugas karyawan atau siapa saja yang terlambat hari ini.`
  };
}
