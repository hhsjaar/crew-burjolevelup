"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/jwt";
import { revalidatePath } from "next/cache";

// Guard helper to ensure only ADMINs can execute these actions
async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Akses ditolak. Hanya owner yang memiliki otorisasi.");
  }
  return session;
}

export async function getAllShifts() {
  try {
    const shifts = await db.shift.findMany({
      orderBy: {
        startTime: "asc",
      },
    });
    return shifts;
  } catch (error) {
    console.error("Error fetching shifts:", error);
    return [];
  }
}

export async function adminCreateShift(formData: FormData) {
  await requireAdmin();

  const name = (formData.get("name") as string)?.trim();
  const startTime = (formData.get("startTime") as string)?.trim();

  if (!name || !startTime) {
    return { error: "Nama shift dan Jam masuk wajib diisi." };
  }

  // Time format regex validation (HH:mm)
  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    return { error: "Format jam masuk tidak valid. Gunakan format HH:MM (contoh: 09:00)." };
  }

  try {
    const shift = await db.shift.create({
      data: {
        name,
        startTime,
        isActive: true,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/shifts");
    return { success: true, shift };
  } catch (error) {
    console.error("Error creating shift:", error);
    return { error: "Gagal membuat shift baru." };
  }
}

export async function adminUpdateShift(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const name = (formData.get("name") as string)?.trim();
  const startTime = (formData.get("startTime") as string)?.trim();
  const isActiveInput = formData.get("isActive") as string; // "true" or "false"

  if (!id || !name || !startTime) {
    return { error: "ID, Nama shift, dan Jam masuk wajib diisi." };
  }

  if (!/^\d{2}:\d{2}$/.test(startTime)) {
    return { error: "Format jam masuk tidak valid. Gunakan format HH:MM (contoh: 09:00)." };
  }

  const isActive = isActiveInput === "true";

  try {
    const shift = await db.shift.update({
      where: { id },
      data: {
        name,
        startTime,
        isActive,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/shifts");
    return { success: true, shift };
  } catch (error) {
    console.error("Error updating shift:", error);
    return { error: "Gagal memperbarui data shift." };
  }
}

export async function adminDeleteShift(id: string) {
  await requireAdmin();

  if (!id) {
    return { error: "ID shift wajib diberikan." };
  }

  try {
    // Check if there are any attendances linked to this shift
    const attendanceCount = await db.attendance.count({
      where: { shiftId: id },
    });

    if (attendanceCount > 0) {
      // Soft-delete or prevent delete?
      // Since it has history, it is better to set isActive = false or let admin delete it but cascade.
      // Wait, let's warn that it has attendance history, or we can delete it anyway. Let's prevent hard delete if it has attendance history.
      return { error: "Tidak dapat menghapus shift ini karena memiliki riwayat absensi. Anda bisa menonaktifkannya saja." };
    }

    await db.shift.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/shifts");
    return { success: true };
  } catch (error) {
    console.error("Error deleting shift:", error);
    return { error: "Gagal menghapus shift." };
  }
}
