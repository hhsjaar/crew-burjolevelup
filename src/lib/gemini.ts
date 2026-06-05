const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

export interface ParsedIntent {
  intent: "QUERY_TASKS" | "COMPLETE_TASK" | "QUERY_ATTENDANCE" | "QUERY_LEAVE" | "QUERY_PAYROLL" | "QUERY_SHIFTS" | "QUERY_NOTES" | "ADD_SHOPPING_ITEM" | "QUERY_SHOPPING_ITEMS" | "UNKNOWN";
  parameters: {
    employeeName?: string;
    taskTitle?: string;
    status?: string;
    date?: string;
    month?: string;
    shiftName?: string;
    isBroadcast?: boolean;
    itemName?: string;
    quantity?: number;
    unit?: string;
    notes?: string;
  };
}

/**
 * Menerjemahkan transkrip suara pengguna menjadi Intent dan Parameter terstruktur (JSON)
 */
export async function parseIntent(transcript: string): Promise<ParsedIntent> {
  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY is not defined in env variables.");
    return { intent: "UNKNOWN", parameters: {} };
  }

  const systemInstruction = `Anda adalah asisten suara semantic parser untuk sistem operasional Burjolevelup.
Tugas Anda adalah membaca transkrip suara pengguna (bahasa Indonesia) dan menerjemahkannya menjadi JSON terstruktur berisi 'intent' (maksud tindakan) dan 'parameters' sesuai skema.

Daftar Intent:
1. QUERY_TASKS: Menanyakan sisa tugas, daftar tugas aktif, atau tugas belum selesai.
2. COMPLETE_TASK: Menyelesaikan/menceklis tugas tertentu (misal: "selesaikan tugas bersihkan kasir").
3. QUERY_ATTENDANCE: Menanyakan absensi, keterlambatan, kehadiran, atau siapa yang telat.
4. QUERY_LEAVE: Menanyakan cuti, izin sakit, atau permohonan libur.
5. QUERY_PAYROLL: Menanyakan gaji karyawan harian/bulanan atau upah.
6. QUERY_SHIFTS: Menanyakan jadwal shift kerja, jam kerja, atau daftar shift.
7. QUERY_NOTES: Menanyakan catatan pribadi atau pengumuman broadcast.
8. ADD_SHOPPING_ITEM: Menambahkan kebutuhan daftar belanjaan baru (misal: "tambahkan kopi arabika 10 kg ke daftar belanja", "tolong belikan gula pasir sebanyak lima kilo").
9. QUERY_SHOPPING_ITEMS: Menanyakan apa saja yang ada di daftar belanja atau belanjaan yang belum dibeli (misal: "apa saja daftar belanjaan hari ini?").

Ekstrak parameter jika disebutkan:
- employeeName: nama karyawan yang dibicarakan (contoh: "Yogi", "Hamam", "Rian", "Roy").
- taskTitle: judul tugas yang dicari atau ingin diceklis selesai (contoh: "bersihkan mesin kopi", "gorengan").
- status: status (contoh: "PENDING", "COMPLETED", "LATE", "ON_TIME", "PURCHASED").
- date: tanggal yang dirujuk.
- month: nama bulan yang dirujuk.
- shiftName: nama shift kerja (contoh: "Shift Pagi 1", "Shift Malam").
- isBroadcast: bernilai true jika menanyakan pengumuman broadcast/umum.
- itemName: nama bahan/barang belanjaan yang dicari atau ingin ditambahkan (contoh: "kopi arabika", "susu uht").
- quantity: kuantitas belanjaan dalam angka (contoh: 10, 5, 2.5).
- unit: satuan barang belanjaan (contoh: "kg", "liter", "pcs", "dus").
- notes: catatan tambahan jika ada.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `System Instruction: ${systemInstruction}\n\nTranscript pengguna: "${transcript}"` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              intent: {
                type: "STRING",
                enum: [
                  "QUERY_TASKS",
                  "COMPLETE_TASK",
                  "QUERY_ATTENDANCE",
                  "QUERY_LEAVE",
                  "QUERY_PAYROLL",
                  "QUERY_SHIFTS",
                  "QUERY_NOTES",
                  "ADD_SHOPPING_ITEM",
                  "QUERY_SHOPPING_ITEMS",
                  "UNKNOWN"
                ]
              },
              parameters: {
                type: "OBJECT",
                properties: {
                  employeeName: { type: "STRING" },
                  taskTitle: { type: "STRING" },
                  status: { type: "STRING" },
                  date: { type: "STRING" },
                  month: { type: "STRING" },
                  shiftName: { type: "STRING" },
                  isBroadcast: { type: "BOOLEAN" },
                  itemName: { type: "STRING" },
                  quantity: { type: "NUMBER" },
                  unit: { type: "STRING" },
                  notes: { type: "STRING" }
                }
              }
            },
            required: ["intent"]
          }
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textResult) return { intent: "UNKNOWN", parameters: {} };

    return JSON.parse(textResult) as ParsedIntent;
  } catch (error) {
    console.error("Gagal melakukan parsing intent dengan Gemini:", error);
    return { intent: "UNKNOWN", parameters: {} };
  }
}

/**
 * Menyusun data mentah dari database menjadi teks pidato (voice response) bahasa Indonesia alami
 */
export async function generateSpeechResponse(
  query: string,
  databaseResult: any,
  context: { userRole: string; userName: string }
): Promise<string> {
  if (!GEMINI_API_KEY) {
    return "Maaf, sistem AI asisten suara belum terkonfigurasi.";
  }

  const systemInstruction = `Anda adalah asisten suara virtual sistem Burjolevelup.
Tugas Anda adalah menyusun kalimat respons bahasa Indonesia yang ramah, ringkas, dan alami untuk dibacakan oleh Text-to-Speech (TTS) browser.
Gunakan data mentah dari database yang diberikan untuk menyusun jawaban Anda. Jangan memberikan markdown berlebihan (seperti bold **, tabel, list bullet *), karena teks ini akan dibacakan langsung secara lisan oleh suara browser. Gunakan titik, koma, dan intonasi yang baik.`;

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `System Instruction: ${systemInstruction}\n\nKonteks Pengguna:\n- Nama: ${context.userName}\n- Role: ${context.userRole}\n\nPertanyaan Suara: "${query}"\n\nData Mentah Database:\n${JSON.stringify(databaseResult, null, 2)}\n\nBuat respons suara bahasa Indonesia yang ringkas dan alami:`
              }
            ]
          }
        ],
        generationConfig: {
          maxOutputTokens: 250
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.statusText}`);
    }

    const data = await response.json();
    const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return textResult ? textResult.trim() : "Maaf, terjadi kendala saat merumuskan jawaban.";
  } catch (error) {
    console.error("Gagal melakukan sintesis suara dengan Gemini:", error);
    return "Maaf, terjadi kendala teknis saat menyusun jawaban.";
  }
}
