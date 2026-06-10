import { getCurrentEmployee } from "@/actions/auth";
import { getAllShifts } from "@/actions/shifts";
import { redirect } from "next/navigation";
import { ClipboardList } from "lucide-react";
import RoutineJobdeskManager from "@/components/RoutineJobdeskManager";

export default async function RoutineJobdeskPage() {
  const user = await getCurrentEmployee();
  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  // Ambil semua shift yang tersedia untuk dikelola
  const shifts = await getAllShifts();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-zinc-400" />
          <span>Jobdesk Shift Rutin</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          Kelola jobdesk/tugas rutin default untuk setiap shift. Ketika karyawan melakukan absensi masuk ke shift terkait, mereka akan otomatis mendapatkan semua daftar tugas ini di halaman Jobdesk Kerja mereka hari ini.
        </p>
      </div>

      {/* Interactive Shifts and Jobdesks Manager */}
      <RoutineJobdeskManager shifts={shifts as any[]} />
    </div>
  );
}
