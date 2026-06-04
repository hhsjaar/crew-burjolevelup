import { getCurrentEmployee } from "@/actions/auth";
import { getMonthlyRecap, updateDailySalary } from "@/actions/payroll";
import AttendanceAuditTable from "@/components/AttendanceAuditTable";

import {
  DollarSign,
  Award,
  Sliders,
} from "lucide-react";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    employeeId?: string;
    dailySalary?: string;
  }>;
}) {
  const user = await getCurrentEmployee();
  if (!user || user.role !== "ADMIN") redirect("/dashboard");

  const params = await searchParams;

  // Dynamic Calculation Parameters
  const currentMonth = params.month || new Date().toISOString().split("T")[0].substring(0, 7); // Format: YYYY-MM

  // Generate list of last 12 months for dropdown selection
  const monthOptions = [];
  const start = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() - i, 1);
    const value = d.toISOString().substring(0, 7); // Format: "YYYY-MM"
    const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    monthOptions.push({ value, label });
  }

  // Fetch Month Recap
  const res = await getMonthlyRecap(currentMonth);
  const recaps = res.recaps || [];

  // Fetch all attendances for the selected month to feed into the Audit Logger
  const attendances = await db.attendance.findMany({
    where: {
      date: {
        startsWith: currentMonth,
      },
    },
    include: {
      employee: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: { date: "desc" },
  });

  // Helper to format currency
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-zinc-400" />
          <span>Rekap Kehadiran & Slip Gaji Karyawan</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          Kelola parameter operasional harian, audit foto selfie absensi beserta GPS koordinat, dan hitung besaran rekap gaji kotor terintegrasi otomatis.
        </p>

      </div>

      {/* Payroll Calculations List (Full Width) */}
      <div className="glass-panel p-5 rounded-xl border border-zinc-900 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-zinc-900">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-zinc-400" />
              <h2 className="font-bold text-sm text-white">
                Slip Gaji Karyawan - {new Date(currentMonth + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" })}
              </h2>
            </div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
              {recaps.length} Karyawan Terdaftar
            </p>
          </div>

          {/* Compact Month Selection Form */}
          <form action="" method="GET" className="flex items-center gap-2 self-start sm:self-center">
            <label className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest leading-none">
              Pilih Periode:
            </label>
            <select
              name="month"
              defaultValue={currentMonth}
              className="px-2.5 py-1.5 rounded-lg glass-input text-xs text-zinc-250 w-44 font-semibold cursor-pointer appearance-none bg-zinc-950 border border-zinc-900"
            >
              {monthOptions.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-zinc-950 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-350 hover:text-white font-bold text-[10px] uppercase cursor-pointer hover:bg-zinc-800 transition-colors"
            >
              Lihat
            </button>
          </form>
        </div>

        {recaps.length === 0 ? (
          <div className="py-12 text-center text-zinc-550 text-xs">
            Belum ada rekaman kehadiran sama sekali di bulan ini.
          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-2.5 px-3">Nama Karyawan</th>
                  <th className="py-2.5 px-3 text-center">Total Hadir</th>
                  <th className="py-2.5 px-3 text-right">Gaji Harian</th>
                  <th className="py-2.5 px-3 text-right text-white">
                    Total Gaji
                  </th>
                  <th className="py-2.5 px-3 text-center"> Edit Gaji </th>
                </tr>
              </thead>

              <tbody>
                {recaps.map((emp) => {
                  const presentDays = emp.presentDays;

                  // TOTAL GAJI
                  const totalSalary = presentDays * emp.dailySalary;
                  return (
                    <tr
                      key={emp.employeeId}
                      className="border-b border-zinc-950 hover:bg-zinc-950/20 transition-colors"
                    >
                      <td className="py-4 px-3">
                        <p className="font-bold text-zinc-200">
                          {emp.name}
                        </p>

                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {emp.email}
                        </p>
                      </td>

                      <td className="py-4 px-3 text-center">
                        <div className="flex flex-col items-center">
                          <span className="text-[10px] font-bold text-zinc-300">
                            {presentDays} Hari Kerja
                          </span>

                          <span className="text-[8px] text-zinc-550 font-bold mt-0.5 uppercase tracking-wider">
                            Absen: {emp.totalOnTime + emp.totalLate} Shift • Telat: {emp.totalLate}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-3 text-right font-semibold text-zinc-300">
                        {formatIDR(emp.dailySalary)}
                      </td>
                      <td className="py-4 px-3 text-right text-white font-bold text-xs">
                        {formatIDR(totalSalary)}
                      </td>
                      <td className="py-4 px-3 text-center">
                        <form
                          action={async (formData) => {
                            "use server";
                            const employeeId = formData.get("employeeId") as string;
                            const salary = Number(formData.get("salary"));
                            await updateDailySalary(employeeId, salary);
                          }}
                          className="flex items-center justify-center gap-2"
                        >
                          <input type="hidden" name="employeeId" value={emp.employeeId} />
                          <input
                            type="number"
                            name="salary"
                            defaultValue={emp.dailySalary}
                            className="w-24 px-2 py-1 rounded glass-input text-[10px]"
                          />
                          <button
                            type="submit"
                            className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-[10px] cursor-pointer hover:bg-zinc-800 transition-colors"
                          >
                            Set
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

          </div>
        )}
      </div>


    </div>
  );
}
