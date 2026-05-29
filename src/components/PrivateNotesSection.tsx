"use client";

import { useState } from "react";
import { createPrivateNote, deletePrivateNote } from "@/actions/notes";
import { FileText, Plus, Trash2, DollarSign, User, Calendar, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface PrivateNotesSectionProps {
  initialNotes: any[];
  employees?: any[]; // Only passed for Admin
  isAdmin: boolean;
}

export default function PrivateNotesSection({ initialNotes, employees = [], isAdmin }: PrivateNotesSectionProps) {
  const [notes, setNotes] = useState(initialNotes);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  // Form State
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId || !title || !content) {
      toast.error("Semua kolom wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await createPrivateNote(employeeId, title, content);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Catatan khusus berhasil dibuat!");
        // Refresh notes list (admin views all newly created notes too)
        if (res.note) {
          // If we want to add to local state instantly, we can find employee name
          const emp = employees.find(e => e.id === employeeId);
          const newNote = {
            ...res.note,
            employee: emp ? { name: emp.name } : null,
            createdBy: { name: "Anda" }
          };
          setNotes([newNote, ...notes]);
        }
        setTitle("");
        setContent("");
        setEmployeeId("");
        setFormOpen(false);
      }
    } catch (err) {
      toast.error("Terjadi kesalahan teknis.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus catatan khusus ini?")) return;

    try {
      const res = await deletePrivateNote(noteId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Catatan berhasil dihapus.");
        setNotes(notes.filter((n) => n.id !== noteId));
      }
    } catch (err) {
      toast.error("Gagal menghapus catatan.");
    }
  };

  // Helper to format currency if it's a debt note
  const formatDebt = (text: string) => {
    const match = text.match(/(Rp\s*|Rp\.?\s*)?(\d{1,3}(\.\d{3})+|\d{4,9})/gi);
    if (match) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-white text-black border border-white/20 rounded-full shrink-0">
          <DollarSign className="w-3 h-3" /> Finansial / Utang
        </span>
      );
    }
    return null;
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-zinc-900 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <FileText className="w-4.5 h-4.5 text-zinc-400" />
          <h2 className="font-semibold text-base text-white">
            {isAdmin ? "Manajemen Catatan Khusus Karyawan" : "Catatan Khusus Anda & Admin"}
          </h2>
        </div>

        {isAdmin && (
          <button
            onClick={() => setFormOpen(!formOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-xs text-zinc-300 font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tulis Catatan</span>
          </button>
        )}
      </div>

      {/* Admin Form */}
      {isAdmin && formOpen && (
        <form onSubmit={handleSubmit} className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg space-y-3.5 animate-fade-in">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">Tulis Catatan Khusus Baru</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Pilih Karyawan
              </label>
              <select
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg glass-input text-xs"
              >
                <option value="">Pilih...</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                Judul Catatan
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Contoh: Utang Bon / Teguran Operasional"
                className="w-full px-3 py-2 rounded-lg glass-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
              Konten / Isi Catatan
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
              rows={3}
              placeholder="Tulis nominal utang atau catatan operasional rahasia di sini secara detail..."
              className="w-full px-3 py-2 rounded-lg glass-input text-xs resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-1.5">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
              </span>
            ) : (
              "Simpan Catatan Khusus"
            )}
          </button>
        </form>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="py-8 text-center text-zinc-500 text-xs">
          Belum ada catatan khusus atau catatan utang tercatat.
        </div>
      ) : (
        <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
          {notes.map((note) => (
            <div
              key={note.id}
              className="p-4 bg-zinc-950/20 border border-zinc-900 rounded-lg flex justify-between gap-4 text-xs hover:border-zinc-800 transition-colors"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-zinc-200">{note.title}</h4>
                  {formatDebt(note.content)}
                </div>
                <p className="text-zinc-400 font-medium whitespace-pre-wrap leading-relaxed">{note.content}</p>
                
                <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-semibold pt-1">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    {isAdmin && note.employee ? (
                      <span>Untuk: <span className="text-zinc-300">{note.employee.name}</span></span>
                    ) : (
                      <span>Oleh: <span className="text-zinc-300">{note.createdBy.name}</span></span>
                    )}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(note.createdAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </span>
                </div>
              </div>

              {isAdmin && (
                <button
                  onClick={() => handleDelete(note.id)}
                  className="p-2 rounded-lg border border-zinc-900 hover:border-red-950 bg-transparent hover:bg-red-500/5 text-zinc-500 hover:text-red-400 transition-all shrink-0 cursor-pointer self-start"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
