"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import {
  updateTaskStatus,
  claimTask,
  addTaskComment,
  getTaskComments,
  deleteTask,
  deleteMultipleTasks,
  createTask,
  deleteAllTasks,
  excludeTaskDate,
  startTaskTimer,
  pauseTaskTimer,
  resetTaskTimer,
} from "@/actions/tasks";
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
  ClipboardList,
  PlusCircle,
  Trash2,
  X,
  MessageSquare,
  Send,
  AlignLeft,
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
  timerDuration?: number | null;
  timerStartedAt?: Date | string | null;
  timerNotified?: boolean;
}

interface Employee {
  id: string;
  name: string;
  email: string;
}

interface CalendarJobdeskManagerProps {
  initialTasks: Task[];
  initialClaimableTasks: Task[];
  employees: Employee[];
  isAdmin: boolean;
  userId: string;
}

export default function CalendarJobdeskManager({
  initialTasks,
  initialClaimableTasks,
  employees,
  isAdmin,
  userId,
}: CalendarJobdeskManagerProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [claimableTasks, setClaimableTasks] = useState<Task[]>(initialClaimableTasks);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [isPending, startTransition] = useTransition();
  const [formTaskType, setFormTaskType] = useState<string>("ONCE");

  // Selection states for Admin checklist deletion
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);

  // Drawer States
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);

  const detailsRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const [timerInputMinutes, setTimerInputMinutes] = useState(15);
  const [tick, setTick] = useState(0);

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

  // Sync with initial tasks from page server actions
  useEffect(() => {
    setTasks(initialTasks);
    setClaimableTasks(initialClaimableTasks);
  }, [initialTasks, initialClaimableTasks]);

  // Helper for beeping
  const playBeep = () => {
    if (typeof window !== "undefined") {
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        oscillator.type = "sine";
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        oscillator.start();
        setTimeout(() => {
          oscillator.stop();
          audioCtx.close();
        }, 800);
      } catch (e) {
        console.error("Failed to play audio", e);
      }
    }
  };

  const getTaskRemainingSeconds = (task: Task) => {
    if (!task.timerDuration) return 0;
    if (!task.timerStartedAt) return task.timerDuration;
    
    const startedTime = new Date(task.timerStartedAt).getTime();
    const elapsedSeconds = Math.floor((Date.now() - startedTime) / 1000);
    const remaining = task.timerDuration - elapsedSeconds;
    return remaining > 0 ? remaining : 0;
  };

  // Timer Tick Side-Effect
  useEffect(() => {
    const hasActiveTimers = allTasks.some(t => t.timerStartedAt && t.status !== "COMPLETED");
    if (hasActiveTimers) {
      const interval = setInterval(() => {
        setTick((t) => t + 1);
        
        allTasks.forEach(t => {
          if (t.timerStartedAt && t.status !== "COMPLETED" && t.timerDuration) {
            const startedTime = new Date(t.timerStartedAt).getTime();
            const elapsed = Math.floor((Date.now() - startedTime) / 1000);
            if (elapsed === t.timerDuration) {
              playBeep();
              toast.success(`Timer untuk tugas "${t.title}" telah selesai!`);
            }
          }
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [allTasks]);

  const handleStartTimer = async (durationInSeconds: number) => {
    if (!selectedTask) return;
    try {
      const res = await startTaskTimer(selectedTask.id, durationInSeconds);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Timer dijalankan!");
        setAllTasks(prev => prev.map(t => t.id === selectedTask.id ? {
          ...t,
          timerDuration: durationInSeconds,
          timerStartedAt: new Date().toISOString(),
          timerNotified: false
        } : t));
        setSelectedTask((prev: any) => prev ? {
          ...prev,
          timerDuration: durationInSeconds,
          timerStartedAt: new Date().toISOString(),
          timerNotified: false
        } : null);
      }
    } catch (err) {
      toast.error("Gagal menyalakan timer.");
    }
  };

  const handlePauseTimer = async () => {
    if (!selectedTask) return;
    const remaining = getTaskRemainingSeconds(selectedTask);
    try {
      const res = await pauseTaskTimer(selectedTask.id, remaining);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Timer dijeda.");
        setAllTasks(prev => prev.map(t => t.id === selectedTask.id ? {
          ...t,
          timerStartedAt: null,
          timerDuration: remaining
        } : t));
        setSelectedTask((prev: any) => prev ? {
          ...prev,
          timerStartedAt: null,
          timerDuration: remaining
        } : null);
      }
    } catch (err) {
      toast.error("Gagal menjeda timer.");
    }
  };

  const handleResetTimer = async () => {
    if (!selectedTask) return;
    try {
      const res = await resetTaskTimer(selectedTask.id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Timer diatur ulang.");
        setAllTasks(prev => prev.map(t => t.id === selectedTask.id ? {
          ...t,
          timerStartedAt: null,
          timerDuration: null,
          timerNotified: false
        } : t));
        setSelectedTask((prev: any) => prev ? {
          ...prev,
          timerStartedAt: null,
          timerDuration: null,
          timerNotified: false
        } : null);
      }
    } catch (err) {
      toast.error("Gagal mengatur ulang timer.");
    }
  };



  // Calendar calculations
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);

  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 is Sunday
  const totalDays = lastDayOfMonth.getDate();

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

  // Smooth scroll to list on mobile when a date is clicked
  const selectDateAndScroll = (date: Date) => {
    setSelectedDate(date);
    setSelectedTaskIds([]); // Reset selection on date change
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

  // Filter tasks based on selected date and claim status
  const selectedDayRoutineTasks = allTasks.filter((t) => {
    const isActive = isTaskActiveOnDate(t, selectedDate);
    const isClaimedOrRoutine = !t.isClaimable || t.employeeId !== null;

    if (!isAdmin) {
      // Employees see their own tasks and claimed FCFS tasks
      return isActive && isClaimedOrRoutine && t.employeeId === userId;
    }
    return isActive && isClaimedOrRoutine;
  });

  const selectedDayClaimableTasks = allTasks.filter((t) => {
    const isActive = isTaskActiveOnDate(t, selectedDate);
    const isUnclaimedFCFS = t.isClaimable && t.employeeId === null;
    return isActive && isUnclaimedFCFS;
  });

  // Assignee checklist toggle inside the calendar view
  const handleToggleChecklist = async (taskId: string, currentStatus: string) => {
    if (isAdmin) {
      toast.error("Hanya penerima tugas yang dapat menyelesaikan tugas.");
      return;
    }

    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

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

          // Update local tasks
          setTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: nextStatus } : t))
          );
        }
      } catch (err) {
        toast.error("Gagal memperbarui status tugas.");
      }
    });
  };

  // Employee claims FCFS task
  const handleClaim = async (taskId: string) => {
    const dateStr = getLocalDateString(selectedDate);
    try {
      const res = await claimTask(taskId, dateStr);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Tugas tambahan berhasil Anda klaim!");
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.8 },
        });

        // Update local tasks
        if (res.updatedRecurringTask && res.task) {
          const newOnceTask = res.task;
          const updatedRecurring = res.updatedRecurringTask;

          setTasks((prev) => {
            const updatedList = prev.map((t) =>
              t.id === updatedRecurring.id ? updatedRecurring : t
            );
            return [...updatedList, newOnceTask];
          });

          setClaimableTasks((prev) =>
            prev.map((t) =>
              t.id === updatedRecurring.id ? updatedRecurring : t
            )
          );
        } else {
          // Normal claim (non-recurring ONCE tasks)
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId
                ? { ...t, employeeId: userId, status: "IN_PROGRESS" }
                : t
            )
          );
        }
      }
    } catch (err) {
      toast.error("Gagal mengklaim tugas.");
    }
  };

  // Deletions
  const handleDeleteTask = async (taskId: string) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    if (task.type === "ONCE") {
      if (!confirm("Apakah Anda yakin ingin menghapus tugas ini secara permanen?")) return;
      try {
        const res = await deleteTask(taskId);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Tugas berhasil dihapus!");
          setDrawerOpen(false);
          setTasks(tasks.filter((t) => t.id !== taskId));
          setClaimableTasks(claimableTasks.filter((t) => t.id !== taskId));
        }
      } catch (err) {
        toast.error("Gagal menghapus tugas.");
      }
    } else {
      const dateStr = getLocalDateString(selectedDate);
      if (!confirm(`Apakah Anda yakin ingin menghapus tugas "${task.title}" hanya untuk tanggal ${dateStr}?`)) return;

      try {
        const res = await excludeTaskDate(taskId, dateStr);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Tugas hari ini berhasil dihapus!");
          setDrawerOpen(false);
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id === taskId) {
                const currentExcluded = t.excludedDates ? t.excludedDates.split(",") : [];
                if (!currentExcluded.includes(dateStr)) {
                  currentExcluded.push(dateStr);
                }
                return { ...t, excludedDates: currentExcluded.join(",") };
              }
              return t;
            })
          );
          setClaimableTasks((prev) =>
            prev.map((t) => {
              if (t.id === taskId) {
                const currentExcluded = t.excludedDates ? t.excludedDates.split(",") : [];
                if (!currentExcluded.includes(dateStr)) {
                  currentExcluded.push(dateStr);
                }
                return { ...t, excludedDates: currentExcluded.join(",") };
              }
              return t;
            })
          );
        }
      } catch (err) {
        toast.error("Gagal menghapus tugas hari ini.");
      }
    }
  };

  const handleDeleteAllRecurringTasks = async (taskId: string) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;

    if (
      !confirm(
        `Apakah Anda YAKIN ingin menghapus seluruh tugas berulang "${task.title}" secara permanen? Semua data tugas berulang ini akan dihapus sepenuhnya dari semua tanggal.`
      )
    )
      return;

    try {
      const res = await deleteTask(taskId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Tugas berulang "${task.title}" berhasil dihapus dari sistem!`);
        setDrawerOpen(false);
        setTasks(tasks.filter((t) => t.id !== taskId));
        setClaimableTasks(claimableTasks.filter((t) => t.id !== taskId));
      }
    } catch (err) {
      toast.error("Gagal menghapus tugas berulang.");
    }
  };

  const handleDeleteSelectedTasks = async () => {
    if (selectedTaskIds.length === 0) return;
    if (!confirm(`Apakah Anda yakin ingin menghapus ${selectedTaskIds.length} tugas terpilih secara permanen?`)) return;

    try {
      const res = await deleteMultipleTasks(selectedTaskIds);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`${selectedTaskIds.length} tugas berhasil dihapus!`);
        setTasks(tasks.filter((t) => !selectedTaskIds.includes(t.id)));
        setClaimableTasks(claimableTasks.filter((t) => !selectedTaskIds.includes(t.id)));
        setSelectedTaskIds([]);
      }
    } catch (err) {
      toast.error("Gagal menghapus tugas terpilih.");
    }
  };

  const handleDeleteAllDayTasks = async () => {
    const allVisibleIds = [
      ...selectedDayRoutineTasks.map((t) => t.id),
      ...selectedDayClaimableTasks.map((t) => t.id),
    ];

    if (allVisibleIds.length === 0) {
      toast.error("Tidak ada tugas pada hari ini yang dapat dihapus.");
      return;
    }

    if (
      !confirm(
        `Apakah Anda YAKIN ingin menghapus SELURUH (${allVisibleIds.length}) tugas yang aktif pada tanggal ini? Tindakan ini bersifat permanen.`
      )
    )
      return;

    try {
      const res = await deleteMultipleTasks(allVisibleIds);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Seluruh tugas aktif pada hari ini berhasil dikosongkan!");
        setTasks(tasks.filter((t) => !allVisibleIds.includes(t.id)));
        setClaimableTasks(claimableTasks.filter((t) => !allVisibleIds.includes(t.id)));
        setSelectedTaskIds([]);
      }
    } catch (err) {
      toast.error("Gagal mengosongkan tugas hari ini.");
    }
  };

  // Form task creation from client-side transition
  const handleCreateTaskClient = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formRef.current) return;

    const formData = new FormData(formRef.current);
    const title = formData.get("title") as string;
    if (!title || !title.trim()) {
      toast.error("Judul tugas wajib diisi.");
      return;
    }

    const type = formData.get("type") as string;

    if (type !== "ONCE") {
      const startDateVal = formData.get("startDate") as string;
      const startTimeVal = formData.get("startTime") as string;
      if (!startDateVal || !startTimeVal) {
        toast.error("Tanggal mulai dan jam pelaksanaan wajib diisi.");
        return;
      }
      const combined = new Date(`${startDateVal}T${startTimeVal}:00`);
      formData.set("dueDate", combined.toISOString());
    }

    startTransition(async () => {
      try {
        const res = await createTask(formData);
        if (res.error) {
          toast.error(res.error);
        } else {
          toast.success("Tugas operasional baru berhasil dirilis!");

          if (res.task) {
            // Update local tasks
            const newTask = {
              ...res.task,
              employee: res.task.employeeId
                ? {
                  name: employees.find((emp) => emp.id === res.task.employeeId)?.name || "",
                  email: "",
                }
                : null,
            } as Task;

            setTasks((prev) => [newTask, ...prev]);
            if (res.task.isClaimable) {
              setClaimableTasks((prev) => [newTask, ...prev]);
            }
          }

          // Reset Form
          formRef.current?.reset();
        }
      } catch (err) {
        toast.error("Terjadi kesalahan saat merilis tugas.");
      }
    });
  };

  // Shared comments drawer loading
  useEffect(() => {
    if (selectedTask) {
      loadComments(selectedTask.id);
    }
  }, [selectedTask]);

  const loadComments = async (taskId: string) => {
    setLoadingComments(true);
    try {
      const res = await getTaskComments(taskId);
      setComments(res);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat catatan bersama.");
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !selectedTask) return;

    setSubmittingComment(true);
    try {
      const res = await addTaskComment(selectedTask.id, newComment);
      if (res.error) {
        toast.error(res.error);
      } else {
        setNewComment("");
        await loadComments(selectedTask.id);
        toast.success("Catatan berhasil dibagikan.");
      }
    } catch (err) {
      toast.error("Gagal menambahkan catatan.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const openDrawer = (task: any) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

  return (
    <div className="space-y-6">
      {/* 30-DAY GOOGLE CALENDAR GRID COMPONENT - FULL WIDTH */}
      <div className="glass-panel p-4 sm:p-5 rounded-xl border border-zinc-900 flex flex-col space-y-4">
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
                className={`min-h-[50px] sm:min-h-[76px] p-1.5 sm:p-2 rounded-lg border flex flex-col justify-between cursor-pointer transition-all duration-150 relative ${isSelected
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
                    className={`text-[10px] sm:text-xs font-semibold ${isToday
                      ? "w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white text-black font-extrabold flex items-center justify-center -ml-0.5 sm:-ml-1 -mt-0.5 sm:-mt-1 shadow-sm"
                      : ""
                      }`}
                  >
                    {date.getDate()}
                  </span>

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

      {/* SELECTED DATE DETAILS & ACTIONS LIST */}
      <div ref={detailsRef} className="space-y-4 scroll-mt-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-950/40 p-4 border border-zinc-900 rounded-xl">
          <div className="space-y-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5" /> Agenda Operasional
            </span>
            <h3 className="font-bold text-sm text-white flex items-center gap-1.5">
              {selectedDate.toLocaleDateString("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {selectedStr === todayStr && (
                <span className="text-[8px] font-extrabold bg-white text-black px-1.5 py-0.5 rounded uppercase">
                  Hari Ini
                </span>
              )}
            </h3>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
              {/* Select All Option */}
              {(selectedDayRoutineTasks.length > 0 || selectedDayClaimableTasks.length > 0) && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-900 text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer select-none shrink-0">
                  <input
                    type="checkbox"
                    id="selectAllTasks"
                    checked={
                      (selectedDayRoutineTasks.length > 0
                        ? selectedDayRoutineTasks.every((t) => selectedTaskIds.includes(t.id))
                        : true) &&
                      (selectedDayClaimableTasks.length > 0
                        ? selectedDayClaimableTasks.every((t) => selectedTaskIds.includes(t.id))
                        : true)
                    }
                    onChange={(e) => {
                      const allCurrentIds = [
                        ...selectedDayRoutineTasks.map((t) => t.id),
                        ...selectedDayClaimableTasks.map((t) => t.id),
                      ];
                      if (e.target.checked) {
                        setSelectedTaskIds(Array.from(new Set([...selectedTaskIds, ...allCurrentIds])));
                      } else {
                        setSelectedTaskIds(selectedTaskIds.filter((id) => !allCurrentIds.includes(id)));
                      }
                    }}
                    className="w-3.5 h-3.5 accent-white cursor-pointer rounded"
                  />
                  <label htmlFor="selectAllTasks" className="cursor-pointer">Pilih Semua</label>
                </div>
              )}

              {selectedTaskIds.length > 0 ? (
                <button
                  onClick={handleDeleteSelectedTasks}
                  className="py-2 px-3.5 border border-red-900 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                  <span>Hapus Terpilih ({selectedTaskIds.length})</span>
                </button>
              ) : (
                <button
                  onClick={handleDeleteAllDayTasks}
                  disabled={selectedDayRoutineTasks.length === 0 && selectedDayClaimableTasks.length === 0}
                  className="py-2 px-3.5 border border-red-955 bg-red-955/10 hover:bg-red-955/25 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 justify-center disabled:opacity-40 disabled:pointer-events-none"
                >
                  <Trash2 className="w-4 h-4 text-red-450" />
                  <span>Hapus Semua Hari Ini</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Task lists container */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left Column: Routine & Assigned Tasks */}
          <div className={`${isAdmin ? "lg:col-span-1" : "lg:col-span-2"} space-y-3.5`}>
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-zinc-400" />
              <h2 className="font-semibold text-sm text-white">
                Tugas Terjadwal ({selectedDayRoutineTasks.length})
              </h2>
            </div>

            {selectedDayRoutineTasks.length === 0 ? (
              <div className="glass-panel py-16 text-center text-zinc-500 text-xs rounded-xl border border-zinc-900">
                Tidak ada agenda jobdesk terjadwal untuk tanggal ini.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayRoutineTasks.map((task) => {
                  const isCompleted = task.status === "COMPLETED";

                  return (
                    <div
                      key={task.id}
                      onClick={() => openDrawer(task)}
                      className="glass-panel p-4 rounded-xl border border-zinc-900 hover:border-zinc-800 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-950/30 transition-all duration-150"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            onClick={(e) => e.stopPropagation()} // Stop click bubbling!
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTaskIds([...selectedTaskIds, task.id]);
                              } else {
                                setSelectedTaskIds(selectedTaskIds.filter((id) => id !== task.id));
                              }
                            }}
                            className="w-4 h-4 hidden accent-white rounded border-zinc-850 cursor-pointer shrink-0"
                          />
                        )}

                        {!isAdmin && task.employeeId === userId ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleChecklist(task.id, task.status);
                            }}
                            className="mt-0.5 shrink-0 transition-transform active:scale-95 text-zinc-350"
                          >
                            {isCompleted ? (
                              <CheckSquare className="w-4.5 h-4.5 text-white" />
                            ) : (
                              <Square className="w-4.5 h-4.5 text-zinc-650 hover:text-zinc-400" />
                            )}
                          </div>
                        ) : (
                          <div className="mt-0.5 shrink-0">
                            {isCompleted ? (
                              <CheckCircle className="w-4.5 h-4.5 text-zinc-500" />
                            ) : (
                              <Clock className="w-4.5 h-4.5 text-zinc-650" />
                            )}
                          </div>
                        )}

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <h3
                              className={`font-bold text-xs truncate ${isCompleted ? "line-through text-zinc-600" : "text-zinc-200"
                                }`}
                            >
                              {task.title}
                            </h3>
                            <span
                              className={`px-1.5 py-0.5 rounded-full text-[7px] font-extrabold uppercase border ${isCompleted
                                ? "bg-zinc-900 text-white border-zinc-800"
                                : task.status === "IN_PROGRESS"
                                  ? "bg-zinc-950 text-zinc-450 border border-zinc-900"
                                  : "bg-transparent text-zinc-650 border border-zinc-900"
                                }`}
                            >
                              {isCompleted ? "Selesai" : task.status === "IN_PROGRESS" ? "Kerja" : "Pending"}
                            </span>
                          </div>

                          <div className="flex flex-col gap-1 pt-1">
                            <div className="flex items-center gap-3 text-[9px] text-zinc-550 font-bold uppercase">
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5 text-zinc-600" />
                                Penerima:{" "}
                                <span className="text-zinc-400">
                                  {task.employeeId === userId ? "Anda" : task.employee?.name || "--"}
                                </span>
                              </span>
                            </div>

                            {task.dueDate && (
                              <p className="text-[9px] text-zinc-500 font-bold flex items-center gap-1">
                                <Clock className="w-3 h-3 text-zinc-600" />
                                <span>Pelaksanaan: </span>
                                <span className="text-zinc-355 text-[9px]">
                                  Jam {new Date(task.dueDate).toLocaleTimeString("id-ID", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })} WIB
                                </span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Middle Column: Claimable FCFS Tasks */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4 h-4 text-zinc-400" />
              <h2 className="font-semibold text-sm text-white">
                Tugas Tambahan (FCFS) ({selectedDayClaimableTasks.length})
              </h2>
            </div>

            {selectedDayClaimableTasks.length === 0 ? (
              <div className="glass-panel py-16 text-center text-zinc-500 text-xs rounded-xl border border-zinc-900">
                Tidak ada tugas rebutan FCFS aktif untuk tanggal ini.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDayClaimableTasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => openDrawer(task)}
                    className="glass-panel p-4 rounded-xl border border-zinc-900 hover:border-zinc-800 space-y-4 flex flex-col justify-between cursor-pointer hover:bg-zinc-950/30 transition-all"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        {isAdmin && (
                          <input
                            type="checkbox"
                            checked={selectedTaskIds.includes(task.id)}
                            onClick={(e) => e.stopPropagation()} // Stop click bubbling!
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTaskIds([...selectedTaskIds, task.id]);
                              } else {
                                setSelectedTaskIds(selectedTaskIds.filter((id) => id !== task.id));
                              }
                            }}
                            className="w-4 h-4 accent-white rounded border-zinc-850 cursor-pointer shrink-0"
                          />
                        )}
                        <h3 className="font-bold text-xs text-zinc-200">{task.title}</h3>
                      </div>

                      {task.dueDate && (
                        <p className="text-[9px] text-zinc-500 font-bold flex items-center gap-1 mt-1">
                          <Clock className="w-3 h-3 text-zinc-600" />
                          <span>Pelaksanaan: </span>
                          <span className="text-zinc-355">
                            Jam {new Date(task.dueDate).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })} WIB
                          </span>
                        </p>
                      )}
                    </div>

                    {!isAdmin && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClaim(task.id);
                        }}
                        className="w-full py-2 bg-white hover:bg-zinc-200 text-black font-extrabold text-[10px] rounded-lg uppercase tracking-wider transition-colors cursor-pointer text-center block shadow-sm flex items-center justify-center gap-1"
                      >
                        <span>Ambil Tugas</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                    {isAdmin && (
                      <div className="text-[10px] text-zinc-550 italic">Menunggu klaim karyawan...</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Create Task Form (Admin only) */}
          {isAdmin && (
            <div className="glass-panel p-5 rounded-xl border border-zinc-900 h-fit space-y-5">
              <div className="flex items-center gap-2">
                <PlusCircle className="w-4.5 h-4.5 text-zinc-400" />
                <h2 className="font-semibold text-sm text-white">Buat Tugas Baru</h2>
              </div>

              <form ref={formRef} onSubmit={handleCreateTaskClient} className="space-y-3.5">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Judul Tugas
                  </label>
                  <input
                    type="text"
                    name="title"
                    required
                    placeholder="Contoh: Membersihkan Area Kasir"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Deskripsi / Petunjuk Operasional
                  </label>
                  <textarea
                    name="description"
                    rows={3}
                    placeholder="Tuliskan petunjuk pengerjaan di sini secara detail..."
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs resize-none"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Tipe / Periode Tugas
                  </label>
                  <select
                    name="type"
                    required
                    value={formTaskType}
                    onChange={(e) => setFormTaskType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs appearance-none"
                  >
                    <option value="ONCE">Sekali Saja / Ad-Hoc</option>
                    <option value="DAILY">Berulang (Tiap Hari)</option>
                    <option value="WEEKLY">Berulang (Tiap Minggu)</option>
                    <option value="MONTHLY">Berulang (Tiap Bulan)</option>
                  </select>
                </div>

                {/* FCFS Toggle */}
                <div className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-lg flex items-center justify-between">
                  <div>
                    <label htmlFor="isClaimable" className="block text-[10px] font-bold text-zinc-300 uppercase tracking-widest cursor-pointer">
                      Siapa Cepat Dia Dapat (FCFS)
                    </label>
                    <p className="text-[9px] text-zinc-500 mt-0.5">Tugas tambahan untuk diperebutkan.</p>
                  </div>
                  <input
                    type="checkbox"
                    name="isClaimable"
                    id="isClaimable"
                    className="w-4 h-4 accent-white rounded border-zinc-880"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Tugaskan Kepada
                  </label>
                  <select
                    name="employeeId"
                    className="w-full px-3 py-2.5 rounded-lg glass-input text-xs"
                  >
                    <option value="">Pilih Karyawan (Kosongkan jika FCFS)...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dynamic context-aware Execution Time / Date Picker */}
                {formTaskType === "ONCE" ? (
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                      Tanggal & Jam Pelaksanaan Tugas
                    </label>
                    <input
                      type="datetime-local"
                      name="dueDate"
                      required
                      onClick={(e) => {
                        try {
                          e.currentTarget.showPicker();
                        } catch (err) { }
                      }}
                      className="w-full px-3 py-2.5 rounded-lg glass-input text-xs text-zinc-400 cursor-pointer block"
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-550 uppercase tracking-widest mb-1.5">
                          Mulai Dari Tanggal
                        </label>
                        <input
                          type="date"
                          name="startDate"
                          required
                          onClick={(e) => {
                            try {
                              e.currentTarget.showPicker();
                            } catch (err) { }
                          }}
                          className="w-full px-3 py-2.5 rounded-lg glass-input text-xs text-zinc-400 cursor-pointer block"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-zinc-550 uppercase tracking-widest mb-1.5">
                          Jam Pelaksanaan
                        </label>
                        <input
                          type="time"
                          name="startTime"
                          required
                          onClick={(e) => {
                            try {
                              e.currentTarget.showPicker();
                            } catch (err) { }
                          }}
                          className="w-full px-3 py-2.5 rounded-lg glass-input text-xs text-zinc-400 cursor-pointer block"
                        />
                      </div>
                    </div>
                    <p className="text-[9px] text-zinc-500 mt-1 leading-relaxed">
                      {formTaskType === "DAILY" ? (
                        "Tugas harian akan berulang otomatis setiap hari mulai dari tanggal dan jam yang ditentukan."
                      ) : formTaskType === "WEEKLY" ? (
                        "Tugas mingguan akan berulang otomatis setiap 7 hari sekali (H+7) mulai dari tanggal dan jam yang ditentukan."
                      ) : (
                        "Tugas bulanan akan berulang otomatis setiap 30 hari sekali (H+30) mulai dari tanggal dan jam yang ditentukan."
                      )}
                    </p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending}
                  className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer disabled:opacity-50"
                >
                  {isPending ? "Memproses..." : "Rilis Tugas Kerja"}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Dynamic Help Text */}
        {!isAdmin && (
          <div className="pt-3 border-t border-zinc-900 text-[10px] font-semibold text-zinc-500 leading-relaxed">
            <p className="flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-zinc-550 shrink-0" />
              <span>Klik kotak centang pada jobdesk Anda untuk menyelesaikan tugas. Klik kartu untuk melihat detail atau berbagi catatan.</span>
            </p>
          </div>
        )}
      </div>

      {/* Centered Detail Popup Modal */}
      {drawerOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          {/* Backdrop Overlay */}
          <div className="absolute inset-0" onClick={() => setDrawerOpen(false)} />

          {/* Modal Content Box */}
          <div className="w-full max-w-lg max-h-[85vh] bg-zinc-950/90 border border-zinc-900 rounded-2xl p-6 flex flex-col justify-between shadow-2xl relative z-10 animate-scale-in overflow-hidden">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Task Info */}
            <div className="space-y-5 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2 pt-4">
                <span className="inline-block px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[8px] font-extrabold uppercase rounded">
                  {selectedTask.type === "ONCE" ? "Sekali Saja" : selectedTask.type === "DAILY" ? "Harian" : selectedTask.type === "WEEKLY" ? "Mingguan" : "Bulanan"}
                </span>
                <h3 className="font-bold text-lg text-white leading-tight">{selectedTask.title}</h3>
                <div className="flex items-center gap-2 flex-wrap text-xs text-zinc-400">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5" /> {selectedTask.employee?.name || "Tugas claimable FCFS"}
                  </span>
                  <span>•</span>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border ${selectedTask.status === "COMPLETED"
                      ? "bg-zinc-900 text-white border-zinc-800"
                      : selectedTask.status === "IN_PROGRESS"
                        ? "bg-zinc-950 text-zinc-450 border border-zinc-900"
                        : "bg-transparent text-zinc-650 border border-zinc-900"
                      }`}
                  >
                    {selectedTask.status === "COMPLETED" ? "Selesai" : selectedTask.status === "IN_PROGRESS" ? "Pengerjaan" : "Pending"}
                  </span>
                </div>
              </div>

              {selectedTask.dueDate && (
                <div className="flex items-center gap-3.5 p-3.5 bg-zinc-950/40 border border-zinc-900 rounded-xl text-xs">
                  <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest leading-none">Jadwal Pelaksanaan</p>
                    <p className="text-zinc-300 font-semibold mt-1">
                      {new Date(selectedTask.dueDate).toLocaleDateString("id-ID", {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}{" "}
                      • Jam{" "}
                      <span className="text-white font-extrabold">
                        {new Date(selectedTask.dueDate).toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>{" "}
                      WIB
                    </p>
                  </div>
                </div>
              )}

              {isAdmin && (
                <div className="pt-1 space-y-2">
                  <button
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    className="w-full py-2 bg-red-950/10 hover:bg-red-950/20 border border-red-900/40 text-red-400 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Tugas Hari Ini Saja</span>
                  </button>

                  {selectedTask.type !== "ONCE" && (
                    <button
                      onClick={() => handleDeleteAllRecurringTasks(selectedTask.id)}
                      className="w-full py-2 bg-red-950/30 hover:bg-red-950/50 border border-red-900 text-red-300 font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Semua Tugas Berulang ({selectedTask.type === "DAILY" ? "Harian" : selectedTask.type === "WEEKLY" ? "Mingguan" : "Bulanan"})</span>
                    </button>
                  )}
                </div>
              )}

              {/* TIMER SECTION */}
              {selectedTask.employeeId === userId && selectedTask.status !== "COMPLETED" && (
                <div className="p-4 bg-zinc-950/60 border border-zinc-900 rounded-xl space-y-3 mb-2 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-zinc-400" /> Timer Presisi Jobdesk
                    </span>
                    {selectedTask.timerStartedAt && (
                      <span className="text-[8px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded font-extrabold uppercase animate-pulse">
                        Timer Aktif
                      </span>
                    )}
                  </div>

                  {(() => {
                    const remaining = getTaskRemainingSeconds(selectedTask);
                    const isTimerRunning = !!selectedTask.timerStartedAt && remaining > 0;
                    const isTimerPaused = !selectedTask.timerStartedAt && (selectedTask.timerDuration || 0) > 0;
                    const isTimerInactive = !selectedTask.timerStartedAt && !(selectedTask.timerDuration || 0);

                    const formatTime = (secs: number) => {
                      const m = Math.floor(secs / 60);
                      const s = secs % 60;
                      return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
                    };

                    return (
                      <div className="flex flex-col items-center space-y-3">
                        {!isTimerInactive ? (
                          <div className={`text-3xl font-mono font-bold tracking-widest ${isTimerRunning ? 'text-white animate-pulse' : 'text-zinc-555'}`}>
                            {formatTime(remaining)}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="1"
                              max="1440"
                              value={timerInputMinutes}
                              onChange={(e) => setTimerInputMinutes(Math.max(1, Number(e.target.value)))}
                              className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-850 rounded text-center text-xs text-white"
                            />
                            <span className="text-xs text-zinc-450">Menit</span>
                          </div>
                        )}

                        <div className="flex gap-2 w-full">
                          {isTimerInactive && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartTimer(timerInputMinutes * 60)}
                                className="flex-1 py-1.5 bg-white text-black font-extrabold text-[10px] rounded-lg uppercase tracking-wider cursor-pointer hover:bg-zinc-200"
                              >
                                Mulai
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimerInputMinutes(5)}
                                className="py-1.5 px-2.5 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-350 font-bold rounded-lg uppercase cursor-pointer hover:bg-zinc-800"
                              >
                                5m
                              </button>
                              <button
                                type="button"
                                onClick={() => setTimerInputMinutes(15)}
                                className="py-1.5 px-2.5 bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-350 font-bold rounded-lg uppercase cursor-pointer hover:bg-zinc-800"
                              >
                                15m
                              </button>
                            </>
                          )}

                          {isTimerRunning && (
                            <>
                              <button
                                type="button"
                                onClick={handlePauseTimer}
                                className="flex-1 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-350 font-extrabold text-[10px] rounded-lg uppercase tracking-wider cursor-pointer hover:bg-zinc-800"
                              >
                                Jeda
                              </button>
                              <button
                                type="button"
                                onClick={handleResetTimer}
                                className="flex-1 py-1.5 bg-red-955/20 border border-red-900/40 text-red-400 font-bold text-[10px] rounded-lg uppercase tracking-wider cursor-pointer hover:bg-red-955/30"
                              >
                                Reset
                              </button>
                            </>
                          )}

                          {isTimerPaused && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleStartTimer(remaining)}
                                className="flex-1 py-1.5 bg-white text-black font-extrabold text-[10px] rounded-lg uppercase tracking-wider cursor-pointer hover:bg-zinc-200"
                              >
                                Lanjutkan
                              </button>
                              <button
                                type="button"
                                onClick={handleResetTimer}
                                className="flex-1 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-450 font-bold text-[10px] rounded-lg uppercase tracking-wider cursor-pointer hover:bg-zinc-800"
                              >
                                Reset
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {!isAdmin && selectedTask.employeeId === userId && (
                <div className="pt-1">
                  <button
                    onClick={() => {
                      handleToggleChecklist(selectedTask.id, selectedTask.status);
                      setSelectedTask((prev: any) =>
                        prev
                          ? {
                            ...prev,
                            status: prev.status === "COMPLETED" ? "PENDING" : "COMPLETED",
                          }
                          : null
                      );
                    }}
                    className={`w-full py-2.5 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${selectedTask.status === "COMPLETED"
                      ? "bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white"
                      : "apple-btn-primary"
                      }`}
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>
                      {selectedTask.status === "COMPLETED"
                        ? "Buka Kembali Tugas (Batal Selesai)"
                        : "Tandai Tugas Selesai Kerja"}
                    </span>
                  </button>
                </div>
              )}

              {selectedTask.description && (
                <div className="space-y-2 p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg">
                  <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5" /> Petunjuk Deskripsi
                  </span>
                  <p className="text-xs text-zinc-350 leading-relaxed font-medium whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}

              {/* Shared Notes Chat area */}
              <div className="space-y-3 pt-2">
                <span className="text-[9px] font-bold text-zinc-550 uppercase tracking-widest flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" /> Catatan Bersama (Shared Notes)
                </span>

                {loadingComments ? (
                  <div className="py-8 text-center text-zinc-600 text-xs">Memuat catatan...</div>
                ) : comments.length === 0 ? (
                  <div className="py-8 text-center text-zinc-600 text-xs italic">
                    Belum ada catatan bersama di tugas ini. Silakan tulis di bawah!
                  </div>
                ) : (
                  <div className="space-y-3.5">
                    {comments.map((comment) => (
                      <div key={comment.id} className="p-3 bg-zinc-950/60 border border-zinc-900 rounded-lg space-y-1 text-xs">
                        <div className="flex justify-between items-center text-[10px] text-zinc-550 font-bold">
                          <span className="text-zinc-300">{comment.author.name} ({comment.author.role})</span>
                          <span>{new Date(comment.createdAt).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-zinc-400 font-medium whitespace-pre-wrap leading-relaxed">{comment.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Comment Form input at the bottom */}
            <form onSubmit={handleAddComment} className="pt-4 border-t border-zinc-900 flex gap-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Bagikan catatan/update pengerjaan..."
                className="flex-1 px-3 py-2 rounded-lg glass-input text-xs"
              />
              <button
                type="submit"
                disabled={submittingComment || !newComment.trim()}
                className="p-2 rounded-lg apple-btn-primary cursor-pointer shrink-0 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* FLOATING TIMER WIDGET (BACKGROUND RUNNING TIMER) */}
      {(() => {
        const runningTimerTask = allTasks.find(
          (t) => t.timerStartedAt && t.status !== "COMPLETED" && getTaskRemainingSeconds(t) > 0
        );

        if (!runningTimerTask || (drawerOpen && selectedTask?.id === runningTimerTask.id)) return null;

        const remaining = getTaskRemainingSeconds(runningTimerTask);
        const formatTime = (secs: number) => {
          const m = Math.floor(secs / 60);
          const s = secs % 60;
          return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
        };

        return (
          <div 
            onClick={() => openDrawer(runningTimerTask)}
            className="fixed bottom-20 right-4 md:right-8 bg-zinc-950/80 backdrop-blur-md border border-indigo-500/30 p-3.5 rounded-xl flex items-center gap-3.5 cursor-pointer shadow-2xl z-40 animate-slide-in hover:border-indigo-400 transition-all group max-w-xs text-left"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/20">
              <Clock className="w-4 h-4 animate-spin-slow" />
            </div>
            
            <div className="min-w-0">
              <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-widest block">Timer Berjalan</span>
              <h4 className="text-[10px] text-zinc-300 font-semibold truncate mt-0.5 max-w-[150px]">{runningTimerTask.title}</h4>
              <span className="text-sm font-mono font-bold text-white tracking-widest block mt-0.5">{formatTime(remaining)}</span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
