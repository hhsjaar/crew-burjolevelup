"use client";

import { useState, useEffect } from "react";
import { updateTaskStatus, claimTask, addTaskComment, getTaskComments, deleteTask, deleteAllTasks, deleteMultipleTasks } from "@/actions/tasks";
import { ClipboardList, PlusCircle, CheckCircle, RefreshCw, Trash2, Calendar, User, AlignLeft, X, MessageSquare, Send } from "lucide-react";
import { toast } from "sonner";

interface JobdeskListProps {
  initialTasks: any[];
  isAdmin: boolean;
  userId: string;
}

export default function JobdeskList({ initialTasks, isAdmin, userId }: JobdeskListProps) {
  const [tasks, setTasks] = useState(initialTasks);
  const [currentTab, setCurrentTab] = useState<"ONCE" | "DAILY" | "WEEKLY" | "MONTHLY">("DAILY");
  
  // Selection states for Admin checklist deletion
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  
  // Drawer States
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);

  // Sync tasks when initialTasks changes (e.g. after server action revalidation)
  useEffect(() => {
    setTasks(initialTasks);
    if (selectedTask) {
      const updated = initialTasks.find((t) => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
    }
  }, [initialTasks]);

  // Load comments when a task is selected
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
        // Reload comments
        await loadComments(selectedTask.id);
        toast.success("Catatan berhasil dibagikan.");
      }
    } catch (err) {
      toast.error("Gagal menambahkan catatan.");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleUpdateStatus = async (taskId: string, currentStatus: string) => {
    setStatusLoading(true);
    try {
      const nextStatus = currentStatus === "PENDING" ? "IN_PROGRESS" : "COMPLETED";
      const res = await updateTaskStatus(taskId, nextStatus);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Tugas diperbarui ke ${nextStatus === "IN_PROGRESS" ? "Pengerjaan" : "Selesai"}!`);
        // Update local tasks
        if (res.task) {
          setTasks(tasks.map((t) => (t.id === taskId ? { ...t, status: res.task.status } : t)));
        }
      }
    } catch (err) {
      toast.error("Gagal memperbarui status tugas.");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleClaim = async (taskId: string) => {
    try {
      const res = await claimTask(taskId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Tugas tambahan berhasil Anda klaim!");
        if (res.task) {
          setTasks(tasks.map((t) => (t.id === taskId ? { ...t, employeeId: userId, status: "IN_PROGRESS" } : t)));
        }
      }
    } catch (err) {
      toast.error("Gagal mengklaim tugas.");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus tugas ini secara permanen?")) return;
    try {
      const res = await deleteTask(taskId);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Tugas berhasil dihapus!");
        setDrawerOpen(false);
        setTasks(tasks.filter((t) => t.id !== taskId));
      }
    } catch (err) {
      toast.error("Gagal menghapus tugas.");
    }
  };

  const handleDeleteAllTasks = async (type: string) => {
    const label = type === "ONCE" ? "Sekali Saja" : type === "DAILY" ? "Harian" : type === "WEEKLY" ? "Mingguan" : "Bulanan";
    if (!confirm(`Apakah Anda YAKIN ingin menghapus SELURUH tugas berkategori "${label}"? Tindakan ini bersifat permanen dan tidak dapat dibatalkan.`)) return;

    try {
      const res = await deleteAllTasks(type);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Seluruh tugas kategori "${label}" berhasil dikosongkan!`);
        setTasks(tasks.filter((t) => t.type !== type));
        setSelectedTaskIds([]);
      }
    } catch (err) {
      toast.error("Gagal mengosongkan tugas.");
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
        setSelectedTaskIds([]);
      }
    } catch (err) {
      toast.error("Gagal menghapus tugas terpilih.");
    }
  };

  // Filter tasks based on tab & claim status
  const filteredRoutineTasks = tasks.filter(
    (t) => t.type === currentTab && (!t.isClaimable || t.employeeId !== null)
  );

  const filteredClaimableTasks = tasks.filter(
    (t) => t.type === currentTab && t.isClaimable && t.employeeId === null
  );

  const openDrawer = (task: any) => {
    setSelectedTask(task);
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Tabs Switcher - Apple glass pill style */}
        <div className="flex gap-1.5 p-1 bg-zinc-950/60 border border-zinc-900 rounded-xl w-full sm:max-w-md">
          {(["ONCE", "DAILY", "WEEKLY", "MONTHLY"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setCurrentTab(tab)}
              className={`flex-1 py-2 px-3 text-center text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                currentTab === tab ? "glass-tab-active text-white" : "text-zinc-550 hover:text-zinc-350"
              }`}
            >
              {tab === "ONCE" ? "Sekali Saja" : tab === "DAILY" ? "Harian" : tab === "WEEKLY" ? "Mingguan" : "Bulanan"}
            </button>
          ))}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            {/* Select All Option */}
            {(filteredRoutineTasks.length > 0 || filteredClaimableTasks.length > 0) && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-zinc-950/60 border border-zinc-900 text-[10px] font-bold text-zinc-400 uppercase tracking-widest cursor-pointer select-none shrink-0">
                <input
                  type="checkbox"
                  id="selectAllTasks"
                  checked={
                    (filteredRoutineTasks.length > 0 ? filteredRoutineTasks.every((t) => selectedTaskIds.includes(t.id)) : true) &&
                    (filteredClaimableTasks.length > 0 ? filteredClaimableTasks.every((t) => selectedTaskIds.includes(t.id)) : true)
                  }
                  onChange={(e) => {
                    const allCurrentIds = [
                      ...filteredRoutineTasks.map((t) => t.id),
                      ...filteredClaimableTasks.map((t) => t.id)
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
                className="py-2.5 px-4 border border-red-900 bg-red-950/20 hover:bg-red-950/40 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
                <span>Hapus Terpilih ({selectedTaskIds.length})</span>
              </button>
            ) : (
              <button
                onClick={() => handleDeleteAllTasks(currentTab)}
                className="py-2.5 px-4 border border-red-955 bg-red-955/10 hover:bg-red-955/30 text-red-400 hover:text-red-300 text-xs font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer shrink-0 justify-center"
              >
                <Trash2 className="w-4 h-4 text-red-455" />
                <span>Hapus Semua</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Grid: Jobdesks & Claimable Jobdesks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Routine / Assigned Tasks List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-zinc-400" />
            <h2 className="font-semibold text-sm text-white">
              Tugas Terjadwal & Rutin ({currentTab === "ONCE" ? "Sekali Saja" : currentTab === "DAILY" ? "Harian" : currentTab === "WEEKLY" ? "Mingguan" : "Bulanan"})
            </h2>
          </div>

          {filteredRoutineTasks.length === 0 ? (
            <div className="glass-panel py-16 text-center text-zinc-500 text-xs rounded-xl border border-zinc-900">
              Belum ada tugas terjadwal untuk kategori ini.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRoutineTasks.map((task) => {
                return (
                  <div
                    key={task.id}
                    onClick={() => openDrawer(task)}
                    className="glass-panel p-4 rounded-xl border border-zinc-900 hover:border-zinc-800 flex items-center justify-between gap-4 cursor-pointer hover:bg-zinc-950/30 transition-all duration-150"
                  >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    {isAdmin && (
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.includes(task.id)}
                        onChange={(e) => {
                          e.stopPropagation(); // Avoid opening drawer
                          if (e.target.checked) {
                            setSelectedTaskIds([...selectedTaskIds, task.id]);
                          } else {
                            setSelectedTaskIds(selectedTaskIds.filter((id) => id !== task.id));
                          }
                        }}
                        className="w-4.5 h-4.5 accent-white rounded border-zinc-850 cursor-pointer shrink-0"
                      />
                    )}
                    
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-sm text-zinc-200 truncate">{task.title}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border ${
                          task.status === "COMPLETED"
                            ? "bg-zinc-900 text-white border-zinc-800"
                            : task.status === "IN_PROGRESS"
                            ? "bg-zinc-950 text-zinc-450 border border-zinc-900"
                            : "bg-transparent text-zinc-650 border border-zinc-900"
                        }`}
                      >
                        {task.status === "COMPLETED" ? "Selesai" : task.status === "IN_PROGRESS" ? "Pengerjaan" : "Pending"}
                      </span>
                      {task.isClaimable && (
                        <span className="px-1.5 py-0.5 text-[8px] font-extrabold bg-white text-black rounded-md shadow-sm">
                          TAMBAHAN (KLAIM)
                        </span>
                      )}
                    </div>

                    
                    <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-semibold pt-1">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        Penerima: <span className="text-zinc-350">{task.employee?.name || "Siapa Cepat Dia Dapat"}</span>
                      </span>
                      {task.dueDate && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Batas: <span className="text-zinc-350">{new Date(task.dueDate).toLocaleString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                  {/* Complete status form */}
                  {!isAdmin && task.employeeId === userId && task.status !== "COMPLETED" && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation(); // Avoid opening drawer
                        handleUpdateStatus(task.id, task.status);
                      }}
                      disabled={statusLoading}
                      className="px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-white font-semibold text-xs transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                      {task.status === "PENDING" ? "Kerjakan" : "Selesaikan"}
                    </button>
                  )}
                </div>
              );
            })}
            </div>
          )}
        </div>

        {/* Claimable Additional Tasks Column */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="w-4 h-4 text-zinc-400" />
            <h2 className="font-semibold text-sm text-white">Tugas Tambahan (FCFS)</h2>
          </div>

          {filteredClaimableTasks.length === 0 ? (
            <div className="glass-panel py-16 text-center text-zinc-500 text-xs rounded-xl border border-zinc-900">
              Tidak ada tugas tambahan yang tersedia untuk diklaim.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredClaimableTasks.map((task) => (
                <div
                  key={task.id}
                  className="glass-panel p-4 rounded-xl border border-zinc-900 hover:border-zinc-800 space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2.5">
                      {isAdmin && (
                        <input
                          type="checkbox"
                          checked={selectedTaskIds.includes(task.id)}
                          onChange={(e) => {
                            e.stopPropagation(); // Avoid opening drawer
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
                      <p className="text-[10px] text-zinc-500 font-bold flex items-center gap-1 mt-1">
                        <Calendar className="w-3.5 h-3.5" /> Batas: {new Date(task.dueDate).toLocaleString("id-ID", { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} WIB
                      </p>
                    )}
                  </div>

                  {!isAdmin && (
                    <button
                      onClick={() => handleClaim(task.id)}
                      className="w-full py-2 bg-white hover:bg-zinc-200 text-black font-semibold text-[11px] rounded-lg uppercase tracking-wider transition-colors cursor-pointer text-center block shadow-sm"
                    >
                      Ambil Tugas
                    </button>
                  )}
                  {isAdmin && (
                    <div className="text-[10px] text-zinc-500 italic">Menunggu klaim karyawan...</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Detail Drawer (iPadOS style) */}
      {drawerOpen && selectedTask && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex justify-end animate-fade-in">
          {/* Backdrop closer */}
          <div className="flex-1" onClick={() => setDrawerOpen(false)} />

          {/* Drawer container */}
          <div className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-900 p-6 flex flex-col justify-between shadow-2xl relative">
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            {/* Task Info */}
            <div className="space-y-5 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
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
                    className={`inline-block px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border ${
                      selectedTask.status === "COMPLETED"
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

              {isAdmin && (
                <div className="pt-1">
                  <button
                    onClick={() => handleDeleteTask(selectedTask.id)}
                    className="w-full py-2 bg-red-950/10 hover:bg-red-950/30 border border-red-900/40 text-red-400 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hapus Tugas Secara Permanen</span>
                  </button>
                </div>
              )}

              {selectedTask.description && (
                <div className="space-y-2 p-4 bg-zinc-950/40 border border-zinc-900 rounded-lg">
                  <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                    <AlignLeft className="w-3.5 h-3.5" /> Petunjuk Deskripsi
                  </span>
                  <p className="text-xs text-zinc-350 leading-relaxed font-medium whitespace-pre-wrap">{selectedTask.description}</p>
                </div>
              )}

              {/* Shared Notes Chat area */}
              <div className="space-y-3 pt-2">
                <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
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
                        <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold">
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
    </div>
  );
}
