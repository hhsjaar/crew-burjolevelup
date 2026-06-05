"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/jwt";
import { TaskType, TaskStatus } from "@prisma/client";
import { getWhatsAppSettings } from "./whatsappSettings";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import fs from "fs";
import path from "path";

export async function createTask(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat membuat tugas." };
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const typeInput = formData.get("type") as string; // DAILY, WEEKLY, MONTHLY
  const employeeId = formData.get("employeeId") as string || null;
  const dueDateStr = formData.get("dueDate") as string;
  const isClaimable = formData.get("isClaimable") === "true" || formData.get("isClaimable") === "on";

  if (!title || !typeInput) {
    return { error: "Judul dan tipe tugas wajib diisi." };
  }

  if (!isClaimable && !employeeId) {
    return { error: "Penerima tugas wajib ditentukan jika tugas bukan bertipe Siapa Cepat Dia Dapat." };
  }

  const type =
    typeInput === "ONCE"
      ? TaskType.ONCE
      : typeInput === "WEEKLY"
      ? TaskType.WEEKLY
      : typeInput === "MONTHLY"
      ? TaskType.MONTHLY
      : TaskType.DAILY;
  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  try {
    const task = await db.task.create({
      data: {
        title,
        description,
        type,
        status: TaskStatus.PENDING,
        employeeId: isClaimable ? null : employeeId,
        createdById: session.id,
        dueDate,
        isClaimable,
      },
    });

    if (task.dueDate && task.employeeId) {
      scheduleH5Reminder(task.id, task.dueDate);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task };
  } catch (error) {
    console.error("Create task error:", error);
    return { error: "Gagal membuat tugas baru." };
  }
}

export async function updateTaskStatus(taskId: string, statusInput: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  const status =
    statusInput === "IN_PROGRESS"
      ? TaskStatus.IN_PROGRESS
      : statusInput === "COMPLETED"
      ? TaskStatus.COMPLETED
      : TaskStatus.PENDING;

  try {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: "Tugas tidak ditemukan." };

    // Admin tidak boleh menyelesaikan tugas secara langsung. Hanya penerima tugas yang boleh.
    if (session.role === "ADMIN") {
      return { error: "Akses ditolak. Owner tidak dapat menyelesaikan tugas secara langsung." };
    }

    if (task.employeeId !== session.id) {
      return { error: "Akses ditolak. Hanya penerima tugas yang dapat menyelesaikan tugas ini." };
    }

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: { status },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("Update task status error:", error);
    return { error: "Gagal memperbarui status tugas." };
  }
}

export async function claimTask(taskId: string, dateStr?: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  try {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: "Tugas tidak ditemukan." };
    if (!task.isClaimable) return { error: "Tugas ini tidak dapat diklaim." };

    // Jika tugas berulang (DAILY, WEEKLY, MONTHLY) dan dateStr diberikan,
    // kita klaim hanya untuk tanggal tersebut dengan mengecualikan tanggal tersebut dari tugas induk
    // dan membuat duplikat bertipe ONCE untuk diklaim karyawan.
    if (task.type !== TaskType.ONCE && dateStr) {
      const currentExcluded = task.excludedDates ? task.excludedDates.split(",") : [];
      if (currentExcluded.includes(dateStr)) {
        return { error: "Tugas ini sudah tidak tersedia atau telah diklaim untuk tanggal ini." };
      }

      currentExcluded.push(dateStr);
      const updatedRecurring = await db.task.update({
        where: { id: taskId },
        data: {
          excludedDates: currentExcluded.join(","),
        },
      });

      // Tentukan dueDate untuk tugas baru: tanggal target (dateStr) dengan jam dari task.dueDate atau default 08:00
      let taskDueDate: Date | null = null;
      if (task.dueDate) {
        const origDue = new Date(task.dueDate);
        const [year, month, day] = dateStr.split("-").map(Number);
        taskDueDate = new Date(year, month - 1, day, origDue.getHours(), origDue.getMinutes(), origDue.getSeconds());
      } else {
        const [year, month, day] = dateStr.split("-").map(Number);
        taskDueDate = new Date(year, month - 1, day, 8, 0, 0); // Default jam 8 pagi
      }

      // Buat tugas ONCE baru yang diklaim karyawan
      const claimedOnceTask = await db.task.create({
        data: {
          title: task.title,
          description: task.description,
          type: TaskType.ONCE,
          status: TaskStatus.IN_PROGRESS,
          employeeId: session.id,
          createdById: task.createdById,
          dueDate: taskDueDate,
          isClaimable: false,
          claimedAt: new Date(),
        },
      });

      if (claimedOnceTask.dueDate) {
        scheduleH5Reminder(claimedOnceTask.id, claimedOnceTask.dueDate);
      }

      revalidatePath("/dashboard");
      revalidatePath("/dashboard/jobdesk");

      return { 
        success: true, 
        task: claimedOnceTask,
        updatedRecurringTask: updatedRecurring
      };
    }

    // Kasus normal (tugas ONCE atau dateStr tidak didefinisikan)
    if (task.employeeId) return { error: "Tugas ini sudah diklaim oleh karyawan lain." };

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: {
        employeeId: session.id,
        claimedAt: new Date(),
        status: TaskStatus.IN_PROGRESS,
      },
    });

    if (updatedTask.dueDate) {
      scheduleH5Reminder(updatedTask.id, updatedTask.dueDate);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("Claim task error:", error);
    return { error: "Gagal mengklaim tugas." };
  }
}

export async function addTaskComment(taskId: string, content: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  if (!content || content.trim() === "") {
    return { error: "Catatan tidak boleh kosong." };
  }

  try {
    const comment = await db.taskComment.create({
      data: {
        taskId,
        authorId: session.id,
        content,
      },
    });

    revalidatePath("/dashboard/jobdesk");
    return { success: true, comment };
  } catch (error) {
    console.error("Add task comment error:", error);
    return { error: "Gagal menambahkan catatan." };
  }
}

export async function getTaskComments(taskId: string) {
  try {
    const comments = await db.taskComment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return comments;
  } catch (error) {
    console.error("Get task comments error:", error);
    return [];
  }
}

export async function deleteTask(taskId: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat menghapus tugas." };
  }

  try {
    await db.task.delete({
      where: { id: taskId },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true };
  } catch (error) {
    console.error("Delete task error:", error);
    return { error: "Gagal menghapus tugas." };
  }
}

export async function getEmployeeTasks(employeeId: string) {
  try {
    const tasks = await db.task.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });
    return tasks;
  } catch (error) {
    return [];
  }
}

export async function getAllEmployees() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];

  try {
    const employees = await db.employee.findMany({
      where: { role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });
    return employees;
  } catch (error) {
    return [];
  }
}

export async function getAllTasksWithEmployees() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];

  try {
    const tasks = await db.task.findMany({
      include: {
        employee: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return tasks;
  } catch (error) {
    return [];
  }
}

export async function getClaimableTasks() {
  try {
    const tasks = await db.task.findMany({
      where: {
        isClaimable: true,
        employeeId: null,
      },
      orderBy: { createdAt: "desc" },
    });
    return tasks;
  } catch (error) {
    return [];
  }
}

export async function deleteAllTasks(type?: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat menghapus semua tugas." };
  }

  try {
    if (type) {
      await db.task.deleteMany({
        where: { type: type as any },
      });
    } else {
      await db.task.deleteMany({});
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true };
  } catch (error) {
    console.error("Delete all tasks error:", error);
    return { error: "Gagal menghapus semua tugas." };
  }
}

export async function deleteMultipleTasks(taskIds: string[]) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat menghapus tugas terpilih." };
  }

  try {
    await db.task.deleteMany({
      where: {
        id: { in: taskIds },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true };
  } catch (error) {
    console.error("Delete multiple tasks error:", error);
    return { error: "Gagal menghapus tugas terpilih." };
  }
}

export async function excludeTaskDate(taskId: string, dateStr: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat mengecualikan tanggal tugas." };
  }

  try {
    const task = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return { error: "Tugas tidak ditemukan." };
    }

    const currentExcluded = task.excludedDates ? task.excludedDates.split(",") : [];
    if (!currentExcluded.includes(dateStr)) {
      currentExcluded.push(dateStr);
    }

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: {
        excludedDates: currentExcluded.join(","),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("Exclude task date error:", error);
    return { error: "Gagal mengecualikan tanggal tugas." };
  }
}

function logBgTimer(message: string) {
  try {
    const logPath = path.resolve(process.cwd(), "scratch/timer-bg.log");
    const dir = path.dirname(logPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(logPath, `[${new Date().toISOString()}] ${message}\n`);
  } catch (e) {
    console.error("Failed to write to bg log", e);
  }
}

function scheduleH5Reminder(taskId: string, dueDate: Date) {
  const targetTime = new Date(dueDate).getTime();
  const h5Time = targetTime - 5 * 60 * 1000; // 5 menit sebelum mulai
  const delay = h5Time - Date.now();

  logBgTimer(`scheduleH5Reminder called for task ${taskId}, dueDate=${dueDate.toISOString()}, delay=${delay}ms`);

  // Jika waktu pengingat masih di masa depan
  if (delay > 0) {
    setTimeout(async () => {
      await sendH5Reminder(taskId);
    }, delay);
  } else if (targetTime > Date.now()) {
    // Jika tugas mulai dalam kurang dari 5 menit, kirim pengingat segera
    setTimeout(async () => {
      await sendH5Reminder(taskId);
    }, 1000);
  }
}

async function sendH5Reminder(taskId: string) {
  logBgTimer(`sendH5Reminder triggered for task ${taskId}`);
  try {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: {
        employee: {
          select: { name: true, phone: true }
        }
      }
    });

    if (!task || task.status === TaskStatus.COMPLETED || task.notifiedH5) {
      logBgTimer(`H-5 reminder abort: task is null, completed, or already notified`);
      return;
    }

    if (task.employee && task.employee.phone) {
      const phone = task.employee.phone;
      const employeeName = task.employee.name;
      const title = task.title;
      const description = task.description || "Tidak ada deskripsi.";
      const timeStr = task.dueDate
        ? new Date(task.dueDate).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
        : "";

      const message = `⏰ *Pengingat Tugas Burjolevelup (H-5)*\n\n` +
        `Halo *${employeeName}*,\n` +
        `Tugas/jobdesk berikut akan dimulai dalam waktu sekitar 5 menit:\n\n` +
        `📋 *${title}*\n` +
        `📝 Deskripsi: ${description}\n` +
        `🕒 Waktu Pelaksanaan: ${timeStr} WIB\n\n` +
        `Silakan bersiap-siap dan mulai mengerjakannya. Semangat bekerja! 💪`;

      const { enabled } = await getWhatsAppSettings();
      logBgTimer(`H-5 WhatsApp settings: enabled=${enabled}`);
      if (enabled) {
        logBgTimer(`H-5 sending WhatsApp to ${phone}...`);
        const waRes = await sendWhatsAppMessage(phone, message);
        logBgTimer(`H-5 WhatsApp result: success=${waRes.success}`);
        if (waRes.success) {
          await db.task.update({
            where: { id: taskId },
            data: { notifiedH5: true }
          });
          logBgTimer(`H-5 notifiedH5 set to true for task ${taskId}`);
        }
      }
    } else {
      logBgTimer(`H-5 abort: employee phone is missing`);
    }
  } catch (err: any) {
    logBgTimer(`H-5 error in callback: ${err.message || err}`);
  }
}

export async function startTaskTimer(taskId: string, durationInSeconds: number) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  logBgTimer(`startTaskTimer called for task ${taskId} with duration ${durationInSeconds}s by user ${session.name}`);

  try {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) {
      logBgTimer(`Task ${taskId} not found`);
      return { error: "Tugas tidak ditemukan." };
    }

    if (session.role !== "ADMIN" && task.employeeId !== session.id) {
      logBgTimer(`Access denied for user ${session.name} on task ${taskId}`);
      return { error: "Akses ditolak. Hanya penerima tugas yang dapat menyalakan timer." };
    }

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: {
        timerDuration: durationInSeconds,
        timerStartedAt: new Date(),
        timerNotified: false,
      },
    });

    logBgTimer(`Database updated for task ${taskId}. Scheduling setTimeout in ${durationInSeconds}s...`);

    // Jalankan timer background di proses server Node (Sangat responsif untuk localhost/development)
    setTimeout(async () => {
      logBgTimer(`setTimeout fired for task ${taskId}`);
      try {
        const currentTask = await db.task.findUnique({
          where: { id: taskId },
          include: {
            employee: {
              select: { name: true, phone: true }
            }
          }
        });

        if (!currentTask) {
          logBgTimer(`setTimeout abort: task ${taskId} no longer exists in DB`);
          return;
        }

        logBgTimer(`Task state in setTimeout: status=${currentTask.status}, timerStartedAt=${currentTask.timerStartedAt}, timerNotified=${currentTask.timerNotified}, employeePhone=${currentTask.employee?.phone}`);

        if (currentTask.status === TaskStatus.COMPLETED) {
          logBgTimer(`setTimeout abort: task is already COMPLETED`);
          return;
        }

        if (!currentTask.timerStartedAt) {
          logBgTimer(`setTimeout abort: timerStartedAt is null (paused)`);
          return;
        }

        if (currentTask.timerNotified) {
          logBgTimer(`setTimeout abort: timerNotified is already true`);
          return;
        }

        const startedTime = new Date(currentTask.timerStartedAt).getTime();
        const now = Date.now();
        const expectedEnd = startedTime + currentTask.timerDuration! * 1000;
        const timeDiff = now - expectedEnd;

        logBgTimer(`Time comparison: now=${now}, expectedEnd=${expectedEnd}, diff=${timeDiff}ms`);

        // Toleransi perbedaan waktu 2 detik
        if (now >= expectedEnd - 2000) {
          if (currentTask.employee && currentTask.employee.phone) {
            const phone = currentTask.employee.phone;
            const employeeName = currentTask.employee.name;
            const title = currentTask.title;

            let durationText = "";
            if (currentTask.timerDuration! >= 60) {
              durationText = `${Math.round(currentTask.timerDuration! / 60)} menit`;
            } else {
              durationText = `${currentTask.timerDuration!} detik`;
            }

            const message = `⏰ *Pengingat Timer Selesai!*\n\n` +
              `Halo *${employeeName}*,\n` +
              `Timer hitung mundur untuk tugas *${title}* telah habis (durasi: ${durationText}).\n\n` +
              `Silakan selesaikan tugas Anda di aplikasi Burjolevelup. Terima kasih! 🙏`;

            const { enabled } = await getWhatsAppSettings();
            logBgTimer(`WhatsApp settings: enabled=${enabled}`);
            
            if (enabled) {
              logBgTimer(`Sending WhatsApp to ${phone}...`);
              const waRes = await sendWhatsAppMessage(phone, message);
              logBgTimer(`WhatsApp send result: success=${waRes.success}, error=${waRes.error}`);
              
              if (waRes.success) {
                await db.task.update({
                  where: { id: taskId },
                  data: { timerNotified: true },
                });
                logBgTimer(`Successfully updated timerNotified to true in DB for task ${taskId}`);
              }
            } else {
              logBgTimer(`WhatsApp integration is disabled globally`);
            }
          } else {
            logBgTimer(`Employee or employee phone is missing: employee=${!!currentTask.employee}, phone=${currentTask.employee?.phone}`);
          }
        } else {
          logBgTimer(`setTimeout abort: now (${now}) is before expectedEnd - 2000 (${expectedEnd - 2000})`);
        }
      } catch (err: any) {
        logBgTimer(`Error in setTimeout callback: ${err.message || err}`);
        console.error("[Timer Background] Error in timeout callback:", err);
      }
    }, durationInSeconds * 1000);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error: any) {
    logBgTimer(`Error starting timer: ${error.message || error}`);
    console.error("Start task timer error:", error);
    return { error: "Gagal menyalakan timer." };
  }
}

export async function pauseTaskTimer(taskId: string, remainingSeconds: number) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  try {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: "Tugas tidak ditemukan." };

    if (session.role !== "ADMIN" && task.employeeId !== session.id) {
      return { error: "Akses ditolak." };
    }

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: {
        timerDuration: remainingSeconds,
        timerStartedAt: null, // Paused
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("Pause task timer error:", error);
    return { error: "Gagal menjeda timer." };
  }
}

export async function resetTaskTimer(taskId: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  try {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: "Tugas tidak ditemukan." };

    if (session.role !== "ADMIN" && task.employeeId !== session.id) {
      return { error: "Akses ditolak." };
    }

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: {
        timerDuration: null,
        timerStartedAt: null,
        timerNotified: false,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("Reset task timer error:", error);
    return { error: "Gagal mengatur ulang timer." };
  }
}

