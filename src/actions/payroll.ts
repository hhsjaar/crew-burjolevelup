"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/jwt";

import { revalidatePath } from "next/cache";

export interface EmployeePayrollRecap {
  employeeId: string;
  name: string;
  email: string;
  dailySalary: number;
  totalOnTime: number;
  totalLate: number;
  totalLeave: number;
  totalAbsent: number;
  presentDays: number;
}

export async function getMonthlyRecap(monthStr: string): Promise<{ error?: string; recaps?: EmployeePayrollRecap[] }> {
  // monthStr format: "YYYY-MM" (e.g., "2026-05")
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat mengakses rekapitulasi penggajian." };
  }

  if (!monthStr || !/^\d{4}-\d{2}$/.test(monthStr)) {
    return { error: "Format bulan tidak valid. Gunakan YYYY-MM." };
  }

  try {
    const employees = await db.employee.findMany({ where: { role: "EMPLOYEE" }, select: { id: true, name: true, email: true, dailySalary: true, }, orderBy: { name: "asc" }, });

    const recaps: EmployeePayrollRecap[] = [];

    for (const employee of employees) {
      // Dapatkan seluruh kehadiran karyawan pada bulan tersebut
      const attendances = await db.attendance.findMany({
        where: {
          employeeId: employee.id,
          date: {
            startsWith: monthStr,
          },
        },
      });

      const datesWithPresence = new Set<string>();
      let totalOnTime = 0;
      let totalLate = 0;
      let totalLeave = 0;
      let totalAbsent = 0;

      attendances.forEach((att) => {
        if (att.status === "ON_TIME") {
          totalOnTime++;
          datesWithPresence.add(att.date);
        } else if (att.status === "LATE") {
          totalLate++;
          datesWithPresence.add(att.date);
        } else if (att.status === "LEAVE") {
          totalLeave++;
        } else if (att.status === "ABSENT") {
          totalAbsent++;
        }
      });

      recaps.push({
        employeeId: employee.id,
        name: employee.name,
        email: employee.email,
        dailySalary: employee.dailySalary,
        totalOnTime,
        totalLate,
        totalLeave,
        totalAbsent,
        presentDays: datesWithPresence.size,
      });
    }

    return { recaps };
  } catch (error) {
    console.error("Get monthly recap error:", error);
    return { error: "Gagal mendapatkan rekapitulasi kehadiran bulanan." };
  }
}

export async function updateDailySalary(employeeId: string, newSalary: number) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak." };
  }

  try {
    const employee = await db.employee.update({
      where: { id: employeeId },
      data: { dailySalary: newSalary },
    });

    revalidatePath("/dashboard/admin/payroll");
    revalidatePath("/dashboard");
    return { success: true, employee };
  } catch (error) {
    console.error("Update daily salary error:", error);
    return { error: "Gagal memperbarui gaji harian." };
  }
}

