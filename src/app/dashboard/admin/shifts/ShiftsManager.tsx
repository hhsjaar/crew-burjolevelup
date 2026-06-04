"use client";

import { useState, useTransition } from "react";
import {
  adminCreateShift,
  adminUpdateShift,
  adminDeleteShift,
} from "@/actions/shifts";
import {
  Search,
  PlusCircle,
  Edit2,
  Trash2,
  X,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Shift {
  id: string;
  name: string;
  startTime: string;
  isActive: boolean;
  createdAt: Date;
}

interface ShiftsManagerProps {
  initialShifts: Shift[];
}

export default function ShiftsManager({ initialShifts }: ShiftsManagerProps) {
  const [shifts, setShifts] = useState<Shift[]>(initialShifts);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  // Modals States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected shift for Edit / Delete operations
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  // Filtered shifts list based on search
  const filteredShifts = shifts.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.startTime.includes(searchQuery)
  );

  // Handlers
  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const res = await adminCreateShift(formData);
        if (res.error) {
          toast.error(res.error);
        } else if (res.shift) {
          toast.success("Shift baru berhasil dibuat!");
          setIsAddOpen(false);
          // Insert shift locally (revalidation syncs with DB anyway)
          const newShift = res.shift as Shift;
          setShifts((prev) => [...prev, newShift].sort((a, b) => a.startTime.localeCompare(b.startTime)));
        }
      } catch (err) {
        toast.error("Terjadi kesalahan sistem saat membuat shift.");
      }
    });
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShift) return;

    const formData = new FormData(e.currentTarget);
    formData.append("id", selectedShift.id);

    startTransition(async () => {
      try {
        const res = await adminUpdateShift(formData);
        if (res.error) {
          toast.error(res.error);
        } else if (res.shift) {
          toast.success("Shift berhasil diperbarui!");
          setIsEditOpen(false);
          
          const updatedShift = res.shift as Shift;
          setShifts((prev) =>
            prev
              .map((s) => (s.id === selectedShift.id ? updatedShift : s))
              .sort((a, b) => a.startTime.localeCompare(b.startTime))
          );
        }
      } catch (err) {
        toast.error("Terjadi kesalahan sistem saat memperbarui shift.");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!selectedShift) return;

    startTransition(async () => {
      try {
        const res = await adminDeleteShift(selectedShift.id);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Shift berhasil dihapus!");
          setIsDeleteOpen(false);
          setShifts((prev) => prev.filter((s) => s.id !== selectedShift.id));
        }
      } catch (err) {
        toast.error("Gagal menghapus shift. Terjadi masalah database.");
      }
    });
  };

  const openEditModal = (shift: Shift) => {
    setSelectedShift(shift);
    setIsEditOpen(true);
  };

  const openDeleteModal = (shift: Shift) => {
    setSelectedShift(shift);
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
            placeholder="Cari nama atau jam masuk..."
            className="w-full pl-9 pr-4 py-2 rounded-lg glass-input text-xs"
          />
        </div>

        <button
          onClick={() => setIsAddOpen(true)}
          className="w-full sm:w-auto py-2 px-4 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Tambah Shift</span>
        </button>
      </div>

      {/* Shifts Table Grid */}
      <div className="glass-panel border border-zinc-900 rounded-xl overflow-hidden">
        {filteredShifts.length === 0 ? (
          <div className="py-16 text-center text-zinc-550 text-xs">
            Tidak ada shift ditemukan untuk pencarian "{searchQuery}"
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 text-zinc-500 font-bold uppercase tracking-wider text-[9px] bg-zinc-950/20">
                  <th className="py-3 px-4">Nama Shift</th>
                  <th className="py-3 px-4">Jam Masuk (Format 24 Jam)</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredShifts.map((s) => (
                  <tr
                    key={s.id}
                    className="border-b border-zinc-950 hover:bg-zinc-950/25 transition-colors font-medium text-zinc-300"
                  >
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {s.name}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-zinc-200">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-555" />
                        <span>{s.startTime} WIB</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase border ${
                          s.isActive
                            ? "bg-white/5 text-white border-white/20"
                            : "bg-red-500/5 text-red-400 border-red-500/10"
                        }`}
                      >
                        {s.isActive ? (
                          <>
                            <CheckCircle className="w-2.5 h-2.5" />
                            Aktif
                          </>
                        ) : (
                          <>
                            <XCircle className="w-2.5 h-2.5" />
                            Nonaktif
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(s)}
                          className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                          title="Edit Shift"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openDeleteModal(s)}
                          className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-red-950/40 text-zinc-400 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                          title="Hapus Shift"
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
      {/* MODAL: TAMBAH SHIFT */}
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
                <PlusCircle className="w-5 h-5 text-white" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Tambah Shift Baru
                </h3>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Nama Shift
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    placeholder="Contoh: Shift Sore"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Jam Masuk (Format HH:MM)
                  </label>
                  <input
                    type="text"
                    name="startTime"
                    required
                    placeholder="Contoh: 15:00"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs font-mono"
                  />
                  <span className="text-[9px] text-zinc-500 mt-1 block">
                    Format waktu harus berupa 24 jam dengan pemisah titik dua (contoh: 09:30, 19:00).
                  </span>
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer mt-4 flex items-center justify-center gap-2"
                >
                  {isPending ? "Menyimpan data..." : "Simpan Shift"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------- */}
      {/* MODAL: EDIT SHIFT */}
      {/* --------------------------------------------- */}
      {isEditOpen && selectedShift && (
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
                  Edit Shift Kerja
                </h3>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Nama Shift
                  </label>
                  <input
                    type="text"
                    name="name"
                    required
                    defaultValue={selectedShift.name}
                    placeholder="Contoh: Shift Sore"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Jam Masuk (Format HH:MM)
                  </label>
                  <input
                    type="text"
                    name="startTime"
                    required
                    defaultValue={selectedShift.startTime}
                    placeholder="Contoh: 15:00"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Status Keaktifan
                  </label>
                  <select
                    name="isActive"
                    defaultValue={selectedShift.isActive ? "true" : "false"}
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs appearance-none"
                  >
                    <option value="true">Aktif</option>
                    <option value="false">Nonaktif</option>
                  </select>
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
      {/* MODAL: DELETE SHIFT (CONFIRMATION) */}
      {/* --------------------------------------------- */}
      {isDeleteOpen && selectedShift && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl relative p-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Hapus Shift Kerja?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Apakah Anda benar-benar yakin ingin menghapus shift{" "}
                <span className="text-white font-bold">"{selectedShift.name}"</span> (Waktu:{" "}
                <span className="font-mono text-white">{selectedShift.startTime}</span>)?
                Tindakan ini hanya akan berhasil jika shift ini belum pernah digunakan oleh karyawan dalam riwayat absensi.
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
                {isPending ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
