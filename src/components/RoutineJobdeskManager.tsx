"use client";

import { useState, useEffect, useTransition } from "react";
import {
  getRoutineJobdesks,
  createRoutineJobdesk,
  updateRoutineJobdesk,
  deleteRoutineJobdesk,
} from "@/actions/routineJobdesk";
import {
  Plus,
  Edit2,
  Trash2,
  X,
  PlusCircle,
  AlertTriangle,
  ClipboardList,
  Sparkles,
  Loader2,
  Clock,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

interface Shift {
  id: string;
  name: string;
  startTime: string;
  isActive: boolean;
}

interface RoutineJobdesk {
  id: string;
  shiftId: string;
  title: string;
  description: string | null;
  createdAt: Date;
}

interface RoutineJobdeskManagerProps {
  shifts: Shift[];
}

export default function RoutineJobdeskManager({ shifts }: RoutineJobdeskManagerProps) {
  const activeShifts = shifts.filter((s) => s.isActive);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(
    activeShifts.length > 0 ? activeShifts[0] : null
  );
  const [jobdesks, setJobdesks] = useState<RoutineJobdesk[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Modals States
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Selected routine jobdesk for Edit / Delete operations
  const [selectedJobdesk, setSelectedJobdesk] = useState<RoutineJobdesk | null>(null);

  // Fetch jobdesks when selected shift changes
  useEffect(() => {
    if (selectedShift) {
      setLoading(true);
      getRoutineJobdesks(selectedShift.id)
        .then((data) => {
          setJobdesks(data as any[]);
        })
        .catch((err) => {
          console.error(err);
          toast.error("Gagal memuat jobdesk rutin untuk shift ini.");
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setJobdesks([]);
    }
  }, [selectedShift]);

  // Handlers
  const handleAddSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShift) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    if (!title || !title.trim()) {
      toast.error("Judul jobdesk wajib diisi.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await createRoutineJobdesk(selectedShift.id, title, description);
        if (res.error) {
          toast.error(res.error);
        } else if (res.success && res.jobdesk) {
          toast.success("Jobdesk rutin berhasil ditambahkan!");
          setIsAddOpen(false);
          setJobdesks((prev) => [...prev, res.jobdesk as any]);
        }
      } catch (err) {
        toast.error("Gagal menambahkan jobdesk rutin.");
      }
    });
  };

  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedJobdesk) return;

    const formData = new FormData(e.currentTarget);
    const title = formData.get("title") as string;
    const description = formData.get("description") as string;

    if (!title || !title.trim()) {
      toast.error("Judul jobdesk wajib diisi.");
      return;
    }

    startTransition(async () => {
      try {
        const res = await updateRoutineJobdesk(selectedJobdesk.id, title, description);
        if (res.error) {
          toast.error(res.error);
        } else if (res.success && res.jobdesk) {
          toast.success("Jobdesk rutin berhasil diperbarui!");
          setIsEditOpen(false);
          setJobdesks((prev) =>
            prev.map((jd) => (jd.id === selectedJobdesk.id ? (res.jobdesk as any) : jd))
          );
        }
      } catch (err) {
        toast.error("Gagal memperbarui jobdesk rutin.");
      }
    });
  };

  const handleDeleteConfirm = async () => {
    if (!selectedJobdesk) return;

    startTransition(async () => {
      try {
        const res = await deleteRoutineJobdesk(selectedJobdesk.id);
        if (res.error) {
          toast.error(res.error);
        } else if (res.success) {
          toast.success("Jobdesk rutin berhasil dihapus.");
          setIsDeleteOpen(false);
          setJobdesks((prev) => prev.filter((jd) => jd.id !== selectedJobdesk.id));
        }
      } catch (err) {
        toast.error("Gagal menghapus jobdesk rutin.");
      }
    });
  };

  const openEditModal = (jobdesk: RoutineJobdesk) => {
    setSelectedJobdesk(jobdesk);
    setIsEditOpen(true);
  };

  const openDeleteModal = (jobdesk: RoutineJobdesk) => {
    setSelectedJobdesk(jobdesk);
    setIsDeleteOpen(true);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      {/* ================= PANEL KIRI: DAFTAR SHIFT ================= */}
      <div className="lg:col-span-4 space-y-4">
        <div className="glass-panel p-4 rounded-xl border border-zinc-900 bg-zinc-950/20">
          <h2 className="font-bold text-xs text-zinc-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-zinc-500" />
            Pilih Shift Kerja
          </h2>
          
          {activeShifts.length === 0 ? (
            <div className="py-6 text-center text-zinc-550 text-xs italic">
              Tidak ada shift aktif yang tersedia.
            </div>
          ) : (
            <div className="space-y-2">
              {activeShifts.map((shift) => {
                const isSelected = selectedShift?.id === shift.id;
                return (
                  <button
                    key={shift.id}
                    onClick={() => setSelectedShift(shift)}
                    className={`w-full text-left p-4 rounded-xl border flex items-center justify-between transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? "bg-zinc-900 border-zinc-800 text-white shadow-md font-semibold"
                        : "bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800 hover:bg-zinc-950/40"
                    }`}
                  >
                    <div>
                      <h3 className={`text-xs ${isSelected ? "text-white" : "text-zinc-300"}`}>
                        {shift.name}
                      </h3>
                      <span className="text-[10px] text-zinc-500 font-mono block mt-1">
                        Jam Masuk: {shift.startTime} WIB
                      </span>
                    </div>
                    {isSelected && <ArrowRight className="w-4 h-4 text-white" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ================= PANEL KANAN: JOBDESK RUTIN SHIFT TERPILIH ================= */}
      <div className="lg:col-span-8 space-y-4">
        {selectedShift ? (
          <div className="glass-panel p-6 rounded-xl border border-zinc-900 bg-zinc-950/20 space-y-5">
            {/* Header Jobdesk */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">
                  Daftar Tugas Bawaan
                </span>
                <h2 className="font-bold text-base text-white mt-1">
                  Jobdesk Rutin: {selectedShift.name}
                </h2>
              </div>

              <button
                onClick={() => setIsAddOpen(true)}
                className="py-2 px-4 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>Tambah Jobdesk</span>
              </button>
            </div>

            {/* List View */}
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center text-zinc-550 gap-2">
                <Loader2 className="w-8 h-8 animate-spin" />
                <span className="text-xs italic">Memuat daftar tugas...</span>
              </div>
            ) : jobdesks.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <ClipboardList className="w-10 h-10 text-zinc-800 mx-auto" />
                <p className="text-xs text-zinc-500 italic">
                  Belum ada jobdesk rutin yang dikonfigurasi untuk shift ini.
                </p>
                <p className="text-[10px] text-zinc-650 max-w-sm mx-auto">
                  Tambahkan tugas default di atas agar ketika karyawan clock-in pada shift ini, tugas langsung muncul otomatis.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {jobdesks.map((jobdesk) => (
                  <div
                    key={jobdesk.id}
                    className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl hover:border-zinc-800 transition-all duration-200 flex flex-col justify-between"
                  >
                    <div>
                      <h3 className="font-semibold text-xs text-white leading-snug">
                        {jobdesk.title}
                      </h3>
                      {jobdesk.description && (
                        <p className="text-[10px] text-zinc-400 leading-relaxed mt-1.5 italic">
                          {jobdesk.description}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-zinc-900/50">
                      <button
                        onClick={() => openEditModal(jobdesk)}
                        className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-zinc-800 text-zinc-405 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Edit Jobdesk"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => openDeleteModal(jobdesk)}
                        className="p-1.5 bg-zinc-950 border border-zinc-900 hover:border-red-950/40 text-zinc-405 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                        title="Hapus Jobdesk"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="glass-panel py-20 rounded-xl border border-zinc-900 bg-zinc-950/10 text-center text-zinc-500 text-xs italic">
            Silakan pilih shift di panel sebelah kiri terlebih dahulu.
          </div>
        )}
      </div>

      {/* --------------------------------------------- */}
      {/* MODAL: TAMBAH JOBDESK */}
      {/* --------------------------------------------- */}
      {isAddOpen && selectedShift && (
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
                  Tambah Jobdesk Rutin ({selectedShift.name})
                </h3>
              </div>

              <form onSubmit={handleAddSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Judul Tugas / Jobdesk
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="Contoh: Bersihkan Mesin Kopi & Meja Bar"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Deskripsi Tugas (Opsional)
                  </label>
                  <textarea
                    name="description"
                    placeholder="Contoh: Lap basah, buang sisa ampas kopi, keringkan wadah penampung air."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer mt-2 flex items-center justify-center gap-2"
                >
                  {isPending ? "Menyimpan data..." : "Tambah Jobdesk"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------- */}
      {/* MODAL: EDIT JOBDESK */}
      {/* --------------------------------------------- */}
      {isEditOpen && selectedJobdesk && selectedShift && (
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
                  Edit Jobdesk Rutin ({selectedShift.name})
                </h3>
              </div>

              <form onSubmit={handleEditSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Judul Tugas / Jobdesk
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    defaultValue={selectedJobdesk.title}
                    placeholder="Contoh: Bersihkan Mesin Kopi"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Deskripsi Tugas (Opsional)
                  </label>
                  <textarea
                    name="description"
                    defaultValue={selectedJobdesk.description || ""}
                    placeholder="Contoh: Deskripsi tugas detail..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer mt-2 flex items-center justify-center gap-2"
                >
                  {isPending ? "Memproses perubahan..." : "Simpan Perubahan"}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------- */}
      {/* MODAL: DELETE JOBDESK (CONFIRMATION) */}
      {/* --------------------------------------------- */}
      {isDeleteOpen && selectedJobdesk && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-900 rounded-xl overflow-hidden shadow-2xl relative p-6 space-y-4">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-full">
                <AlertTriangle className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Hapus Jobdesk Rutin?
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed font-medium">
                Apakah Anda benar-benar yakin ingin menghapus jobdesk rutin{" "}
                <span className="text-white font-bold">"{selectedJobdesk.title}"</span> dari shift ini?
                Karyawan yang melakukan absensi masuk selanjutnya tidak akan mendapatkan tugas ini secara otomatis.
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
