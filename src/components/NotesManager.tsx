"use client";

import { useState, useRef, useEffect, useTransition } from "react";
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
  Clock,
  Camera,
  Megaphone,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  Shield,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface Note {
  id: string;
  employeeId: string | null;
  title: string;
  content: string;
  createdById: string;
  isBroadcast: boolean;
  image: string | null;
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
  const [isPending, startTransition] = useTransition();

  // Calendar States
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());

  // Form States
  const [employeeId, setEmployeeId] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isBroadcast, setIsBroadcast] = useState(false);

  // Camera & Photo States
  const [cameraActive, setCameraActive] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);

  // Zoom Modal State
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detailsRef = useRef<HTMLDivElement>(null);

  // Auto clean up camera when form closes
  useEffect(() => {
    if (!formOpen) {
      stopCamera();
      setPhoto(null);
    }
    return () => stopCamera();
  }, [formOpen]);

  const startCamera = async () => {
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      } else {
        setCameraActive(true);
        setTimeout(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play();
          }
        }, 100);
      }
    } catch (err) {
      console.error("Camera Error:", err);
      toast.error("Gagal mengaktifkan kamera. Pastikan izin kamera aktif.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      if (context) {
        canvas.width = 300;
        canvas.height = 300;
        
        // Ambil crop bagian tengah square
        const size = Math.min(video.videoWidth, video.videoHeight);
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        
        context.drawImage(video, sx, sy, size, size, 0, 0, 300, 300);
        
        // Konversi ke base64 JPEG terkompresi
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  const totalDays = lastDayOfMonth.getDate();

  const daysInMonth: Date[] = [];
  
  // Previous month padding days
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    daysInMonth.push(new Date(year, month - 1, prevMonthLast - i));
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    daysInMonth.push(new Date(year, month, i));
  }

  // Next month padding to fill 6 rows (42 cells)
  const remainingCells = 42 - daysInMonth.length;
  for (let i = 1; i <= remainingCells; i++) {
    daysInMonth.push(new Date(year, month + 1, i));
  }

  // Date comparison helper (local timezone YYYY-MM-DD)
  const getLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayStr = getLocalDateString(new Date());
  const selectedStr = getLocalDateString(selectedDate);

  // Filter notes based on search query
  const allFilteredNotes = notes.filter((note) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      note.title.toLowerCase().includes(query) ||
      note.content.toLowerCase().includes(query) ||
      (note.employee?.name || "").toLowerCase().includes(query) ||
      note.createdBy.name.toLowerCase().includes(query) ||
      (note.isBroadcast && "siaran broadcast pengumuman".includes(query))
    );
  });

  // Get notes for a specific date
  const getNotesForDate = (date: Date) => {
    const dateStr = getLocalDateString(date);
    return allFilteredNotes.filter((n) => getLocalDateString(new Date(n.createdAt)) === dateStr);
  };

  // Notes for currently selected date
  const selectedDayNotes = getNotesForDate(selectedDate);

  // Smooth scroll helper for mobile layout
  const selectDateAndScroll = (date: Date) => {
    setSelectedDate(date);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

  // Month navigation helpers
  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(now);
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmployeeId = isBroadcast ? null : (isAdmin ? employeeId : userId);

    if (isAdmin && !isBroadcast && !targetEmployeeId) {
      toast.error("Silakan pilih karyawan terlebih dahulu.");
      return;
    }
    if (!title.trim() || !content.trim()) {
      toast.error("Judul dan isi catatan wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await createPrivateNote(
        isBroadcast ? null : targetEmployeeId,
        title,
        content,
        isBroadcast,
        photo || undefined
      );

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Catatan berhasil disimpan!");

        if (res.note) {
          const emp = isBroadcast ? null : employees.find((e) => e.id === targetEmployeeId);
          const newNote: Note = {
            ...res.note,
            employee: emp ? { name: emp.name, email: emp.email } : null,
            createdBy: {
              name: "Anda",
              role: isAdmin ? "ADMIN" : "EMPLOYEE"
            }
          };
          
          // Append new note and navigate calendar to today
          setNotes([newNote, ...notes]);
          const now = new Date();
          setSelectedDate(now);
          setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
        }

        // Reset form
        setTitle("");
        setContent("");
        setEmployeeId("");
        setIsBroadcast(false);
        setPhoto(null);
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

  // Day names header
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  // Metrics calculations
  const totalNotes = notes.length;
  const broadcastCount = notes.filter((n) => n.isBroadcast).length;
  const privateCount = notes.filter((n) => !n.isBroadcast).length;

  return (
    <div className="space-y-6">
      {/* Visual Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-fade-in">
        <div className="glass-panel p-5 rounded-xl border border-zinc-900 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">
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
            <p className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">
              Siaran & Broadcast
            </p>
            <p className="text-xl font-bold text-indigo-400 mt-1.5">
              {broadcastCount} Pengumuman
            </p>
          </div>
          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900">
            <Megaphone className="w-5 h-5 text-indigo-400" />
          </div>
        </div>

        <div className="glass-panel p-5 rounded-xl border border-zinc-900 flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">
              Evaluasi & Catatan Privat
            </p>
            <p className="text-xl font-bold text-zinc-300 mt-1.5">
              {privateCount} Catatan
            </p>
          </div>
          <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900">
            <MessageSquare className="w-5 h-5 text-zinc-400" />
          </div>
        </div>
      </div>

      {/* Main Split Layout: Calendar (2/3 width) and Selected Date Details (1/3 width) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* LEFT COLUMN: MONTHLY CALENDAR GRID */}
        <div className="lg:col-span-2 glass-panel p-4 sm:p-5 rounded-xl border border-zinc-900 flex flex-col space-y-4">
          
          {/* Calendar Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-900">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-900">
                <Calendar className="w-5 h-5 text-zinc-300" />
              </div>
              <div>
                <h2 className="font-bold text-sm text-white">
                  {currentMonth.toLocaleDateString("id-ID", {
                    month: "long",
                    year: "numeric",
                  })}
                </h2>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Kalender Catatan Burjolevelup
                </p>
              </div>
            </div>

            {/* Navigation buttons and Search Input */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative w-36 sm:w-44">
                <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari catatan..."
                  className="w-full pl-8 pr-2.5 py-1 rounded-lg glass-input text-[10px] bg-zinc-950/40 border-zinc-900"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={goToToday}
                  className="py-1 px-2.5 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-[9px] font-bold text-zinc-300 rounded-md uppercase tracking-wider cursor-pointer"
                >
                  Hari Ini
                </button>
                <div className="flex border border-zinc-900 rounded-md overflow-hidden bg-zinc-950">
                  <button
                    onClick={prevMonth}
                    className="p-1.5 hover:bg-zinc-900 text-zinc-450 hover:text-white transition-colors border-r border-zinc-900 cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={nextMonth}
                    className="p-1.5 hover:bg-zinc-900 text-zinc-450 hover:text-white transition-colors cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Calendar Days Matrix Grid */}
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {/* Calendar Weekdays Row */}
            {dayNames.map((name) => (
              <div
                key={name}
                className="py-1 text-[9px] sm:text-[10px] font-bold text-zinc-550 uppercase tracking-widest"
              >
                <span className="sm:hidden">{name.substring(0, 1)}</span>
                <span className="hidden sm:inline">{name.substring(0, 3)}</span>
              </div>
            ))}

            {/* Grid Date Cells */}
            {daysInMonth.map((date, idx) => {
              const dateStr = getLocalDateString(date);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedStr;
              const isCurrentMonth = date.getMonth() === month;
              
              const cellNotes = getNotesForDate(date);
              const hasBroadcast = cellNotes.some((n) => n.isBroadcast);
              const noteCount = cellNotes.length;

              return (
                <div
                  key={idx}
                  onClick={() => selectDateAndScroll(date)}
                  className={`min-h-[46px] sm:min-h-[64px] p-1.5 rounded-lg border flex flex-col justify-between cursor-pointer transition-all duration-150 relative ${
                    isSelected
                      ? "bg-zinc-900/60 border-white text-white font-bold"
                      : isToday
                      ? "bg-zinc-950 border-zinc-500 text-white"
                      : isCurrentMonth
                      ? "bg-zinc-950/20 border-zinc-900 hover:border-zinc-800 text-zinc-300"
                      : "bg-transparent border-transparent text-zinc-650 hover:border-zinc-900"
                  }`}
                >
                  <div className="flex justify-between items-start w-full">
                    <span
                      className={`text-[10px] sm:text-xs font-semibold ${
                        isToday
                          ? "w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full bg-white text-black font-extrabold flex items-center justify-center -ml-0.5 sm:-ml-1 -mt-0.5 sm:-mt-1 shadow-sm"
                          : ""
                      }`}
                    >
                      {date.getDate()}
                    </span>
                  </div>

                  {/* Indicators for Notes on this date */}
                  {noteCount > 0 && (
                    <div className="flex gap-1 items-center justify-center sm:justify-start pt-1">
                      <span 
                        className={`w-1.5 h-1.5 rounded-full ${hasBroadcast ? 'bg-indigo-400 animate-pulse' : 'bg-white'}`}
                      />
                      <span className="hidden sm:inline text-[8px] text-zinc-500 font-extrabold">
                        {noteCount} Note{noteCount > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: SELECTED DATE DETAILS PANEL & NOTE CREATION FORM */}
        <div ref={detailsRef} className="glass-panel p-4 sm:p-5 rounded-xl border border-zinc-900 space-y-4 scroll-mt-6">
          
          {/* Header showing Selected Date */}
          <div className="pb-3 border-b border-zinc-900 flex justify-between items-center gap-2">
            <div className="min-w-0">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-550 block">
                Catatan Harian
              </span>
              <h3 className="font-bold text-xs sm:text-sm text-white mt-1 flex items-center gap-1.5 truncate">
                {selectedDate.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h3>
            </div>
            
            {/* Toggle write form button */}
            <button
              onClick={() => setFormOpen(!formOpen)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-[10px] text-white font-bold cursor-pointer shrink-0"
            >
              {formOpen ? <XCircle className="w-3.5 h-3.5 text-zinc-400" /> : <Plus className="w-3.5 h-3.5 text-zinc-400" />}
              <span>{formOpen ? "Batal" : "Tulis"}</span>
            </button>
          </div>

          {/* Form to write a new note */}
          {formOpen && (
            <form
              onSubmit={handleCreateNote}
              className="p-4 bg-zinc-950/40 border border-zinc-900 rounded-xl space-y-3.5 animate-fade-in"
            >
              <div className="flex justify-between items-center pb-2 border-b border-zinc-900/60">
                <h4 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Tulis Catatan Baru</span>
                </h4>
              </div>

              {/* Broadcast Option (Admin only) */}
              {isAdmin && (
                <div className="flex items-center gap-2 p-2 bg-zinc-950/60 border border-zinc-900/80 rounded-lg">
                  <input
                    type="checkbox"
                    id="isBroadcast"
                    checked={isBroadcast}
                    onChange={(e) => {
                      setIsBroadcast(e.target.checked);
                      if (e.target.checked) setEmployeeId("");
                    }}
                    className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-white cursor-pointer accent-white"
                  />
                  <label
                    htmlFor="isBroadcast"
                    className="text-[10px] text-zinc-350 font-bold cursor-pointer flex items-center gap-1.5 select-none"
                  >
                    <Megaphone className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Siarkan Ke Semua (Broadcast)</span>
                  </label>
                </div>
              )}

              {/* Target Employee Dropdown (Admin private note only) */}
              {isAdmin && !isBroadcast && (
                <div>
                  <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                    Pilih Karyawan Target
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required={!isBroadcast}
                    className="w-full px-2.5 py-2 rounded-lg glass-input text-xs"
                  >
                    <option value="">Pilih Karyawan...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Title input */}
              <div>
                <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Judul Catatan
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Contoh: Pengajuan Kasbon Beras / Memo"
                  className="w-full px-2.5 py-2 rounded-lg glass-input text-xs"
                />
              </div>

              {/* Content textarea */}
              <div>
                <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-widest mb-1">
                  Isi Deskripsi Detail Catatan
                </label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  rows={3}
                  placeholder="Tulis detail catatan..."
                  className="w-full px-2.5 py-2 rounded-lg glass-input text-xs resize-none"
                />
              </div>

              {/* Camera photo attachment UI */}
              <div className="space-y-1.5">
                <label className="block text-[8px] font-bold text-zinc-500 uppercase tracking-widest">
                  Lampirkan Foto (Kamera)
                </label>
                <div className="flex items-center gap-3 p-3 bg-zinc-950/60 border border-zinc-900 rounded-lg">
                  <div className="relative aspect-square w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center shrink-0">
                    {!photo && (
                      <video
                        ref={videoRef}
                        className={`w-full h-full object-cover scale-x-[-1] ${cameraActive ? "block" : "hidden"}`}
                        playsInline
                        muted
                      />
                    )}
                    {photo && (
                      <img
                        src={photo}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    )}
                    {!cameraActive && !photo && (
                      <Camera className="w-5 h-5 text-zinc-700" />
                    )}
                  </div>

                  <div className="flex-1 space-y-1.5">
                    <div className="flex gap-1.5">
                      {!cameraActive && !photo && (
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white font-bold text-[8px] uppercase cursor-pointer hover:bg-zinc-850"
                        >
                          Kamera
                        </button>
                      )}
                      {cameraActive && !photo && (
                        <>
                          <button
                            type="button"
                            onClick={capturePhoto}
                            className="px-2 py-1 rounded bg-white text-black font-bold text-[8px] uppercase cursor-pointer hover:bg-zinc-200"
                          >
                            Foto
                          </button>
                          <button
                            type="button"
                            onClick={stopCamera}
                            className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-500 font-bold text-[8px] uppercase cursor-pointer hover:bg-zinc-850"
                          >
                            Batal
                          </button>
                        </>
                      )}
                      {photo && (
                        <>
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-2 py-1 rounded bg-zinc-900 border border-zinc-800 text-white font-bold text-[8px] uppercase cursor-pointer"
                          >
                            Ulang
                          </button>
                          <button
                            type="button"
                            onClick={() => setPhoto(null)}
                            className="px-2 py-1 rounded bg-red-950/20 border border-red-900/40 text-red-400 font-bold text-[8px] uppercase cursor-pointer"
                          >
                            Hapus
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer disabled:opacity-55"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Menyimpan...
                  </span>
                ) : (
                  <span>Simpan Catatan</span>
                )}
              </button>
            </form>
          )}

          {/* List of notes for the selected day */}
          <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1">
            {selectedDayNotes.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 text-xs italic">
                Tidak ada catatan untuk tanggal ini.
              </div>
            ) : (
              selectedDayNotes.map((note) => {
                const canDelete = isAdmin || note.createdById === userId;

                return (
                  <div
                    key={note.id}
                    className={`p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between gap-3 ${
                      note.isBroadcast
                        ? "bg-indigo-950/5 border-indigo-950/50 hover:border-indigo-900/60"
                        : "bg-zinc-950/20 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-col gap-1 items-start">
                        {note.isBroadcast && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.25 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[7px] font-extrabold uppercase tracking-wider">
                            <Megaphone className="w-2 h-2" />
                            Broadcast
                          </span>
                        )}
                        <h4 className="font-bold text-xs text-white leading-snug">{note.title}</h4>
                      </div>

                      <p className="text-zinc-300 font-medium text-[11px] leading-relaxed whitespace-pre-wrap">
                        {note.content}
                      </p>

                      {/* Image Thumbnail */}
                      {note.image && (
                        <div className="mt-2.5 flex items-start">
                          <div
                            onClick={() => setSelectedImage(note.image!)}
                            className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-900 bg-zinc-950 cursor-pointer hover:opacity-85 group transition-all"
                            title="Klik untuk memperbesar gambar"
                          >
                            <img
                              src={note.image}
                              alt="Attachment"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Eye className="w-3.5 h-3.5 text-white" />
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Metadata log */}
                      <div className="flex flex-wrap items-center gap-2.5 text-[8.5px] text-zinc-550 font-bold pt-1.5 border-t border-zinc-950">
                        <span className="flex items-center gap-1 truncate max-w-[120px]">
                          <User className="w-3 h-3 text-zinc-650" />
                          <span>
                            Oleh: <span className="text-zinc-400">{note.createdBy.name}</span>
                          </span>
                        </span>
                        {!note.isBroadcast && note.employee && (
                          <span className="flex items-center gap-1 truncate max-w-[120px]">
                            <Clock className="w-3 h-3 text-zinc-650" />
                            <span>
                              Karyawan: <span className="text-zinc-400">{note.employee.name}</span>
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions (Delete button) */}
                    {canDelete && (
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => handleDeleteNote(note.id)}
                          className="p-1.5 rounded-lg border border-zinc-900 hover:border-red-950 bg-zinc-950/40 hover:bg-red-950/25 text-zinc-500 hover:text-red-400 transition-all cursor-pointer self-start"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Role Instruction Info */}
          <div className="pt-3 border-t border-zinc-900 text-[9px] font-semibold text-zinc-550 leading-relaxed">
            {isAdmin ? (
              <p className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
                <span>Owner/Admin dapat menulis catatan spesifik untuk karyawan maupun menyiarkan informasi umum (Broadcast) ke seluruh karyawan.</span>
              </p>
            ) : (
              <p className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
                <span>Karyawan dapat melihat catatan privat yang dikirim oleh owner khusus untuk Anda serta pengumuman broadcast umum.</span>
              </p>
            )}
          </div>

        </div>

      </div>

      {/* Enlarged Attachment Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="relative w-full max-w-2xl max-h-[85vh] flex flex-col items-center">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-12 right-0 p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center shadow-2xl">
              <img
                src={selectedImage}
                alt="Lampiran Catatan"
                className="max-w-full max-h-[70vh] object-contain"
              />
            </div>

            <button
              onClick={() => setSelectedImage(null)}
              className="mt-5 px-6 py-2.5 bg-zinc-900 border border-zinc-850 hover:bg-zinc-800 text-white font-semibold rounded-full text-xs uppercase cursor-pointer transition-colors"
            >
              Tutup Lampiran
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
