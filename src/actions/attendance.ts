"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/jwt";
import { AttendanceStatus } from "@prisma/client";
import { getWhatsAppSettings } from "./whatsappSettings";
import { sendWhatsAppMessage } from "@/lib/whatsapp";

// Dapatkan waktu lokal YYYY-MM-DD
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function clockIn(shiftId: string, notes?: string, latitude?: number, longitude?: number, selfie?: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  if (!shiftId) return { error: "Pilih shift terlebih dahulu." };

  const todayStr = getLocalDateString();
  const now = new Date();

  try {
    // Find shift
    const shift = await db.shift.findUnique({
      where: { id: shiftId },
    });
    if (!shift) return { error: "Shift tidak ditemukan." };

    // Calculate late status
    // Shift start time is in format "HH:mm" e.g., "09:00"
    const [shiftHours, shiftMinutes] = shift.startTime.split(":").map(Number);
    const targetTime = new Date(now);
    targetTime.setHours(shiftHours, shiftMinutes, 0, 0);

    // Late limit is 15 minutes past start time
    const limitTime = new Date(targetTime.getTime() + 15 * 60 * 1000);

    const status = now > limitTime ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;
    const statusNotes = notes && notes.trim() !== "" ? notes.trim() : null;

    // Periksa apakah sudah clock-in untuk shift ini hari ini
    const existing = await db.attendance.findUnique({
      where: {
        employeeId_date_shiftId: {
          employeeId: session.id,
          date: todayStr,
          shiftId: shiftId,
        },
      },
    });

    if (existing) {
      return { error: `Anda sudah melakukan absensi masuk untuk shift ${shift.name} hari ini.` };
    }

    const attendance = await db.attendance.create({
      data: {
        employeeId: session.id,
        date: todayStr,
        shiftId: shiftId,
        clockIn: now,
        status,
        notes: statusNotes,
        clockInLatitude: latitude || null,
        clockInLongitude: longitude || null,
        clockInSelfie: selfie || null,
      },
    });

    if (status === AttendanceStatus.LATE) {
      // Kirim notifikasi WA secara async agar tidak menghambat user interface
      (async () => {
        try {
          const { adminNumber, enabled } = await getWhatsAppSettings();
          if (enabled) {
            const emp = await db.employee.findUnique({
              where: { id: session.id },
              select: { name: true },
            });
            const employeeName = emp?.name || "Karyawan";
            const timeStr = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
            
            const message = `⏰ *Karyawan Terlambat Masuk*\n\n` +
              `Nama: *${employeeName}*\n` +
              `Shift: *${shift.name}* (${shift.startTime})\n` +
              `Jam Absen: *${timeStr} WIB*\n` +
              `Tanggal: *${todayStr}*\n` +
              (statusNotes ? `Catatan: _"${statusNotes}"_\n` : "");

            await sendWhatsAppMessage(adminNumber, message);
          }
        } catch (err) {
          console.error("Gagal mengirim notifikasi WA keterlambatan:", err);
        }
      })();
    }

    // Ambil daftar tugas harian/pending karyawan hari ini untuk dibacakan asisten suara
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);

    const employeeTasks = await db.task.findMany({
      where: {
        employeeId: session.id,
        status: { not: "COMPLETED" },
        OR: [
          { dueDate: null },
          {
            dueDate: {
              gte: startOfDay,
              lte: endOfDay,
            },
          },
        ],
      },
      select: { title: true },
      orderBy: { createdAt: "asc" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/attendance");
    return { success: true, attendance, tasks: employeeTasks };
  } catch (error: any) {
    console.error("Clock In error:", error);
    return { error: "Gagal mencatat absensi masuk." };
  }
}

export async function clockOut(notes?: string, latitude?: number, longitude?: number, selfie?: string) {
  return { error: "Fitur Clock-Out dinonaktifkan. Sistem sekarang menggunakan Absen Masuk per Shift." };
}

export async function getTodayAttendance(employeeId: string) {
  // Backward compatibility
  const res = await getTodayAttendances(employeeId);
  return res.length > 0 ? res[0] : null;
}

export async function getTodayAttendances(employeeId: string) {
  const todayStr = getLocalDateString();
  try {
    const attendances = await db.attendance.findMany({
      where: {
        employeeId,
        date: todayStr,
      },
      include: {
        shift: true,
      },
      orderBy: {
        clockIn: "asc",
      },
    });
    return attendances;
  } catch (error) {
    console.error("Error getTodayAttendances:", error);
    return [];
  }
}

export async function getEmployeeAttendanceHistory(employeeId: string) {
  try {
    const history = await db.attendance.findMany({
      where: { employeeId },
      include: {
        shift: true,
      },
      orderBy: { clockIn: "desc" },
    });
    return history;
  } catch (error) {
    return [];
  }
}

export async function getAllTodayAttendance() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];

  const todayStr = getLocalDateString();

  try {
    const attendances = await db.attendance.findMany({
      where: { date: todayStr },
      include: {
        employee: {
          select: {
            name: true,
            email: true,
          },
        },
        shift: true,
      },
      orderBy: { clockIn: "asc" },
    });
    return attendances;
  } catch (error) {
    return [];
  }
}

