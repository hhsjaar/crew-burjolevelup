import { getCurrentEmployee } from "@/actions/auth";
import { getAllEmployees } from "@/actions/tasks";
import CalendarJobdeskManager from "@/components/CalendarJobdeskManager";
import { ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function JobdeskPage() {
  const user = await getCurrentEmployee();
  if (!user) redirect("/login");

  const isEmployee = user.role === "EMPLOYEE";

  // Fetch all tasks with database relation
  const tasks = isEmployee
    ? await db.task.findMany({
        where: { employeeId: user.id },
        include: {
          employee: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : await db.task.findMany({
        include: {
          employee: {
            select: {
              name: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

  // Fetch employees list if user is ADMIN for the assign form
  const employees = isEmployee ? [] : await getAllEmployees();

  // Fetch all claimable tasks that haven't been claimed yet
  const claimableTasks = await db.task.findMany({
    where: {
      isClaimable: true,
      employeeId: null,
    },
    include: {
      employee: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-zinc-400" />
          <span>Manajemen Jobdesk Burjolevelup</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          {isEmployee
            ? "Tinjau daftar tugas harian, mingguan, dan bulanan Anda. Gunakan laci geser samping untuk update status atau menulis catatan bersama."
            : "Definisikan, tugaskan, dan pantau seluruh status pengerjaan tugas rutin serta tugas tambahan cepat-cepatan."}
        </p>
      </div>

      {/* Primary Unified Manager */}
      <CalendarJobdeskManager
        initialTasks={tasks as any[]}
        initialClaimableTasks={claimableTasks as any[]}
        employees={employees as any[]}
        isAdmin={!isEmployee}
        userId={user.id}
      />
    </div>
  );
}
