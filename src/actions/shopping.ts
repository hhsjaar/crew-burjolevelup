"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/jwt";

export async function addShoppingItem(
  itemName: string,
  quantity: number,
  unit: string,
  notes?: string,
  employeeId?: string
) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi habis. Silakan login kembali." };
  }

  // Gunakan employeeId yang diberikan (misalnya dari voice assistant) atau fallback ke session.id
  const targetEmployeeId = employeeId || session.id;

  if (!itemName || !itemName.trim()) {
    return { error: "Nama barang wajib diisi." };
  }
  if (quantity <= 0) {
    return { error: "Jumlah barang harus lebih dari 0." };
  }
  if (!unit || !unit.trim()) {
    return { error: "Satuan barang wajib diisi." };
  }

  try {
    const shoppingItem = await db.shoppingItem.create({
      data: {
        itemName: itemName.trim(),
        quantity,
        unit: unit.trim(),
        notes: notes ? notes.trim() : null,
        employeeId: targetEmployeeId,
        status: "PENDING",
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/shopping");
    return { success: true, shoppingItem };
  } catch (error) {
    console.error("Add shopping item error:", error);
    return { error: "Gagal menambahkan barang belanjaan." };
  }
}

export async function getShoppingItems() {
  const session = await getSession();
  if (!session) return [];

  try {
    // Admin/Owner dapat melihat semua barang belanjaan, karyawan hanya miliknya sendiri
    if (session.role === "ADMIN") {
      const items = await db.shoppingItem.findMany({
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
      return items;
    } else {
      const items = await db.shoppingItem.findMany({
        where: {
          employeeId: session.id,
        },
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
      return items;
    }
  } catch (error) {
    console.error("Get shopping items error:", error);
    return [];
  }
}

export async function markAsPurchased(id: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi habis. Silakan login kembali." };
  }

  if (session.role !== "ADMIN") {
    return { error: "Hanya Admin/Owner yang dapat menandai barang sebagai dibeli." };
  }

  try {
    const item = await db.shoppingItem.update({
      where: { id },
      data: { status: "PURCHASED" },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/shopping");
    return { success: true, item };
  } catch (error) {
    console.error("Mark as purchased error:", error);
    return { error: "Gagal memperbarui status barang belanjaan." };
  }
}

export async function deleteShoppingItem(id: string) {
  const session = await getSession();
  if (!session) {
    return { error: "Sesi habis. Silakan login kembali." };
  }

  try {
    const item = await db.shoppingItem.findUnique({
      where: { id },
    });

    if (!item) {
      return { error: "Barang tidak ditemukan." };
    }

    // Admin/Owner dapat menghapus apa saja, karyawan hanya miliknya sendiri
    if (session.role !== "ADMIN" && item.employeeId !== session.id) {
      return { error: "Akses ditolak. Anda hanya dapat menghapus barang yang Anda ajukan sendiri." };
    }

    await db.shoppingItem.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/shopping");
    return { success: true };
  } catch (error) {
    console.error("Delete shopping item error:", error);
    return { error: "Gagal menghapus barang belanjaan." };
  }
}
