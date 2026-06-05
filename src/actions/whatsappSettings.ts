"use server";

import { db } from "@/lib/db";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { getSession } from "@/lib/jwt";
import { revalidatePath } from "next/cache";

export async function getWhatsAppSettings() {
  try {
    const settings = await db.systemSetting.findMany();
    const adminNumber = settings.find((s) => s.key === "whatsapp_admin_number")?.value || process.env.ADMIN_WHATSAPP_NUMBER || "6285878094821";
    const notificationTime = settings.find((s) => s.key === "cron_notification_time")?.value || "17:00";
    const enabled = settings.find((s) => s.key === "whatsapp_enabled")?.value !== "false";

    return { adminNumber, notificationTime, enabled };
  } catch (error) {
    console.error("Error fetching WhatsApp settings:", error);
    return {
      adminNumber: process.env.ADMIN_WHATSAPP_NUMBER || "6285878094821",
      notificationTime: "17:00",
      enabled: true,
    };
  }
}

export async function saveWhatsAppSettings(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat mengubah pengaturan ini." };
  }

  const adminNumber = formData.get("adminNumber") as string;
  const notificationTime = formData.get("notificationTime") as string; // format HH:mm
  const enabledStr = formData.get("enabled") === "true" || formData.get("enabled") === "on" ? "true" : "false";

  if (!adminNumber) {
    return { error: "Nomor WhatsApp Admin wajib diisi." };
  }
  if (!notificationTime || !/^([01]\d|2[0-3]):[0-5]\d$/.test(notificationTime)) {
    return { error: "Format waktu tidak valid. Gunakan format HH:mm (contoh: 17:00)." };
  }

  try {
    await db.$transaction([
      db.systemSetting.upsert({
        where: { key: "whatsapp_admin_number" },
        update: { value: adminNumber },
        create: { key: "whatsapp_admin_number", value: adminNumber },
      }),
      db.systemSetting.upsert({
        where: { key: "cron_notification_time" },
        update: { value: notificationTime },
        create: { key: "cron_notification_time", value: notificationTime },
      }),
      db.systemSetting.upsert({
        where: { key: "whatsapp_enabled" },
        update: { value: enabledStr },
        create: { key: "whatsapp_enabled", value: enabledStr },
      }),
    ]);

    revalidatePath("/dashboard/admin/whatsapp");
    return { success: true };
  } catch (error) {
    console.error("Error saving WhatsApp settings:", error);
    return { error: "Gagal menyimpan pengaturan." };
  }
}

export async function sendWhatsAppTestMessage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Sesi habis atau bukan admin." };
  }

  const { adminNumber, enabled } = await getWhatsAppSettings();
  if (!enabled) {
    return { error: "Integrasi WhatsApp dinonaktifkan." };
  }

  const message = `Halo Admin! Ini adalah pesan uji coba dari sistem Absensi & Jobdesk Burjolevelup.\n\nIntegrasi WhatsApp menggunakan Fonnte berhasil terhubung.`;
  
  const result = await sendWhatsAppMessage(adminNumber, message);
  if (result.success) {
    return { success: true };
  } else {
    return { error: result.error };
  }
}

export async function triggerUnfinishedTasksRecap() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Sesi habis atau bukan admin." };
  }

  const result = await sendUnfinishedTasksRecapMessage();
  return result;
}

export async function sendUnfinishedTasksRecapMessage() {
  try {
    const { adminNumber, enabled } = await getWhatsAppSettings();
    if (!enabled) {
      return { error: "Integrasi WhatsApp dinonaktifkan di pengaturan." };
    }

    // Ambil tugas yang belum selesai
    const unfinishedTasks = await db.task.findMany({
      where: {
        status: {
          in: ["PENDING", "IN_PROGRESS"],
        },
      },
      include: {
        employee: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        dueDate: "asc",
      },
    });

    if (unfinishedTasks.length === 0) {
      const emptyMsg = `📋 *Laporan Tugas Burjolevelup*\n\nSemua tugas/jobdesk karyawan telah selesai dikerjakan! Tidak ada tugas tertunda hari ini.`;
      await sendWhatsAppMessage(adminNumber, emptyMsg);
      return { success: true, count: 0 };
    }

    let message = `📋 *Rangkuman Tugas Belum Selesai*\n`;
    message += `Burjolevelup - ${new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })}\n\n`;

    message += `Terdapat *${unfinishedTasks.length}* tugas yang belum selesai:\n\n`;

    unfinishedTasks.forEach((task, index) => {
      const assignee = task.isClaimable ? "Siapa Cepat Dia Dapat" : (task.employee?.name || "Belum Ditugaskan");
      const statusText = task.status === "IN_PROGRESS" ? "Sedang Dikerjakan" : "Pending";
      
      let dueDateText = "Tanpa Batas";
      if (task.dueDate) {
        dueDateText = new Date(task.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      }

      message += `${index + 1}. *${task.title}*\n`;
      if (task.description) message += `   Deskripsi: ${task.description}\n`;
      message += `   Penerima: ${assignee}\n`;
      message += `   Status: ${statusText}\n`;
      message += `   Batas Waktu: ${dueDateText}\n\n`;
    });

    message += `Mohon kepada karyawan yang bersangkutan untuk segera menyelesaikannya. Terima kasih!`;

    const result = await sendWhatsAppMessage(adminNumber, message);
    if (result.success) {
      return { success: true, count: unfinishedTasks.length };
    } else {
      return { error: result.error };
    }
  } catch (error: any) {
    console.error("Error sending unfinished tasks recap:", error);
    return { error: error.message || "Gagal memproses rekap tugas." };
  }
}
