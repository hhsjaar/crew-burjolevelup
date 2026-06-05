import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getWhatsAppSettings } from "@/actions/whatsappSettings";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  const secret = searchParams.get("secret");

  // Validasi token keamanan cron sederhana jika dikonfigurasi
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret && !force) {
    return NextResponse.json({ error: "Akses ditolak (Token keamanan cron tidak cocok)" }, { status: 401 });
  }

  try {
    const { enabled } = await getWhatsAppSettings();
    if (!enabled && !force) {
      return NextResponse.json({ message: "Notifikasi WhatsApp dinonaktifkan di sistem." });
    }

    const now = new Date();

    // 1. Pengecekan Pengingat H-5 Menit
    // Mencari tugas pending yang:
    // - status !== 'COMPLETED'
    // - notifiedH5 === false
    // - employeeId !== null, employee.phone !== null
    // - dueDate !== null, dan now <= dueDate <= now + 5.5 menit, dan dueDate >= now - 30 menit
    const targetH5Time = new Date(now.getTime() + 5.5 * 60 * 1000); // 5 menit 30 detik ke depan
    const pastH5Time = new Date(now.getTime() - 30 * 60 * 1000); // sampai 30 menit ke belakang agar tidak terlewat jika cron sedikit terlambat

    const tasksToNotifyH5 = await db.task.findMany({
      where: {
        status: { not: "COMPLETED" },
        notifiedH5: false,
        employeeId: { not: null },
        dueDate: {
          gte: pastH5Time,
          lte: targetH5Time,
        },
      },
      include: {
        employee: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    let h5Count = 0;
    for (const task of tasksToNotifyH5) {
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

        const waRes = await sendWhatsAppMessage(phone, message);
        if (waRes.success) {
          await db.task.update({
            where: { id: task.id },
            data: { notifiedH5: true },
          });
          h5Count++;
        }
      }
    }

    // 2. Pengecekan Timer Hitung Mundur Selesai
    // Mencari tugas pending yang:
    // - status !== 'COMPLETED'
    // - timerStartedAt !== null
    // - timerNotified === false
    // - employeeId !== null, employee.phone !== null
    // dan sisa waktu habis (timerStartedAt + timerDuration <= now)
    const activeTimerTasks = await db.task.findMany({
      where: {
        status: { not: "COMPLETED" },
        timerStartedAt: { not: null },
        timerNotified: false,
        employeeId: { not: null },
      },
      include: {
        employee: {
          select: {
            name: true,
            phone: true,
          },
        },
      },
    });

    let timerCount = 0;
    for (const task of activeTimerTasks) {
      if (task.timerStartedAt && task.timerDuration && task.employee && task.employee.phone) {
        const startedTime = new Date(task.timerStartedAt).getTime();
        const durationMs = task.timerDuration * 1000;
        const targetTime = startedTime + durationMs;

        // Jika targetTime sudah lewat dari waktu sekarang
        if (now.getTime() >= targetTime) {
          const phone = task.employee.phone;
          const employeeName = task.employee.name;
          const title = task.title;
          
          // Konversi durasi ke menit atau format mm:ss jika singkat
          let durationText = "";
          if (task.timerDuration >= 60) {
            durationText = `${Math.round(task.timerDuration / 60)} menit`;
          } else {
            durationText = `${task.timerDuration} detik`;
          }

          const message = `⏰ *Pengingat Timer Selesai!*\n\n` +
            `Halo *${employeeName}*,\n` +
            `Timer hitung mundur untuk tugas *${title}* telah habis (durasi: ${durationText}).\n\n` +
            `Silakan selesaikan tugas Anda di aplikasi Burjolevelup. Terima kasih! 🙏`;

          const waRes = await sendWhatsAppMessage(phone, message);
          if (waRes.success) {
            await db.task.update({
              where: { id: task.id },
              data: { timerNotified: true },
            });
            timerCount++;
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      remindedH5Count: h5Count,
      timerFinishedCount: timerCount,
    });
  } catch (error: any) {
    console.error("Cron remind-tasks error:", error);
    return NextResponse.json({ error: error.message || "Terjadi kesalahan internal server" }, { status: 500 });
  }
}
