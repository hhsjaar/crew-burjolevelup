"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { setSession, clearSession, getSession } from "@/lib/jwt";
import { revalidatePath } from "next/cache";

export async function login(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  console.log("[AUTH ACTION] Login attempt for email/username:", email);

  if (!email || !password) {
    console.log("[AUTH ACTION] Missing email or password");
    return { error: "Email dan password wajib diisi." };
  }

  try {
    const employee = await db.employee.findUnique({
      where: { email },
    });

    if (!employee) {
      console.log("[AUTH ACTION] Employee not found in DB for email:", email);
      return { error: "Email atau password salah." };
    }

    console.log("[AUTH ACTION] Found employee:", employee.name, "with role:", employee.role);

    const isPasswordValid = await bcrypt.compare(password, employee.password);
    if (!isPasswordValid) {
      console.log("[AUTH ACTION] Password comparison failed for:", email);
      return { error: "Email atau password salah." };
    }

    console.log("[AUTH ACTION] Password is valid. Setting session...");

    // Set JWT Session
    await setSession({
      id: employee.id,
      email: employee.email,
      name: employee.name,
      role: employee.role,
    });

    console.log("[AUTH ACTION] Session cookie set successfully for:", employee.name);

    revalidatePath("/dashboard");
    return { success: true, role: employee.role };
  } catch (error: any) {
    console.error("[AUTH ACTION] Login error:", error);
    return { error: "Terjadi kesalahan sistem. Silakan coba lagi." };
  }
}

export async function register(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const name = formData.get("name") as string;
  const roleInput = formData.get("role") as string; // ADMIN / EMPLOYEE

  if (!email || !password || !name) {
    return { error: "Semua field wajib diisi." };
  }

  try {
    const existingEmployee = await db.employee.findUnique({
      where: { email },
    });

    if (existingEmployee) {
      return { error: "Email sudah terdaftar." };
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const role = roleInput === "ADMIN" ? "ADMIN" : "EMPLOYEE";

    await db.employee.create({
      data: {
        email,
        password: hashedPassword,
        name,
        role: role as any,
      },
    });

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: any) {
    console.error("Registration error:", error);
    return { error: "Gagal mendaftarkan karyawan baru." };
  }
}

export async function logout() {
  await clearSession();
  revalidatePath("/");
  return { success: true };
}

export async function getCurrentEmployee() {
  const session = await getSession();
  if (!session) return null;

  try {
    const employee = await db.employee.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        dailySalary: true,
        createdAt: true,
      },
    });
    return employee;
  } catch (error) {
    return null;
  }
}
