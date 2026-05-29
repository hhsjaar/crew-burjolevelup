"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/jwt";

export async function createPrivateNote(
  employeeId: string,
  title: string,
  content: string
) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi habis. Silakan login kembali." };
  }

  const isAdmin = session.role === "ADMIN";
  const targetEmployeeId = isAdmin ? employeeId : session.id;

  if (!targetEmployeeId) {
    return { error: "Karyawan target harus ditentukan." };
  }
  if (!title || !title.trim()) {
    return { error: "Judul catatan wajib diisi." };
  }
  if (!content || !content.trim()) {
    return { error: "Isi catatan wajib diisi." };
  }

  try {
    const note = await db.privateNote.create({
      data: {
        employeeId: targetEmployeeId,
        title: title.trim(),
        content: content.trim(),
        createdById: session.id,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notes");
    return { success: true, note };
  } catch (error) {
    console.error("Create private note error:", error);
    return { error: "Gagal membuat catatan." };
  }
}

export async function getEmployeePrivateNotes(employeeId?: string) {
  const session = await getSession();
  if (!session) return [];

  const targetId = employeeId || session.id;

  if (session.role !== "ADMIN" && targetId !== session.id) {
    return [];
  }

  try {
    const notes = await db.privateNote.findMany({
      where: { employeeId: targetId },
      include: {
        createdBy: {
          select: {
            name: true,
            role: true,
          },
        },
        employee: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return notes;
  } catch (error) {
    console.error("Get private notes error:", error);
    return [];
  }
}

export async function getAllPrivateNotesForAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];

  try {
    const notes = await db.privateNote.findMany({
      include: {
        employee: {
          select: {
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return notes;
  } catch (error) {
    console.error("Get all private notes error:", error);
    return [];
  }
}

export async function deletePrivateNote(noteId: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi habis. Silakan login kembali." };
  }

  try {
    const note = await db.privateNote.findUnique({
      where: { id: noteId },
    });

    if (!note) {
      return { error: "Catatan tidak ditemukan." };
    }

    // Only Admin or the creator of the note can delete it
    if (session.role !== "ADMIN" && note.createdById !== session.id) {
      return { error: "Akses ditolak. Anda hanya bisa menghapus catatan buatan Anda sendiri." };
    }

    await db.privateNote.delete({
      where: { id: noteId },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/notes");
    return { success: true };
  } catch (error) {
    console.error("Delete private note error:", error);
    return { error: "Gagal menghapus catatan." };
  }
}
