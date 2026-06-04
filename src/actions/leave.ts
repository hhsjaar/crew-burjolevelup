"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/jwt";
import { LeaveType, LeaveStatus } from "@prisma/client";

export async function submitLeaveRequest(formData: FormData) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const reason = formData.get("reason") as string;
  const typeInput = formData.get("type") as string; // SICK, LEAVE, URGENT

  if (!startDateStr || !endDateStr || !reason || !typeInput) {
    return { error: "Semua field wajib diisi." };
  }

  const type =
    typeInput === "SICK" ? LeaveType.SICK : typeInput === "URGENT" ? LeaveType.URGENT : LeaveType.LEAVE;

  try {
    const leaveRequest = await db.leaveRequest.create({
      data: {
        employeeId: session.id,
        startDate: new Date(startDateStr),
        endDate: new Date(endDateStr),
        type,
        reason,
        status: LeaveStatus.PENDING,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/leave");
    return { success: true, leaveRequest };
  } catch (error) {
    console.error("Submit leave error:", error);
    return { error: "Gagal mengajukan izin." };
  }
}

export async function approveLeaveRequest(requestId: string, adminNotes?: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak." };
  }

  try {
    const request = await db.leaveRequest.findUnique({
      where: { id: requestId },
      include: { employee: true },
    });

    if (!request) return { error: "Pengajuan tidak ditemukan." };

    // Update status pengajuan
    const updatedRequest = await db.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveStatus.APPROVED,
        adminNotes,
      },
    });

    // Tambahkan rekam kehadiran izin ke riwayat absensi untuk setiap hari pengajuan izin tersebut
    const start = new Date(request.startDate);
    const end = new Date(request.endDate);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      try {
        const existing = await db.attendance.findFirst({
          where: {
            employeeId: request.employeeId,
            date: dateStr,
            shiftId: null,
          },
        });

        if (existing) {
          await db.attendance.update({
            where: { id: existing.id },
            data: {
              status: "LEAVE",
              notes: `Izin Disetujui (${request.type}): ${request.reason}`,
            },
          });
        } else {
          await db.attendance.create({
            data: {
              employeeId: request.employeeId,
              date: dateStr,
              shiftId: null,
              clockIn: new Date(d),
              status: "LEAVE",
              notes: `Izin Disetujui (${request.type}): ${request.reason}`,
            },
          });
        }
      } catch (upsertError) {
        console.error("Error creating leave attendance record:", upsertError);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/leave");
    return { success: true, request: updatedRequest };
  } catch (error) {
    console.error("Approve leave error:", error);
    return { error: "Gagal menyetujui izin." };
  }
}

export async function rejectLeaveRequest(requestId: string, adminNotes?: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak." };
  }

  try {
    const updatedRequest = await db.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: LeaveStatus.REJECTED,
        adminNotes,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/leave");
    return { success: true, request: updatedRequest };
  } catch (error) {
    console.error("Reject leave error:", error);
    return { error: "Gagal menolak izin." };
  }
}

export async function getEmployeeLeaveRequests(employeeId: string) {
  try {
    const requests = await db.leaveRequest.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });
    return requests;
  } catch (error) {
    return [];
  }
}

export async function getAllLeaveRequests() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];

  try {
    const requests = await db.leaveRequest.findMany({
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
    return requests;
  } catch (error) {
    return [];
  }
}
