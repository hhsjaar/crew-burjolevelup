import { getAllShifts } from "@/actions/shifts";
import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import ShiftsManager from "./ShiftsManager";
import { CalendarRange } from "lucide-react";

export default async function AdminShiftsPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const shifts = await getAllShifts();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-zinc-400" />
          <span>Manajemen Shift Kerja Burjolevelup</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          Kelola parameter shift kerja operasional karyawan. Tambah shift baru, nonaktifkan shift yang tidak digunakan, atau ubah jam masuk toleransi presensi resmi.
        </p>
      </div>

      {/* Interactive Manager Panel */}
      <ShiftsManager initialShifts={shifts as any[]} />
    </div>
  );
}
