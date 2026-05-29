"use client";

import { useState } from "react";
import { createPrivateNote, deletePrivateNote } from "@/actions/notes";
import {
  FileText,
  Plus,
  Trash2,
  User,
  Calendar,
  RefreshCw,
  Search,
  MessageSquare,
  Sparkles,
  XCircle,
  Clock
} from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface Note {
  id: string;
  employeeId: string;
  title: string;
  content: string;
  createdById: string;
  createdAt: Date | string;
  createdBy: {
    name: string;
    role: string;
  };
  employee?: {
    name: string;
    email: string;
  } | null;
}

interface NotesManagerProps {
  initialNotes: Note[];
  employees?: Employee[];
  isAdmin: boolean;
  userId: string;
}

export default function NotesManager({
  initialNotes,
  employees = [],
  isAdmin,
  userId
}: NotesManagerProps) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Form States
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  // Filter notes based on search query
  const filteredNotes = notes.filter((note) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      (note.employee?.name || "").toLowerCase().includes(query) ||
      note.createdBy.name.toLowerCase().includes(query)
    );
  });

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmployeeId = isAdmin ? employeeId : userId;

    if (isAdmin && !targetEmployeeId) {
      toast.error("Silakan pilih karyawan terlebih dahulu.");
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast.error("Judul dan isi catatan wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await createPrivateNote(targetEmployeeId, title, content);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Catatan berhasil disimpan!");

        if (res.note) {
          const emp = employees.find((e) => e.id === targetEmployeeId);
          const newNote: Note = {
            ...res.note,
            employee: emp ? { name: emp.name, email: emp.email } : null,
            createdBy: {
              name: "Anda",
              role: isAdmin ? "ADMIN" : "EMPLOYEE"
            }
          };
          setNotes([newNote, ...notes]);
        }

        // Reset form
        setTitle("");
        setContent("");
        setEmployeeId("");
        setFormOpen(false);
      }
    } catch (err) {
      toast.error("Terjadi kesalahan sistem saat membuat catatan.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan ini secara permanen?")) return;

    try {
      const res = await deletePrivateNote(noteId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Catatan berhasil dihapus.");
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
      }
    } catch (err) {
      toast.error("Gagal menghapus catatan.");
    }
  };

  // Metrics calculations
  const totalNotes = notes.length;
  const notesByMe = notes.filter((n) => n.createdById === userId).length;
  const notesForMeOrByOwner = notes.filter((n) => n.createdById !== userId).length;

  return (
    <div className="space-y-6">
      {/* Visual Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-zinc-900 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Total Catatan
            </p>
            <p className="text-xl font-bold text-white mt-1.5">
              {totalNotes} Catatan
            </p>
          </div>
          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900">
            <FileText className="w-5 h-5 text-zinc-400" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-zinc-900 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              Ditulis Oleh Saya
            </p>
            <p className="text-xl font-bold text-zinc-300 mt-1.5">
              {notesByMe} Catatan
            </p>
          </div>
          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900">
            <User className="w-5 h-5 text-zinc-400" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-zinc-900 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
              {isAdmin ? "Ditulis Karyawan" : "Ditulis Owner (Admin)"}
            </p>
            <p className="text-xl font-bold text-zinc-300 mt-1.5">
              {notesForMeOrByOwner} Catatan
            </p>
          </div>
          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900">
            <MessageSquare className="w-5 h-5 text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Main Panel */}
      <div className="glass-panel p-5 rounded-xl border border-zinc-900 space-y-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-3 border-b border-zinc-900">
          {/* Search bar */}
          <div className="relative w-full sm:max-w-xs">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari catatan..."
              className="w-full pl-9 pr-3.5 py-1.5 rounded-lg glass-input text-xs"
            />
          </div>

          {/* Action Trigger Button */}
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-xs text-white font-bold cursor-pointer shrink-0 w-full sm:w-auto justify-center"
          >
            <Plus className="w-4 h-4" />
            <span>Tulis Catatan Baru</span>
          </button>
        </div>

        {/* Input Form Box */}
        {formOpen && (
          <form
            onSubmit={handleCreateNote}
            className="p-5 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-4 animate-fade-in"
          >
            <div className="flex justify-between items-center pb-2 border-b border-zinc-900/60">
              <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                <span>Tulis Catatan / Diskusi</span>
              </h3>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="p-1 rounded hover:bg-zinc-900 text-zinc-500 hover:text-white cursor-pointer"
              >
                <XCircle className="w-4.5 h-4.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Employee selection (Admin only) */}
              {isAdmin ? (
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Pilih Karyawan
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  >
                    <option value="">Pilih Karyawan...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* Title input */}
              <div className={isAdmin ? "sm:col-span-2" : "sm:col-span-3"}>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Judul Catatan
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Contoh: Evaluasi Kinerja Mingguan / Pengajuan Kasbon Beras"
                  className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                />
              </div>
            </div>

            {/* Note content textarea */}
            <div>
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                Isi / Deskripsi Detail Catatan
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                required
                rows={4}
                placeholder="Tuliskan catatan evaluasi, kasbon, utang, memo, atau diskusi khusus di sini secara jelas..."
                className="w-full px-3 py-2.5 rounded-lg glass-input text-xs resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer disabled:opacity-55"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                </span>
              ) : (
                <span>Simpan Catatan</span>
              )}
            </button>
          </form>
        )}

        {/* List of notes */}
        {filteredNotes.length === 0 ? (
          <div className="py-16 text-center text-zinc-500 text-xs italic">
            Tidak ada catatan yang ditemukan.
          </div>
        ) : (
          <div className="space-y-4">
            {filteredNotes.map((note) => {
              const canDelete = isAdmin || note.createdById === userId;

              return (
                <div
                  key={note.id}
                  className="p-4 sm:p-5 rounded-xl border border-zinc-900 bg-zinc-950/20 hover:border-zinc-800 transition-all duration-200 flex flex-col md:flex-row justify-between gap-4"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-white">{note.title}</h4>
                    <p className="text-zinc-300 font-medium text-xs leading-relaxed whitespace-pre-wrap">
                      {note.content}
                    </p>

                    {/* Metadata log */}
                    <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-bold pt-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        <span>
                          Penulis: <span className="text-zinc-300">{note.createdBy.name} ({note.createdBy.role})</span>
                        </span>
                      </span>
                      {isAdmin && note.employee && (
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>
                            Untuk Karyawan: <span className="text-zinc-350">{note.employee.name}</span>
                          </span>
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>
                          {new Date(note.createdAt).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "long",
                            year: "numeric"
                          })}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Actions (Delete button) */}
                  {canDelete && (
                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="p-2 rounded-lg border border-zinc-900 hover:border-red-950 bg-zinc-950/40 hover:bg-red-950/25 text-zinc-500 hover:text-red-400 transition-all shrink-0 cursor-pointer self-start"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
