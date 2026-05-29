"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/jwt";
import { AttendanceStatus } from "@prisma/client";

// Dapatkan waktu lokal YYYY-MM-DD
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function clockIn(notes?: string, latitude?: number, longitude?: number, selfie?: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  const todayStr = getLocalDateString();
  const now = new Date();

  // Batas toleransi masuk pukul 08:00 pagi
  const limitTime = new Date(now);
  limitTime.setHours(8, 0, 0, 0);

  const status = now > limitTime ? AttendanceStatus.LATE : AttendanceStatus.ON_TIME;
  const statusNotes = notes && notes.trim() !== "" ? notes.trim() : null;

  try {
    // Periksa apakah sudah clock-in hari ini
    const existing = await db.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: session.id,
          date: todayStr,
        },
      },
    });

    if (existing) {
      return { error: "Anda sudah melakukan absensi masuk hari ini." };
    }

    const attendance = await db.attendance.create({
      data: {
        employeeId: session.id,
        date: todayStr,
        clockIn: now,
        status,
        notes: statusNotes,
        clockInLatitude: latitude || null,
        clockInLongitude: longitude || null,
        clockInSelfie: selfie || null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/attendance");
    return { success: true, attendance };
  } catch (error: any) {
    console.error("Clock In error:", error);
    return { error: "Gagal mencatat absensi masuk." };
  }
}

export async function clockOut(notes?: string, latitude?: number, longitude?: number, selfie?: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  const todayStr = getLocalDateString();
  const now = new Date();

  try {
    const existing = await db.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId: session.id,
          date: todayStr,
        },
      },
    });

    if (!existing) {
      return { error: "Anda harus melakukan Clock-In terlebih dahulu hari ini." };
    }

    if (existing.clockOut) {
      return { error: "Anda sudah melakukan absensi pulang hari ini." };
    }

    const updatedNotes = notes && notes.trim() !== ""
      ? (existing.notes ? `${existing.notes} | ${notes.trim()}` : notes.trim())
      : existing.notes;

    const attendance = await db.attendance.update({
      where: { id: existing.id },
      data: {
        clockOut: now,
        notes: updatedNotes,
        clockOutLatitude: latitude || null,
        clockOutLongitude: longitude || null,
        clockOutSelfie: selfie || null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/attendance");
    return { success: true, attendance };
  } catch (error) {
    console.error("Clock Out error:", error);
    return { error: "Gagal mencatat absensi pulang." };
  }
}

export async function getTodayAttendance(employeeId: string) {
  const todayStr = getLocalDateString();
  try {
    const attendance = await db.attendance.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: todayStr,
        },
      },
    });
    return attendance;
  } catch (error) {
    return null;
  }
}

export async function getEmployeeAttendanceHistory(employeeId: string) {
  try {
    const history = await db.attendance.findMany({
      where: { employeeId },
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
      },
      orderBy: { clockIn: "asc" },
    });
    return attendances;
  } catch (error) {
    return [];
  }
}
