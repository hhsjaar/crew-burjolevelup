import { getAllEmployeesAdmin } from "@/actions/users";
import { getSession } from "@/lib/jwt";
import { redirect } from "next/navigation";
import UsersManager from "./UsersManager";
import { Users } from "lucide-react";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const employees = await getAllEmployeesAdmin();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-zinc-400" />
          <span>Manajemen Pengguna Burjolevelup</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          Kelola seluruh akun operasional karyawan (Hamam, Yogi, Rian) dan owner. Tambah karyawan baru, sesuaikan gaji pokok, atau perbarui kata sandi secara berkala.
        </p>
      </div>

      {/* Interactive Manager Panel */}
      <UsersManager initialEmployees={employees} currentUserId={session.id} />
    </div>
  );
}
