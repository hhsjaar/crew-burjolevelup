import { getCurrentEmployee } from "@/actions/auth";
import { getEmployeeAttendanceHistory } from "@/actions/attendance";
import { db } from "@/lib/db";
import { CalendarCheck, Clock, Calendar } from "lucide-react";
import { redirect } from "next/navigation";
import AdminAttendanceCalendar from "@/components/AdminAttendanceCalendar";

export default async function AttendancePage() {
  const user = await getCurrentEmployee();
  if (!user) redirect("/login");

  const isEmployee = user.role === "EMPLOYEE";

  // Fetch appropriate records
  const history = isEmployee
    ? await getEmployeeAttendanceHistory(user.id)
    : await db.attendance.findMany({
      include: {
        employee: {
          select: {
            name: true,
            email: true,
          }
        }
      },
      orderBy: { clockIn: "desc" }
    });

  const totalDays = history.length;
  const leaveDays = history.filter(h => h.status === "LEAVE").length;
  const attendanceDays = totalDays - leaveDays;

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-3">
          <CalendarCheck className="w-6 h-6 text-zinc-400" />
          <span>Riwayat Absensi Kehadiran</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          {isEmployee
            ? "Tinjau riwayat rekam clock-in dan clock-out harian Anda beserta memo catatan kehadiran resmi."
            : "Audit rekam kehadiran, foto selfie, koordinat GPS Google Maps, dan memo dari seluruh karyawan terdaftar."}
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-zinc-900 text-center">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Hari Tercatat</p>
          <p className="text-xl font-bold text-zinc-200 mt-1.5">{totalDays}</p>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-zinc-900 text-center">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-zinc-300">Total Kehadiran</p>
          <p className="text-xl font-bold text-zinc-200 mt-1.5">{attendanceDays}</p>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-zinc-900 text-center">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest text-zinc-400">Izin / Cuti</p>
          <p className="text-xl font-bold text-zinc-400 mt-1.5">{leaveDays}</p>
        </div>
      </div>

      {/* Conditional View: Employee Table vs Admin Interactive Calendar */}
      {isEmployee ? (
        <div className="glass-panel p-5 rounded-xl border border-zinc-900">
          <div className="flex items-center gap-2 mb-6">
            <Calendar className="w-5 h-5 text-zinc-400" />
            <h2 className="font-semibold text-sm text-white">
              Daftar Absensi Anda
            </h2>
          </div>

          {history.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs italic">
              Tidak ada riwayat rekam kehadiran ditemukan dalam database.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[9px]">
                    <th className="py-2.5 px-4">Tanggal Kerja</th>
                    <th className="py-2.5 px-4">Jam Masuk (Clock-In)</th>
                    <th className="py-2.5 px-4">Jam Pulang (Clock-Out)</th>
                    <th className="py-2.5 px-4 max-w-xs">Catatan & Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((record: any) => (
                    <tr key={record.id} className="border-b border-zinc-950 hover:bg-zinc-950/20 transition-colors duration-150">
                      <td className="py-4 px-4 font-bold text-zinc-350">
                        {new Date(record.date).toLocaleDateString("id-ID", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td className="py-4 px-4 font-semibold text-zinc-200 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-600" />
                        {record.clockIn ? new Date(record.clockIn).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) : "-- : --"}
                      </td>
                      <td className="py-4 px-4 font-semibold text-zinc-400">
                        {record.clockOut ? new Date(record.clockOut).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) : "-- : --"}
                      </td>
                      <td className="py-4 px-4 text-zinc-400 italic max-w-xs truncate">
                        {record.notes || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zinc-400" />
            <h2 className="font-semibold text-sm text-white">Kalender & Monitor Kehadiran Karyawan</h2>
          </div>
          <AdminAttendanceCalendar allAttendances={history as any[]} />
        </div>
      )}
    </div>
  );
}
