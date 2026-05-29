"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { updateTaskStatus, claimTask } from "@/actions/tasks";
import {
  Calendar as CalendarIcon,
  CheckSquare,
  Square,
  User,
  Zap,
  CheckCircle,
  HelpCircle,
  Clock,
  ArrowRight,
  Shield,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface Task {
  id: string;
  title: string;
  description: string | null;
  type: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  employeeId: string | null;
  isClaimable: boolean;
  excludedDates?: string | null;
  employee?: {
    name: string;
    email: string;
  } | null;
}

interface CalendarDashboardProps {
  tasks: Task[];
  claimableTasks: Task[];
  isAdmin: boolean;
  userId: string;
}

export default function CalendarDashboard({
  tasks,
  claimableTasks,
  isAdmin,
  userId,
}: CalendarDashboardProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isPending, startTransition] = useTransition();
  const detailsRef = useRef<HTMLDivElement>(null);

  // Combine routine tasks and claimed/claimable tasks
  const [allTasks, setAllTasks] = useState<Task[]>([]);

  useEffect(() => {
    // Merge all tasks
    const merged = [...tasks];
    // Add claimable tasks if not already present
    claimableTasks.forEach((ct) => {
      if (!merged.some((t) => t.id === ct.id)) {
        merged.push(ct);
      }
    });
    setAllTasks(merged);
  }, [tasks, claimableTasks]);

  // Calendar math
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  const totalDays = lastDayOfMonth.getDate();

  // Days array generation
  const daysInMonth: (Date | null)[] = [];
  
  // Previous month padding
  const prevMonthLast = new Date(year, month, 0).getDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    daysInMonth.push(new Date(year, month - 1, prevMonthLast - i));
  }

  // Current month days
  for (let i = 1; i <= totalDays; i++) {
    daysInMonth.push(new Date(year, month, i));
  }

  // Next month padding to fill a 6-row grid (42 cells)
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

  const isTaskActiveOnDate = (task: Task, date: Date) => {
    const targetStr = getLocalDateString(date);
    const baseStartDate = task.dueDate ? new Date(task.dueDate) : new Date(task.createdAt);
    const startDateOnly = new Date(baseStartDate.getFullYear(), baseStartDate.getMonth(), baseStartDate.getDate());
    const targetDateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (targetDateOnly < startDateOnly) {
      return false;
    }

    if (task.excludedDates) {
      const excludedList = task.excludedDates.split(",");
      if (excludedList.includes(targetStr)) {
        return false;
      }
    }

    // Only apply the dueDate absolute ceiling check for non-recurring (ONCE) tasks!
    if (task.type === "ONCE" && task.dueDate) {
      const dueDate = new Date(task.dueDate);
      const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      if (targetDateOnly > dueDateOnly) {
        return false;
      }
    }

    if (task.type === "ONCE") {
      const dateToUse = task.dueDate ? new Date(task.dueDate) : new Date(task.createdAt);
      return getLocalDateString(dateToUse) === targetStr;
    }

    if (task.type === "DAILY") {
      return true;
    }

    if (task.type === "WEEKLY") {
      return targetDateOnly.getDay() === startDateOnly.getDay();
    }

    if (task.type === "MONTHLY") {
      return targetDateOnly.getDate() === startDateOnly.getDate();
    }

    const fallbackDate = task.dueDate ? new Date(task.dueDate) : new Date(task.createdAt);
    return getLocalDateString(fallbackDate) === targetStr;
  };

  const todayStr = getLocalDateString(new Date());
  const selectedStr = getLocalDateString(selectedDate);

  // Smooth scroll to details on mobile when a date is clicked
  const selectDateAndScroll = (date: Date) => {
    setSelectedDate(date);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setTimeout(() => {
        detailsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  };

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

  // Get tasks for a specific date cell
  const getTasksForDate = (date: Date) => {
    return allTasks.filter((t) => isTaskActiveOnDate(t, date));
  };

  // Get tasks for currently selected date
  const selectedDayTasks = allTasks.filter((t) => {
    const isActive = isTaskActiveOnDate(t, selectedDate);
    // If it's an employee, show their personal tasks and FCFS tasks claimed by them OR claimable tasks.
    // If it's admin, show all tasks for this date.
    if (!isAdmin) {
      const isPersonal = t.employeeId === userId;
      const isClaimableUnclaimed = t.isClaimable && !t.employeeId;
      return isActive && (isPersonal || isClaimableUnclaimed);
    }
    return isActive;
  });

  // Assignee checklist toggle
  const handleToggleChecklist = async (taskId: string, currentStatus: string) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    if (isAdmin) {
      toast.error("Hanya penerima tugas yang dapat menyelesaikan tugas.");
      return;
    }

    if (task.employeeId !== userId) {
      toast.error("Anda hanya dapat menyelesaikan tugas milik Anda sendiri.");
      return;
    }

    const nextStatus = currentStatus === "COMPLETED" ? "PENDING" : "COMPLETED";
    
    startTransition(async () => {
      try {
        const res = await updateTaskStatus(taskId, nextStatus);
        if (res.error) {
          toast.error(res.error);
        } else {
          // Success toast
          toast.success(
            nextStatus === "COMPLETED" 
              ? "Tugas ditandai SELESAI! 👍" 
              : "Tugas dikembalikan ke PENDING"
          );
          
          if (nextStatus === "COMPLETED") {
            confetti({
              particleCount: 80,
              spread: 60,
              origin: { y: 0.8 },
            });
          }

          // Update local state
          setAllTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
          );
        }
      } catch (err) {
        toast.error("Gagal memperbarui status tugas.");
      }
    });
  };

  // Employee claims additional FCFS task
  const handleClaimFCFS = async (taskId: string) => {
    try {
      const res = await claimTask(taskId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Tugas tambahan rebutan berhasil diklaim!");
        // Trigger confetti
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.8 },
        });

        // Update local state
        setAllTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  employeeId: userId,
                  status: "IN_PROGRESS",
                  employee: { name: "Anda", email: "" },
                }
              : t
          )
        );
      }
    } catch (err) {
      toast.error("Terjadi kesalahan saat mengklaim tugas.");
    }
  };

  // Day names for the header row
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* 30-DAY GOOGLE CALENDAR GRID COMPONENT */}
      <div className="lg:col-span-2 glass-panel p-4 sm:p-5 rounded-xl border border-zinc-900 flex flex-col space-y-4">
        {/* Calendar Navigation Header */}
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

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {/* Day Names Row */}
          {dayNames.map((name) => (
            <div
              key={name}
              className="py-1 text-[9px] sm:text-[10px] font-bold text-zinc-550 uppercase tracking-widest"
            >
              <span className="sm:hidden">{name.substring(0, 1)}</span>
              <span className="hidden sm:inline">{name.substring(0, 3)}</span>
            </div>
          ))}

          {/* Day Cells */}
          {daysInMonth.map((date, idx) => {
            if (!date) return <div key={idx} />;

            const dateStr = getLocalDateString(date);
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedStr;
            const isCurrentMonth = date.getMonth() === month;
            const cellTasks = getTasksForDate(date);

            // Calculate task counts for indicators
            const completedCount = cellTasks.filter((t) => t.status === "COMPLETED").length;
            const pendingCount = cellTasks.filter(
              (t) => t.status !== "COMPLETED" && (!t.isClaimable || t.employeeId)
            ).length;
            const claimableCount = cellTasks.filter((t) => t.isClaimable && !t.employeeId).length;

            return (
              <div
                key={idx}
                onClick={() => selectDateAndScroll(date)}
                className={`min-h-[46px] sm:min-h-[72px] p-1 sm:p-2 rounded-lg border flex flex-col justify-between cursor-pointer transition-all duration-150 relative ${
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
                  
                  {/* Today Badge inside cell */}
                  {isToday && !isSelected && (
                    <span className="hidden sm:inline-block text-[7px] font-black uppercase text-zinc-400 bg-zinc-900 px-1 py-0.5 rounded border border-zinc-800">
                      Now
                    </span>
                  )}
                </div>

                {/* Dot Task Indicators */}
                <div className="flex gap-0.5 sm:gap-1 items-center justify-center sm:justify-start flex-wrap pt-0.5 sm:pt-2">
                  {pendingCount > 0 && (
                    <span
                      className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-zinc-400"
                      title={`${pendingCount} tugas operasional`}
                    />
                  )}
                  {completedCount > 0 && (
                    <span
                      className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-white"
                      title={`${completedCount} tugas selesai`}
                    />
                  )}
                  {claimableCount > 0 && (
                    <span
                      className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-zinc-600 animate-pulse"
                      title={`${claimableCount} tugas rebutan FCFS`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SELECTED DATE DETAILS SIDEBAR */}
      <div ref={detailsRef} className="glass-panel p-4 sm:p-5 rounded-xl border border-zinc-900 space-y-4 scroll-mt-6">
        {/* Detail Title */}
        <div className="pb-3 border-b border-zinc-900">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-550 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" /> Agenda Operasional
          </span>
          <h3 className="font-bold text-sm text-white mt-1.5 flex items-center gap-1.5">
            {selectedDate.toLocaleDateString("id-ID", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            {selectedStr === todayStr && (
              <span className="text-[8px] font-extrabold bg-white text-black px-1.5 py-0.5 rounded uppercase">
                Hari Ini
              </span>
            )}
          </h3>
        </div>

        {/* Task lists container */}
        <div className="space-y-4.5 max-h-[none] sm:max-h-[380px] overflow-y-visible sm:overflow-y-auto pr-1">
          {selectedDayTasks.length === 0 ? (
            <div className="py-16 text-center text-zinc-500 text-xs italic">
              Tidak ada agenda jobdesk terjadwal untuk tanggal ini.
            </div>
          ) : (
            <>
              {/* Routine & Assigned Tasks */}
              <div className="space-y-2.5">
                <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest">
                  Jobdesk Pribadi / Ditugaskan
                </span>
                
                {selectedDayTasks
                  .filter((t) => !t.isClaimable || t.employeeId)
                  .map((task) => {
                    const isCompleted = task.status === "COMPLETED";

                    return (
                      <div
                        key={task.id}
                        onClick={() => {
                          if (!isAdmin && task.employeeId === userId) {
                            handleToggleChecklist(task.id, task.status);
                          }
                        }}
                        className={`p-3 border rounded-xl flex items-start gap-3 transition-all duration-150 ${
                          !isAdmin && task.employeeId === userId ? "cursor-pointer select-none hover:border-zinc-550" : ""
                        } ${
                          isCompleted
                            ? "bg-zinc-950/20 border-zinc-900/60"
                            : "bg-zinc-950/50 border-zinc-900 hover:border-zinc-850"
                        }`}
                      >
                        {/* Interactive Assignee Checklist Checkbox */}
                        {!isAdmin && task.employeeId === userId ? (
                          <div className="mt-0.5 shrink-0 transition-transform active:scale-95 text-zinc-300">
                            {isCompleted ? (
                              <CheckSquare className="w-4.5 h-4.5 text-white" />
                            ) : (
                              <Square className="w-4.5 h-4.5 text-zinc-650" />
                            )}
                          </div>
                        ) : (
                          <div className="mt-0.5 shrink-0">
                            {isCompleted ? (
                              <CheckCircle className="w-4.5 h-4.5 text-zinc-450" />
                            ) : (
                              <Clock className="w-4.5 h-4.5 text-zinc-650" />
                            )}
                          </div>
                        )}

                        <div className="min-w-0 flex-1 space-y-1">
                          <p
                            className={`font-semibold text-xs leading-snug ${
                              isCompleted ? "line-through text-zinc-600" : "text-white"
                            }`}
                          >
                            {task.title}
                          </p>
                          {task.description && (
                            <p
                              className={`text-[10px] leading-relaxed font-medium ${
                                isCompleted ? "text-zinc-700" : "text-zinc-400"
                              }`}
                            >
                              {task.description}
                            </p>
                          )}
                          
                          {/* Assignee / Tagging info */}
                          <div className="flex items-center gap-3 pt-1 text-[9px] font-bold text-zinc-550 uppercase">
                            <span className="flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-zinc-550" />
                              Penerima:{" "}
                              <span className="text-zinc-400">
                                {task.employeeId === userId ? "Anda" : task.employee?.name || "--"}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* FCFS Claimable "Jobdesk Rebutan" Tasks */}
              {selectedDayTasks.some((t) => t.isClaimable && !t.employeeId) && (
                <div className="space-y-2.5 pt-2">
                  <span className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1">
                    Jobdesk Rebutan (FCFS) ⚡
                  </span>
                  
                  {selectedDayTasks
                    .filter((t) => t.isClaimable && !t.employeeId)
                    .map((task) => (
                      <div
                        key={task.id}
                        className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-2.5"
                      >
                        <div className="space-y-1">
                          <p className="font-semibold text-xs text-white leading-snug">
                            {task.title}
                          </p>
                          {task.description && (
                            <p className="text-[10px] text-zinc-400 font-medium leading-relaxed">
                              {task.description}
                            </p>
                          )}
                        </div>

                        {!isAdmin && (
                          <button
                            onClick={() => handleClaimFCFS(task.id)}
                            className="w-full py-2.5 sm:py-1.5 bg-white hover:bg-zinc-200 text-black font-extrabold text-[10px] rounded-lg uppercase tracking-wider transition-colors cursor-pointer text-center block shadow-sm flex items-center justify-center gap-1.5"
                          >
                            <span>Ambil Jobdesk Rebutan</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        {isAdmin && (
                          <span className="inline-block text-[9px] font-bold text-zinc-550 uppercase italic">
                            Menunggu diambil karyawan...
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Role Helper Info */}
        <div className="pt-3 border-t border-zinc-900 text-[10px] font-semibold text-zinc-550 leading-relaxed">
          {isAdmin ? (
            <p className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
              <span>Owner memantau pengerjaan tugas. Hanya penerima tugas yang dapat menyelesaikan tugasnya.</span>
            </p>
          ) : (
            <p className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
              <span>Klik kotak centang pada jobdesk Anda untuk menandai selesai/belum selesai.</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
