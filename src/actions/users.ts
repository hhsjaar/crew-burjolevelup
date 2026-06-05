"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { getSession } from "@/lib/jwt";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";

// Guard helper to ensure only ADMINs can execute these actions
async function requireAdmin() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    throw new Error("Akses ditolak. Hanya owner yang memiliki otorisasi.");
  }
  return session;
}

export async function getAllEmployeesAdmin() {
  await requireAdmin();

  try {
    const employees = await db.employee.findMany({
      select: {
        id: true,
        email: true, // Acts as Username / ID
        name: true,
        role: true,
        dailySalary: true,
        phone: true,
        createdAt: true,
      },
      orderBy: [
        { role: "asc" }, // Admins first
        { name: "asc" },
      ],
    });
    return employees;
  } catch (error) {
    console.error("Error fetching employees:", error);
    return [];
  }
}

export async function adminCreateEmployee(formData: FormData) {
  await requireAdmin();

  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const name = (formData.get("name") as string)?.trim();
  const roleInput = formData.get("role") as string; // ADMIN or EMPLOYEE
  const dailySalaryInput = formData.get("dailySalary") as string;
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!email || !password || !name) {
    return { error: "ID Pengguna, Kata Sandi, dan Nama wajib diisi." };
  }

  try {
    const existing = await db.employee.findUnique({
      where: { email },
    });

    if (existing) {
      return { error: `ID Pengguna "${email}" sudah digunakan.` };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = roleInput === "ADMIN" ? Role.ADMIN : Role.EMPLOYEE;
    const dailySalary = parseFloat(dailySalaryInput) || 100000;

    await db.employee.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role,
        dailySalary,
        phone,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("Error creating employee:", error);
    return { error: "Gagal membuat akun karyawan baru." };
  }
}

export async function adminUpdateEmployee(formData: FormData) {
  await requireAdmin();

  const id = formData.get("id") as string;
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string; // Optional
  const name = (formData.get("name") as string)?.trim();
  const roleInput = formData.get("role") as string;
  const dailySalaryInput = formData.get("dailySalary") as string;
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!id || !email || !name) {
    return { error: "ID, ID Pengguna, dan Nama wajib diisi." };
  }

  try {
    // Check if another user already has this email
    const existing = await db.employee.findFirst({
      where: {
        email,
        id: { not: id },
      },
    });

    if (existing) {
      return { error: `ID Pengguna "${email}" sudah digunakan oleh akun lain.` };
    }

    const role = roleInput === "ADMIN" ? Role.ADMIN : Role.EMPLOYEE;
    const dailySalary = parseFloat(dailySalaryInput) || 100000;

    const data: any = {
      email,
      name,
      role,
      dailySalary,
      phone,
    };

    // If new password is provided, hash and update it
    if (password && password.trim() !== "") {
      data.password = await bcrypt.hash(password, 10);
    }

    await db.employee.update({
      where: { id },
      data,
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("Error updating employee:", error);
    return { error: "Gagal memperbarui data akun." };
  }
}

export async function adminDeleteEmployee(id: string) {
  const session = await requireAdmin();

  if (id === session.id) {
    return { error: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif." };
  }

  try {
    await db.employee.delete({
      where: { id },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/admin/users");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting employee:", error);
    return { error: "Gagal menghapus akun. Pastikan data terkait telah bersih." };
  }
}
