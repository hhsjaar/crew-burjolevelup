"use client";

import { useState, useTransition } from "react";
import {
  adminCreateEmployee,
  adminUpdateEmployee,
  adminDeleteEmployee,
} from "@/actions/users";
import {
  Search,
  UserPlus,
  Edit2,
  Trash2,
  X,
  Shield,
  User,
  DollarSign,
  Briefcase,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  email: string;
  name: string;
  role: string;
  dailySalary: number;
  createdAt: Date;
}

interface UsersManagerProps {
  initialEmployees: Employee[];
  currentUserId: string;
}

export default function UsersManager({
  initialEmployees,
  currentUserId,
}: UsersManagerProps) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected employee for Edit / Delete operations
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Currency Formatter
  const formatIDR = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Filtered employees list based on search
  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const res = await adminCreateEmployee(formData);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Akun karyawan baru berhasil dibuat!");
          setIsAddOpen(false);
          // Refresh list by inserting locally (we also revalidated the path)
          const newEmail = formData.get("email") as string;
          const newName = formData.get("name") as string;
          const newRole = formData.get("role") as string;
          const newSalary = parseFloat(formData.get("dailySalary") as string) || 100000;
          
          setEmployees((prev) => [
            ...prev,
            {
              id: Math.random().toString(), // Temp local ID, revalidation will sync with DB anyway
              email: newEmail,
              name: newName,
              role: newRole,
              dailySalary: newSalary,
              createdAt: new Date(),
            },
          ]);
        }
      } catch (err) {
        toast.error("Terjadi kesalahan sistem saat membuat akun.");
      }
    });
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    const formData = new FormData(e.currentTarget);
    formData.append("id", selectedEmployee.id);

    startTransition(async () => {
      try {
        const res = await adminUpdateEmployee(formData);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Akun berhasil diperbarui!");
          setIsEditOpen(false);
          // Update locally
          const updatedEmail = formData.get("email") as string;
          const updatedName = formData.get("name") as string;
          const updatedRole = formData.get("role") as string;
          const updatedSalary = parseFloat(formData.get("dailySalary") as string) || 100000;

          setEmployees((prev) =>
            prev.map((emp) =>
              emp.id === selectedEmployee.id
                ? {
                    ...emp,
                    email: updatedEmail,
                    name: updatedName,
                    role: updatedRole,
                    dailySalary: updatedSalary,
                  }
                : emp
            )
          );
        }
      } catch (err) {
        toast.error("Terjadi kesalahan sistem saat memperbarui akun.");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!selectedEmployee) return;

    startTransition(async () => {
      try {
        const res = await adminDeleteEmployee(selectedEmployee.id);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Akun berhasil dihapus permanent!");
          setIsDeleteOpen(false);
          setEmployees((prev) => prev.filter((emp) => emp.id !== selectedEmployee.id));
        }
      } catch (err) {
        toast.error("Gagal menghapus akun. Terjadi masalah database.");
      }
    });
  };

  const openEditModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsEditOpen(true);
  };

  const openDeleteModal = (emp: Employee) => {
    setSelectedEmployee(emp);
    setIsDeleteOpen(true);
  };

  return (
    <div className="space-y-5">
      {/* Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl">
        <div className="relative w-full sm:max-w-xs">
          <Search className="w-4 h-4 text-zinc-550 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari ID atau nama..."
            className="w-full pl-9 pr-4 py-2 rounded-lg glass-input text-xs"
          />
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="w-full sm:w-auto py-2 px-4 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah User</span>
        </button>
      </div>

      {/* Employees Table Grid */}
      <div className="glass-panel border border-zinc-900 rounded-xl overflow-hidden">
        {filteredEmployees.length === 0 ? (
          <div className="py-16 text-center text-zinc-550 text-xs">
            Tidak ada pengguna ditemukan untuk pencarian "{searchQuery}"
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[9px] bg-zinc-950/20">
                  <th className="py-3 px-4">Nama Lengkap</th>
                  <th className="py-3 px-4">ID / Username</th>
                  <th className="py-3 px-4 text-center">Hak Akses</th>
                  <th className="py-3 px-4 text-right">Gaji Harian</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map((emp) => (
                  <tr
                    key={emp.id}
                    className="border-b border-zinc-950 hover:bg-zinc-950/25 transition-colors font-medium text-zinc-300"
                  >
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {emp.name}
                      {emp.id === currentUserId && (
                        <span className="ml-2 text-[8px] bg-white/10 text-white border border-white/20 px-1.5 py-0.5 rounded-full uppercase font-extrabold">
                          Anda
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-450">{emp.email}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border ${
                          emp.role === "ADMIN"
                            ? "bg-white/5 text-white border-white/20"
                            : "bg-zinc-900/60 text-zinc-400 border-zinc-800"
                        }`}
                      >
                        {emp.role === "ADMIN" ? (
                          <>
                            <Shield className="w-2.5 h-2.5" />
                            Owner
                          </>
                        ) : (
                          <>
                            <User className="w-2.5 h-2.5" />
                            Karyawan
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-semibold text-zinc-200">
                      {formatIDR(emp.dailySalary)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(emp)}
                          className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Edit User"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(emp)}
                          disabled={emp.id === currentUserId}
                          className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-red-950/40 text-zinc-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                          title="Hapus User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* --------------------------------------------- */}
      {/* MODAL: TAMBAH USER */}
      {/* --------------------------------------------- */}
      {isAddOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setIsAddOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Daftarkan Akun Baru
                </h3>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Contoh: Rian Anggara"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    ID Pengguna / Username
                  </label>
                  <input
                    type="text"
                    name="email"
                    required
                    placeholder="Contoh: rian (gunakan huruf kecil tanpa spasi)"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs text-zinc-200"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Kata Sandi Awal
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    placeholder="Minimal 4 karakter"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      Hak Akses / Role
                    </label>
                    <select
                      name="role"
                      defaultValue="EMPLOYEE"
                      className="w-full px-3 py-2.5 rounded-lg glass-input text-xs appearance-none"
                    >
                      <option value="EMPLOYEE">Karyawan</option>
                      <option value="ADMIN">Owner (Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      Gaji Harian (Rp)
                    </label>
                    <input
                      type="number"
                      name="dailySalary"
                      defaultValue={100000}
                      className="w-full px-3 py-2.5 rounded-lg glass-input text-xs text-zinc-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer mt-4 flex items-center justify-center gap-2"
                >
                  {isPending ? "Menyimpan data..." : "Simpan Akun Karyawan"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------- */}
      {/* MODAL: EDIT USER */}
      {/* --------------------------------------------- */}
      {isEditOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl relative">
            <button
              onClick={() => setIsEditOpen(false)}
              className="absolute right-4 top-4 p-1 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Edit Profil & Kredensial
                </h3>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={selectedEmployee.name}
                    placeholder="Contoh: Rian Anggara"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    ID Pengguna / Username
                  </label>
                  <input
                    type="text"
                    name="email"
                    required
                    defaultValue={selectedEmployee.email}
                    placeholder="Contoh: rian"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs text-zinc-200"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                      Kata Sandi Baru
                    </label>
                    <span className="text-[8px] font-bold text-zinc-650 tracking-wider">
                      (KOSONGKAN JIKA TIDAK INGIN DIUBAH)
                    </span>
                  </div>
                  <input
                    type="password"
                    name="password"
                    placeholder="Masukkan sandi baru jika ingin diubah"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      Hak Akses / Role
                    </label>
                    <select
                      name="role"
                      defaultValue={selectedEmployee.role}
                      disabled={selectedEmployee.id === currentUserId}
                      className="w-full px-3 py-2.5 rounded-lg glass-input text-xs appearance-none disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <option value="EMPLOYEE">Karyawan</option>
                      <option value="ADMIN">Owner (Admin)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      Gaji Harian (Rp)
                    </label>
                    <input
                      type="number"
                      name="dailySalary"
                      defaultValue={selectedEmployee.dailySalary}
                      className="w-full px-3 py-2.5 rounded-lg glass-input text-xs text-zinc-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer mt-4 flex items-center justify-center gap-2"
                >
                  {isPending ? "Memproses perubahan..." : "Simpan Perubahan"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------- */}
      {/* MODAL: DELETE USER (CONFIRMATION) */}
      {/* --------------------------------------------- */}
      {isDeleteOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl relative p-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Hapus Akun Karyawan?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Apakah Anda benar-benar yakin ingin menghapus akun{" "}
                <span className="text-white font-bold">"{selectedEmployee.name}"</span> (ID:{" "}
                <span className="font-mono text-white">{selectedEmployee.email}</span>)?
                Tindakan ini permanen dan akan menghapus seluruh data presensi serta jobdesk terkait.
              </p>
            </div>

            <div className="flex gap-3.5 pt-2">
              <button
                onClick={() => setIsDeleteOpen(false)}
                className="flex-1 py-2 rounded-lg border border-zinc-900 hover:bg-zinc-900 text-zinc-400 hover:text-white text-xs font-semibold transition-all cursor-pointer text-center"
              >
                Batalkan
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isPending}
                className="flex-1 py-2 rounded-lg bg-red-650 hover:bg-red-650 text-white text-xs font-semibold transition-all cursor-pointer text-center"
              >
                {isPending ? "Menghapus..." : "Ya, Hapus Permanen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
