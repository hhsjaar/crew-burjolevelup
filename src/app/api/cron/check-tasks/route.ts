import { NextResponse } from "next/server";
import { getWhatsAppSettings, sendUnfinishedTasksRecapMessage } from "@/actions/whatsappSettings";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const force = searchParams.get("force") === "true";
  const secret = searchParams.get("secret");

  // Jika CRON_SECRET dikonfigurasi di .env, lakukan validasi keamanan sederhana
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && secret !== cronSecret && !force) {
    return NextResponse.json({ error: "Akses ditolak (Token keamanan cron tidak cocok)" }, { status: 401 });
  }

  try {
    const { notificationTime, enabled } = await getWhatsAppSettings();

    if (!enabled) {
      return NextResponse.json({ message: "Notifikasi WhatsApp dinonaktifkan di sistem." });
    }

    // Ambil jam dari waktu konfigurasi (misal: "17:00" -> 17)
    const [confHour] = notificationTime.split(":").map(Number);

    // Dapatkan waktu saat ini di Jakarta (WIB / UTC+7)
    const now = new Date();
    const jakartaTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    const currentHour = jakartaTime.getUTCHours();

    // Jalankan jika jam saat ini sama dengan jam konfigurasi, ATAU jika dipaksa (?force=true)
    if (currentHour === confHour || force) {
      const result = await sendUnfinishedTasksRecapMessage();
      
      if (result.success) {
        return NextResponse.json({ 
          success: true, 
          message: `Laporan rekap tugas berhasil dikirim. Jumlah tugas pending: ${result.count}`,
          currentLocalHour: currentHour,
          configuredHour: confHour,
          forced: force
        });
      } else {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Jam saat ini (${currentHour}:00 WIB) tidak sesuai dengan waktu pengiriman yang dikonfigurasi (${confHour}:00 WIB). Pesan tidak dikirim.`,
      currentLocalHour: currentHour,
      configuredHour: confHour,
      forced: force
    });
  } catch (error: any) {
    console.error("Cron check-tasks error:", error);
    return NextResponse.json({ error: error.message || "Terjadi kesalahan internal server" }, { status: 500 });
  }
}
