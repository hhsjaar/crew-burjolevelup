"use server";

import { db } from "@/lib/db";
import { getSession } from "@/lib/jwt";
import { revalidatePath } from "next/cache";

// Guard helper to ensure only ADMINs can execute writing actions
async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Akses ditolak. Hanya owner yang memiliki otorisasi.");
  }
  return session;
}

export async function getRoutineJobdesks(shiftId: string) {
  try {
    const jobdesks = await db.shiftJobdesk.findMany({
      where: { shiftId },
      orderBy: { createdAt: "asc" },
    });
    return jobdesks;
  } catch (error) {
    console.error("Error fetching routine jobdesks:", error);
    return [];
  }
}

export async function createRoutineJobdesk(shiftId: string, title: string, description?: string) {
  try {
    await requireAdmin();

    if (!shiftId) return { error: "Shift ID wajib diisi." };
    if (!title || !title.trim()) return { error: "Judul jobdesk wajib diisi." };

    const jobdesk = await db.shiftJobdesk.create({
      data: {
        shiftId,
        title: title.trim(),
        description: description?.trim() || null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/routine-jobdesk");
    return { success: true, jobdesk };
  } catch (error: any) {
    console.error("Error creating routine jobdesk:", error);
    return { error: error.message || "Gagal membuat jobdesk rutin." };
  }
}

export async function updateRoutineJobdesk(id: string, title: string, description?: string) {
  try {
    await requireAdmin();

    if (!id) return { error: "ID jobdesk wajib diisi." };
    if (!title || !title.trim()) return { error: "Judul jobdesk wajib diisi." };

    const jobdesk = await db.shiftJobdesk.update({
      where: { id },
      data: {
        title: title.trim(),
        description: description?.trim() || null,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/routine-jobdesk");
    return { success: true, jobdesk };
  } catch (error: any) {
    console.error("Error updating routine jobdesk:", error);
    return { error: error.message || "Gagal memperbarui jobdesk rutin." };
  }
}

export async function deleteRoutineJobdesk(id: string) {
  try {
    await requireAdmin();

    if (!id) return { error: "ID jobdesk wajib diisi." };

    await db.shiftJobdesk.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/routine-jobdesk");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting routine jobdesk:", error);
    return { error: error.message || "Gagal menghapus jobdesk rutin." };
  }
}
