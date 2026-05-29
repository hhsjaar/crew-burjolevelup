import { getCurrentEmployee } from "@/actions/auth";
import { getTodayAttendance, getAllTodayAttendance } from "@/actions/attendance";
import { getEmployeeTasks, getAllTasksWithEmployees, getClaimableTasks } from "@/actions/tasks";
import { getEmployeeLeaveRequests, getAllLeaveRequests } from "@/actions/leave";
import { getEmployeePrivateNotes } from "@/actions/notes";
import AttendanceCard from "@/components/AttendanceCard";
import PrivateNotesSection from "@/components/PrivateNotesSection";
import CalendarDashboard from "@/components/CalendarDashboard";
import AdminLiveAttendance from "@/components/AdminLiveAttendance";
import {
  Clock,
  Briefcase,
  AlertCircle,
  FileText,
  UserCheck,
  CheckCircle,
  TrendingUp,
  PlusCircle,
  DollarSign,
  ArrowUpRight,
  Sparkles,
  MapPin,
  Calendar,
  Users,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";

export default async function DashboardPage() {
  const user = await getCurrentEmployee();
  if (!user) redirect("/login");

  const todayStr = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isEmployee = user.role === "EMPLOYEE";

  if (isEmployee) {
    // ---------------------------------------------
    // EMPLOYEE DASHBOARD LOGIC
    // ---------------------------------------------
    const attendance = await getTodayAttendance(user.id);
    
    // Fetch all personal routine tasks with employee relation
    const tasks = await db.task.findMany({
      where: { employeeId: user.id },
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

    const leaves = await getEmployeeLeaveRequests(user.id);
    const privateNotes = await getEmployeePrivateNotes(user.id);

    // Fetch all claimable FCFS tasks
    const claimableTasks = await db.task.findMany({
      where: {
        isClaimable: true,
        employeeId: null,
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

    const pendingTasks = tasks.filter((t) => t.status === "PENDING").length;
    const activeTasks = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
    const approvedLeaves = leaves.filter((l) => l.status === "APPROVED").length;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="p-6 glass-panel rounded-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              Halo, {user.name.split(" ")[0]}! <Sparkles className="w-5 h-5 text-zinc-400" />
            </h1>
            <p className="text-zinc-500 text-xs font-medium">
              Hari ini adalah <span className="text-zinc-300 font-semibold">{todayStr}</span>. Mari tuntaskan tugas operasional dengan disiplin tinggi!
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-zinc-950 px-3.5 py-2 rounded-lg border border-zinc-900 self-start sm:self-auto text-zinc-400">
            <Clock className="w-4.5 h-4.5 animate-pulse text-zinc-300" />
            <span className="font-semibold text-xs text-zinc-300 tracking-tight">WIB (GMT+7)</span>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Status Absensi Card */}
          <div className="glass-panel p-5 rounded-xl border-l-2 border-l-white flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status Presensi</p>
                <h3 className="text-xs font-bold mt-2 text-zinc-200">
                  {!attendance ? "Belum Masuk" : "Sudah Absen"}
                </h3>
              </div>
              <div className="p-2.5 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            {attendance && (
              <p className="text-[10px] text-zinc-400 mt-3 flex items-center gap-1">
                <Clock className="w-3 h-3 text-zinc-500" />
                <span>Masuk: {new Date(attendance.clockIn).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
              </p>
            )}
          </div>

          {/* Pending Tasks Card */}
          <div className="glass-panel p-5 rounded-xl border-l-2 border-l-zinc-700 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tugas Pending</p>
                <h3 className="text-lg font-bold text-zinc-200 mt-2">{pendingTasks}</h3>
              </div>
              <div className="p-2.5 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3">{activeTasks} sedang dikerjakan</p>
          </div>

          {/* Completed Tasks Card */}
          <div className="glass-panel p-5 rounded-xl border-l-2 border-l-zinc-500 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tugas Selesai</p>
                <h3 className="text-lg font-bold text-zinc-200 mt-2">{completedTasks}</h3>
              </div>
              <div className="p-2.5 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800">
                <CheckCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3 flex items-center gap-1 font-semibold">
              <TrendingUp className="w-3 h-3 text-zinc-400" /> Kinerja operasional optimal
            </p>
          </div>

          {/* Leave Card */}
          <div className="glass-panel p-5 rounded-xl border-l-2 border-l-zinc-300 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Izin Disetujui</p>
                <h3 className="text-lg font-bold text-zinc-200 mt-2">{approvedLeaves}</h3>
              </div>
              <div className="p-2.5 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3">Dari total {leaves.length} permohonan</p>
          </div>
        </div>

        {/* GEOLOCATION ATTENDANCE Presensi */}
        <div className="grid grid-cols-1 gap-6">
          <AttendanceCard attendance={attendance} employeeId={user.id} />
        </div>

        {/* 30-DAY GOOGLE CALENDAR & JOBDESK INTERACTION */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zinc-400" />
            <h2 className="font-semibold text-base text-white">Kalender Kerja & Jobdesk Operasional</h2>
          </div>
          <CalendarDashboard
            tasks={tasks}
            claimableTasks={claimableTasks}
            isAdmin={false}
            userId={user.id}
          />
        </div>

        {/* Private Notes Section */}
        <PrivateNotesSection initialNotes={privateNotes} isAdmin={false} />
      </div>
    );
  } else {
    // ---------------------------------------------
    // ADMIN DASHBOARD LOGIC (OWNER)
    // ---------------------------------------------
    const todayAttendances = await getAllTodayAttendance();

    // Admin fetches all tasks with employee details
    const allTasks = await db.task.findMany({
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

    const allLeaves = await getAllLeaveRequests();
    const allEmployees = await db.employee.findMany({
      where: { role: "EMPLOYEE" },
      select: {
        id: true,
        name: true,
        email: true,
      },
      orderBy: { name: "asc" },
    });
    const privateNotes = await getEmployeePrivateNotes(); // gets all for admin

    const totalPresent = todayAttendances.length;
    const totalLeave = todayAttendances.filter((a) => a.status === "LEAVE").length;
    const pendingLeavesCount = allLeaves.filter((l) => l.status === "PENDING").length;

    return (
      <div className="space-y-6 animate-fade-in">
        {/* Welcome Section */}
        <div className="p-6 glass-panel rounded-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
              Portal Owner & Administrator ⚡
            </h1>
            <p className="text-zinc-500 text-xs font-medium">
              Hari ini adalah <span className="text-zinc-300 font-semibold">{todayStr}</span>. Pantau dan kelola seluruh kehadiran, jobdesk karyawan, dan administrasi utang.
            </p>
          </div>
          <div className="flex items-center gap-2.5 bg-zinc-950 px-3.5 py-2 rounded-lg border border-zinc-900 self-start sm:self-auto text-zinc-400">
            <Clock className="w-4.5 h-4.5 animate-pulse text-zinc-300" />
            <span className="font-semibold text-xs text-zinc-300 tracking-tight">WIB (GMT+7)</span>
          </div>
        </div>

        {/* Quick Admin Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Total Hadir */}
          <div className="glass-panel p-5 rounded-xl border-l-2 border-l-white flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Hadir Hari Ini</p>
                <h3 className="text-lg font-bold text-zinc-200 mt-2">{totalPresent} Orang</h3>
              </div>
              <div className="p-2.5 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800">
                <UserCheck className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3">Karyawan tercatat melakukan presensi hari ini</p>
          </div>

          {/* Izin/Cuti */}
          <div className="glass-panel p-5 rounded-xl border-l-2 border-l-zinc-500 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Izin Hari Ini</p>
                <h3 className="text-lg font-bold text-zinc-200 mt-2">{totalLeave} Orang</h3>
              </div>
              <div className="p-2.5 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3">
              <span className="font-bold text-white">{pendingLeavesCount} pengajuan cuti</span> pending
            </p>
          </div>

          {/* Total Jobdesk Aktif */}
          <div className="glass-panel p-5 rounded-xl border-l-2 border-l-zinc-300 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Tugas Aktif</p>
                <h3 className="text-lg font-bold text-zinc-200 mt-2">
                  {allTasks.filter((t) => t.status === "IN_PROGRESS").length} Tugas
                </h3>
              </div>
              <div className="p-2.5 bg-zinc-900 rounded-lg text-zinc-400 border border-zinc-800">
                <Briefcase className="w-4 h-4" />
              </div>
            </div>
            <p className="text-[10px] text-zinc-500 mt-3 font-semibold">
              Dari total {allTasks.length} tugas terdaftar
            </p>
          </div>
        </div>

        {/* 30-DAY GOOGLE CALENDAR FOR OWNER CHECKLISTS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-zinc-400" />
            <h2 className="font-semibold text-base text-white">Kalender Kerja & Checklist Owner</h2>
          </div>
          <CalendarDashboard
            tasks={allTasks}
            claimableTasks={[]}
            isAdmin={true}
            userId={user.id}
          />
        </div>


        {/* Action and Table Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Actions Panel */}
          <div className="glass-panel p-6 rounded-xl border border-zinc-900 flex flex-col gap-3.5">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4.5 h-4.5 text-zinc-400" />
              <h2 className="font-semibold text-sm text-white">Aksi Cepat Admin</h2>
            </div>

            <Link
              href="/dashboard/jobdesk"
              className="p-3.5 rounded-lg bg-zinc-950/40 hover:bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 flex items-center gap-3.5 transition-all group"
            >
              <div className="p-2 bg-zinc-900 text-white rounded-md border border-zinc-800 group-hover:scale-105 transition-transform">
                <PlusCircle className="w-4.5 h-4.5" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-xs text-zinc-200">Buat Jobdesk Baru</p>
                <p className="text-[9px] text-zinc-500 truncate mt-0.5">Berikan tugas rutin (harian/mingguan/bulanan)</p>
              </div>
            </Link>

            <Link
              href="/dashboard/admin/users"
              className="p-3.5 rounded-lg bg-zinc-950/40 hover:bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 flex items-center gap-3.5 transition-all group"
            >
              <div className="p-2 bg-zinc-900 text-white rounded-md border border-zinc-800 group-hover:scale-105 transition-transform">
                <Users className="w-4.5 h-4.5" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-xs text-zinc-200">Kelola Karyawan & Gaji</p>
                <p className="text-[9px] text-zinc-500 truncate mt-0.5">Tambah user baru, edit username, atau reset sandi</p>
              </div>
            </Link>

            <Link
              href="/dashboard/leave"
              className="p-3.5 rounded-lg bg-zinc-950/40 hover:bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 flex items-center gap-3.5 transition-all group"
            >
              <div className="p-2 bg-zinc-900 text-white rounded-md border border-zinc-800 group-hover:scale-105 transition-transform">
                <FileText className="w-4.5 h-4.5" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-xs text-zinc-200">Persetujuan Izin & Cuti ({pendingLeavesCount})</p>
                <p className="text-[9px] text-zinc-500 truncate mt-0.5">Tinjau, setujui atau tolak izin sakit karyawan</p>
              </div>
            </Link>

            <Link
              href="/dashboard/admin/payroll"
              className="p-3.5 rounded-lg bg-zinc-950/40 hover:bg-zinc-900/40 border border-zinc-900 hover:border-zinc-800 flex items-center gap-3.5 transition-all group"
            >
              <div className="p-2 bg-zinc-900 text-white rounded-md border border-zinc-800 group-hover:scale-105 transition-transform">
                <DollarSign className="w-4.5 h-4.5" />
              </div>
              <div className="text-left min-w-0">
                <p className="font-semibold text-xs text-zinc-200">Rekap Gaji & Absensi</p>
                <p className="text-[9px] text-zinc-500 truncate mt-0.5">Audit selfie karyawan, lokasi GPS, dan slip gaji</p>
              </div>
            </Link>
          </div>

          {/* Today's Presence Live Monitor */}
          <AdminLiveAttendance todayAttendances={todayAttendances} />
        </div>

        {/* Private Notes Administration */}
        <PrivateNotesSection initialNotes={privateNotes} employees={allEmployees} isAdmin={true} />
      </div>
    );
  }
}
