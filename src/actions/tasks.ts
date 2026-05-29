"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/jwt";
import { TaskType, TaskStatus } from "@prisma/client";

export async function createTask(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat membuat tugas." };
  }

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const typeInput = formData.get("type") as string; // DAILY, WEEKLY, MONTHLY
  const employeeId = formData.get("employeeId") as string || null;
  const dueDateStr = formData.get("dueDate") as string;
  const isClaimable = formData.get("isClaimable") === "true" || formData.get("isClaimable") === "on";

  if (!title || !typeInput) {
    return { error: "Judul dan tipe tugas wajib diisi." };
  }

  if (!isClaimable && !employeeId) {
    return { error: "Penerima tugas wajib ditentukan jika tugas bukan bertipe Siapa Cepat Dia Dapat." };
  }

  const type =
    typeInput === "ONCE"
      ? TaskType.ONCE
      : typeInput === "WEEKLY"
      ? TaskType.WEEKLY
      : typeInput === "MONTHLY"
      ? TaskType.MONTHLY
      : TaskType.DAILY;
  const dueDate = dueDateStr ? new Date(dueDateStr) : null;

  try {
    const task = await db.task.create({
      data: {
        title,
        description,
        type,
        status: TaskStatus.PENDING,
        employeeId: isClaimable ? null : employeeId,
        createdById: session.id,
        dueDate,
        isClaimable,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task };
  } catch (error) {
    console.error("Create task error:", error);
    return { error: "Gagal membuat tugas baru." };
  }
}

export async function updateTaskStatus(taskId: string, statusInput: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  const status =
    statusInput === "IN_PROGRESS"
      ? TaskStatus.IN_PROGRESS
      : statusInput === "COMPLETED"
      ? TaskStatus.COMPLETED
      : TaskStatus.PENDING;

  try {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: "Tugas tidak ditemukan." };

    // Admin tidak boleh menyelesaikan tugas secara langsung. Hanya penerima tugas yang boleh.
    if (session.role === "ADMIN") {
      return { error: "Akses ditolak. Owner tidak dapat menyelesaikan tugas secara langsung." };
    }

    if (task.employeeId !== session.id) {
      return { error: "Akses ditolak. Hanya penerima tugas yang dapat menyelesaikan tugas ini." };
    }

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: { status },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("Update task status error:", error);
    return { error: "Gagal memperbarui status tugas." };
  }
}

export async function claimTask(taskId: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  try {
    const task = await db.task.findUnique({ where: { id: taskId } });
    if (!task) return { error: "Tugas tidak ditemukan." };
    if (!task.isClaimable) return { error: "Tugas ini tidak dapat diklaim." };
    if (task.employeeId) return { error: "Tugas ini sudah diklaim oleh karyawan lain." };

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: {
        employeeId: session.id,
        claimedAt: new Date(),
        status: TaskStatus.IN_PROGRESS,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("Claim task error:", error);
    return { error: "Gagal mengklaim tugas." };
  }
}

export async function addTaskComment(taskId: string, content: string) {
  const session = await getSession();
  if (!session) return { error: "Sesi habis. Silakan login kembali." };

  if (!content || content.trim() === "") {
    return { error: "Catatan tidak boleh kosong." };
  }

  try {
    const comment = await db.taskComment.create({
      data: {
        taskId,
        authorId: session.id,
        content,
      },
    });

    revalidatePath("/dashboard/jobdesk");
    return { success: true, comment };
  } catch (error) {
    console.error("Add task comment error:", error);
    return { error: "Gagal menambahkan catatan." };
  }
}

export async function getTaskComments(taskId: string) {
  try {
    const comments = await db.taskComment.findMany({
      where: { taskId },
      include: {
        author: {
          select: {
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return comments;
  } catch (error) {
    console.error("Get task comments error:", error);
    return [];
  }
}

export async function deleteTask(taskId: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat menghapus tugas." };
  }

  try {
    await db.task.delete({
      where: { id: taskId },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true };
  } catch (error) {
    console.error("Delete task error:", error);
    return { error: "Gagal menghapus tugas." };
  }
}

export async function getEmployeeTasks(employeeId: string) {
  try {
    const tasks = await db.task.findMany({
      where: { employeeId },
      orderBy: { createdAt: "desc" },
    });
    return tasks;
  } catch (error) {
    return [];
  }
}

export async function getAllEmployees() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];

  try {
    const employees = await db.employee.findMany({
      where: { role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });
    return employees;
  } catch (error) {
    return [];
  }
}

export async function getAllTasksWithEmployees() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return [];

  try {
    const tasks = await db.task.findMany({
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
    return tasks;
  } catch (error) {
    return [];
  }
}

export async function getClaimableTasks() {
  try {
    const tasks = await db.task.findMany({
      where: {
        isClaimable: true,
        employeeId: null,
      },
      orderBy: { createdAt: "desc" },
    });
    return tasks;
  } catch (error) {
    return [];
  }
}

export async function deleteAllTasks(type?: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat menghapus semua tugas." };
  }

  try {
    if (type) {
      await db.task.deleteMany({
        where: { type: type as any },
      });
    } else {
      await db.task.deleteMany({});
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true };
  } catch (error) {
    console.error("Delete all tasks error:", error);
    return { error: "Gagal menghapus semua tugas." };
  }
}

export async function deleteMultipleTasks(taskIds: string[]) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat menghapus tugas terpilih." };
  }

  try {
    await db.task.deleteMany({
      where: {
        id: { in: taskIds },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true };
  } catch (error) {
    console.error("Delete multiple tasks error:", error);
    return { error: "Gagal menghapus tugas terpilih." };
  }
}

export async function excludeTaskDate(taskId: string, dateStr: string) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Akses ditolak. Hanya admin yang dapat mengecualikan tanggal tugas." };
  }

  try {
    const task = await db.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      return { error: "Tugas tidak ditemukan." };
    }

    const currentExcluded = task.excludedDates ? task.excludedDates.split(",") : [];
    if (!currentExcluded.includes(dateStr)) {
      currentExcluded.push(dateStr);
    }

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: {
        excludedDates: currentExcluded.join(","),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/jobdesk");
    return { success: true, task: updatedTask };
  } catch (error) {
    console.error("Exclude task date error:", error);
    return { error: "Gagal mengecualikan tanggal tugas." };
  }
}

