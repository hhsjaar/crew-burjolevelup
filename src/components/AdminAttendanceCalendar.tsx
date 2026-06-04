"use client";

import { useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Camera,
  X,
  UserCheck
} from "lucide-react";

interface Employee {
  name: string;
  email: string;
}

interface Attendance {
  id: string;
  employeeId: string;
  date: string; // Format: YYYY-MM-DD
  clockIn: Date | string;
  clockOut: Date | string | null;
  status: "ON_TIME" | "LATE" | "ABSENT" | "LEAVE" | string;
  notes: string | null;
  clockInLatitude: number | null;
  clockInLongitude: number | null;
  clockInSelfie: string | null;
  clockOutLatitude: number | null;
  clockOutLongitude: number | null;
  clockOutSelfie: string | null;
  employee: Employee;
  shift?: {
    id: string;
    name: string;
    startTime: string;
  } | null;
}

interface AdminAttendanceCalendarProps {
  allAttendances: Attendance[];
}

export default function AdminAttendanceCalendar({ allAttendances }: AdminAttendanceCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [expandedAttendanceId, setExpandedAttendanceId] = useState<string | null>(null);
  const [selectedSelfie, setSelectedSelfie] = useState<{
    name: string;
    type: "Masuk" | "Pulang";
    image: string;
  } | null>(null);

  // Calendar parameters
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay();
  const totalDays = lastDayOfMonth.getDate();

  const daysInMonth: Date[] = [];
  
  // Previous month padding
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    daysInMonth.push(new Date(year, month - 1, prevMonthLast - i));
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    daysInMonth.push(new Date(year, month, i));
  }

  // Next month padding to fill 6-row grid
  const remainingCells = 42 - daysInMonth.length;
  for (let i = 1; i <= remainingCells; i++) {
    daysInMonth.push(new Date(year, month + 1, i));
  }

  const getLocalDateString = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const todayStr = getLocalDateString(new Date());
  const selectedStr = getLocalDateString(selectedDate);

  // Month navigation
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

  // Get attendances for a specific date YYYY-MM-DD
  const getAttendancesForDate = (date: Date) => {
    const dateStr = getLocalDateString(date);
    return allAttendances.filter((att) => att.date === dateStr);
  };

  // Selected date attendances
  const selectedDayAttendances = allAttendances.filter(
    (att) => att.date === selectedStr
  );

  const formatTime = (dateStr: Date | string | null) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
  };

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  return (
    <div className="w-full space-y-6">
      {/* ATTENDANCE CALENDAR GRID - FULL WIDTH */}
      <div className="glass-panel p-4 sm:p-5 rounded-xl border border-zinc-900 flex flex-col space-y-4 w-full">
        {/* Calendar Nav Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-900">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-950 rounded-lg border border-zinc-900">
              <CalendarIcon className="w-5 h-5 text-zinc-300" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">
                {currentMonth.toLocaleDateString("id-ID", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                Google Calendar View
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="py-1 px-3 bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 text-[10px] font-bold text-zinc-300 rounded-md uppercase tracking-wider cursor-pointer"
            >
              Hari Ini
            </button>
            <div className="flex border border-zinc-900 rounded-md overflow-hidden bg-zinc-950">
              <button
                onClick={prevMonth}
                className="p-1.5 hover:bg-zinc-900 text-zinc-450 hover:text-white transition-colors border-r border-zinc-900 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={nextMonth}
                className="p-1.5 hover:bg-zinc-900 text-zinc-450 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {dayNames.map((name) => (
            <div key={name} className="py-1 text-[9px] sm:text-[10px] font-bold text-zinc-550 uppercase tracking-widest">
              <span className="sm:hidden">{name.substring(0, 1)}</span>
              <span className="hidden sm:inline">{name}</span>
            </div>
          ))}

          {/* Grid Cells */}
          {daysInMonth.map((date, idx) => {
            const dateStr = getLocalDateString(date);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedStr;
            const isCurrentMonth = date.getMonth() === month;
            const dayAtts = getAttendancesForDate(date);

            const totalPresent = dayAtts.length;

            return (
              <div
                key={idx}
                onClick={() => {
                  setSelectedDate(date);
                  setExpandedAttendanceId(null);
                  setDetailsModalOpen(true);
                }}
                className={`min-h-[58px] sm:min-h-[88px] p-1.5 sm:p-2 rounded-lg border flex flex-col justify-between cursor-pointer transition-all duration-150 relative ${
                  isSelected
                    ? "bg-zinc-900/60 border-white text-white font-bold"
                    : isToday
                    ? "bg-zinc-950 border-zinc-500 text-white"
                    : isCurrentMonth
                    ? "bg-zinc-950/20 border-zinc-900 hover:border-zinc-800 text-zinc-300"
                    : "bg-transparent border-transparent text-zinc-650 hover:border-zinc-900"
                }`}
              >
                {/* Day Number */}
                <div className="flex justify-between items-start w-full">
                  <span
                    className={`text-[10px] sm:text-xs font-semibold ${
                      isToday
                        ? "w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white text-black font-extrabold flex items-center justify-center -ml-0.5 sm:-ml-1 -mt-0.5 sm:-mt-1 shadow-sm"
                        : ""
                    }`}
                  >
                    {date.getDate()}
                  </span>
                </div>

                {/* Brief list of attendances inside cell */}
                {isCurrentMonth && dayAtts.length > 0 && (
                  <div className="flex flex-col gap-1 w-full items-stretch pt-1 sm:pt-2">
                    {dayAtts.slice(0, 2).map((att) => (
                      <div
                        key={att.id}
                        className="hidden sm:flex items-center justify-between text-[8px] font-extrabold bg-zinc-950/60 border border-zinc-900 px-1.5 py-0.5 rounded text-zinc-300 leading-none truncate max-w-full"
                      >
                        <span className="truncate text-left font-bold">{att.employee.name.split(" ")[0]}</span>
                        <span className="text-[7px] text-zinc-500 shrink-0 font-normal ml-0.5">
                          {formatTime(att.clockIn)}
                        </span>
                      </div>
                    ))}
                    {dayAtts.length > 2 && (
                      <div className="hidden sm:block text-[8px] font-black text-zinc-550 text-center leading-none pt-0.5">
                        +{dayAtts.length - 2} lainnya
                      </div>
                    )}
                    {/* Dots indicator for mobile view */}
                    <div className="flex sm:hidden gap-0.5 justify-center items-center">
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                      {dayAtts.length > 1 && <span className="w-1 h-1 rounded-full bg-white/40" />}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* CENTERED DETAILS MODAL POPUP */}
      {detailsModalOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-40 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop Overlay */}
          <div className="absolute inset-0" onClick={() => setDetailsModalOpen(false)} />

          {/* Modal Content Box */}
          <div className="w-full max-w-lg max-h-[85vh] bg-zinc-950/90 border border-zinc-900 rounded-2xl p-6 flex flex-col justify-between shadow-2xl relative z-10 animate-scale-in overflow-hidden">
            <button
              onClick={() => setDetailsModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Header */}
            <div className="pb-4 border-b border-zinc-900 pr-8">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-550 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Rekam Absensi Karyawan
              </span>
              <h3 className="font-bold text-base text-white mt-1 flex items-center gap-1.5">
                {selectedDate.toLocaleDateString("id-ID", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric"
                })}
                {selectedStr === todayStr && (
                  <span className="text-[8px] font-extrabold bg-white text-black px-1.5 py-0.5 rounded uppercase">
                    Hari Ini
                  </span>
                )}
              </h3>
            </div>

            {/* Attendance Details List */}
            <div className="flex-1 overflow-y-auto pr-1 py-4 space-y-4">
              {selectedDayAttendances.length === 0 ? (
                <div className="py-16 text-center text-zinc-500 text-xs italic">
                  Tidak ada data absensi tercatat pada tanggal ini.
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDayAttendances.map((att) => {
                    const isExpanded = expandedAttendanceId === att.id;
                    return (
                      <div
                        key={att.id}
                        className="bg-zinc-950/40 border border-zinc-900 rounded-xl overflow-hidden transition-all duration-205"
                      >
                        {/* Header brief list row - ALWAYS Visible and Clickable */}
                        <div
                          onClick={() => setExpandedAttendanceId(isExpanded ? null : att.id)}
                          className="p-4 flex items-center justify-between hover:bg-zinc-900/60 cursor-pointer select-none transition-colors duration-150"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-xs text-white truncate">{att.employee.name}</p>
                            <p className="text-[9px] text-zinc-500 mt-0.5 truncate">{att.employee.email}</p>
                          </div>
                          
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="flex items-center gap-2 text-[9.5px] text-zinc-450 font-bold bg-zinc-950 px-2.5 py-1 rounded border border-zinc-900 leading-none">
                              <span className="text-[7.5px] font-extrabold text-zinc-550 uppercase tracking-widest">Shift</span>
                              <span className="text-zinc-200 font-bold">{att.shift?.name || "-"}</span>
                              <span className="text-zinc-800">|</span>
                              <span className="text-[7.5px] font-extrabold text-zinc-550 uppercase tracking-widest">Jam</span>
                              <span className="text-zinc-200 font-bold">{formatTime(att.clockIn)}</span>
                            </div>
                            
                            {/* Chevron Indicator */}
                            <svg
                              className={`w-4 h-4 text-zinc-550 transition-transform duration-200 ${
                                isExpanded ? "rotate-180 text-white" : ""
                              }`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>

                        {/* Collapsible Details Body */}
                        {isExpanded && (
                          <div className="px-4 pb-4 pt-1 border-t border-zinc-900/60 bg-zinc-950/20 space-y-3.5 animate-slide-down">
                            {/* Shift & Time Details */}
                            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-900 text-[11px] text-zinc-300 space-y-1.5 pt-3">
                              <div className="flex justify-between">
                                <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-widest">Shift Kerja:</span>
                                <span className="font-semibold text-zinc-200">{att.shift?.name || "-"} ({att.shift?.startTime ? `${att.shift.startTime} WIB` : ""})</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-widest">Status Presensi:</span>
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border ${
                                    att.status === "LATE"
                                      ? "bg-red-500/5 text-red-400 border-red-500/10"
                                      : att.status === "LEAVE"
                                      ? "bg-zinc-900/60 text-zinc-400 border-zinc-800"
                                      : "bg-white/5 text-white border-white/20"
                                  }`}
                                >
                                  {att.status === "LATE" ? "Terlambat" : att.status === "LEAVE" ? "Izin/Cuti" : att.status === "ABSENT" ? "Alpa" : "Tepat Waktu"}
                                </span>
                              </div>
                            </div>

                            {/* Clock In details */}
                            <div className="grid grid-cols-1 py-1 pt-3">
                              {/* Clock In */}
                              <div className="space-y-2">
                                <span className="text-[8px] font-bold text-zinc-550 uppercase tracking-widest block">CLOCK-IN MASUK</span>
                                <div className="flex items-center gap-1.5 text-zinc-350 font-semibold text-[11px]">
                                  <Clock className="w-3.5 h-3.5 text-zinc-550" />
                                  <span>{formatTime(att.clockIn)}</span>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  {att.clockInSelfie ? (
                                    <button
                                      onClick={() => setSelectedSelfie({
                                        name: att.employee.name,
                                        type: "Masuk",
                                        image: att.clockInSelfie!
                                      })}
                                      className="w-7 h-7 rounded bg-zinc-900 border border-zinc-850 overflow-hidden hover:border-zinc-500 transition-colors cursor-pointer shrink-0"
                                    >
                                      <img src={att.clockInSelfie} alt="Selfie Masuk" className="w-full h-full object-cover" />
                                    </button>
                                  ) : (
                                    <span className="text-[7px] text-zinc-650 font-bold bg-zinc-900 border border-zinc-900 px-1 py-0.5 rounded">NO PHOTO</span>
                                  )}

                                  {att.clockInLatitude && att.clockInLongitude ? (
                                    <a
                                      href={`https://www.google.com/maps/search/?api=1&query=${att.clockInLatitude},${att.clockInLongitude}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1 rounded bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white transition-colors"
                                      title="Buka Peta Masuk"
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                    </a>
                                  ) : (
                                    <span className="text-[7px] text-zinc-650">NO GPS</span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Notes */}
                            {att.notes && (
                              <div className="p-2.5 bg-zinc-950 rounded-lg border border-zinc-900 text-[10px] text-zinc-450 italic">
                                <span className="font-bold text-white not-italic block mb-0.5">Catatan:</span>
                                "{att.notes}"
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => setDetailsModalOpen(false)}
              className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors cursor-pointer border border-zinc-800"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Selfie Enlarger Modal */}
      {selectedSelfie && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-sm rounded-xl border border-zinc-800 p-6 space-y-4 relative">
            <button
              onClick={() => setSelectedSelfie(null)}
              className="absolute right-5 top-5 p-1 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div>
              <h3 className="font-semibold text-sm text-white flex items-center gap-2">
                <Camera className="w-4.5 h-4.5 text-zinc-400" />
                <span>Selfie Absensi</span>
              </h3>
              <p className="text-[10px] text-zinc-550 mt-1">
                Karyawan: <span className="text-zinc-300 font-semibold">{selectedSelfie.name}</span> • Tipe: <span className="text-zinc-300 font-semibold">{selectedSelfie.type}</span>
              </p>
            </div>

            <div className="aspect-square w-full rounded-lg overflow-hidden border border-zinc-850 bg-black shadow-inner">
              <img src={selectedSelfie.image} alt="Absensi Selfie" className="w-full h-full object-cover" />
            </div>

            <button
              onClick={() => setSelectedSelfie(null)}
              className="w-full py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider apple-btn-secondary cursor-pointer"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
