import { getCurrentEmployee } from "@/actions/auth";
import { getEmployeeLeaveRequests, getAllLeaveRequests, submitLeaveRequest, approveLeaveRequest, rejectLeaveRequest } from "@/actions/leave";
import { FileText, PlusCircle, CheckCircle, XCircle, Clock, Calendar, AlignLeft } from "lucide-react";
import { redirect } from "next/navigation";

export default async function LeavePage() {
  const user = await getCurrentEmployee();
  if (!user) redirect("/login");

  const isEmployee = user.role === "EMPLOYEE";

  // Fetch appropriate requests
  const requests = isEmployee
    ? await getEmployeeLeaveRequests(user.id)
    : await getAllLeaveRequests();

  const totalRequests = requests.length;
  const pendingRequests = requests.filter((r) => r.status === "PENDING").length;
  const approvedRequests = requests.filter((r) => r.status === "APPROVED").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-zinc-400" />
          <span>Izin & Cuti Karyawan</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          {isEmployee
            ? "Ajukan surat izin sakit atau permohonan cuti tahunan, serta pantau status verifikasi oleh admin secara berkala."
            : "Manajemen, peninjauan, dan verifikasi permohonan izin sakit atau cuti tahunan dari karyawan operasional."}
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-3 gap-4 max-w-sm">
        <div className="glass-panel p-4 rounded-xl border border-zinc-900 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Total</p>
          <p className="text-sm font-black text-white mt-1">{totalRequests}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-zinc-900 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-zinc-450">Pending</p>
          <p className="text-sm font-black text-zinc-300 mt-1">{pendingRequests}</p>
        </div>
        <div className="glass-panel p-4 rounded-xl border border-zinc-900 text-center">
          <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest text-white">Disetujui</p>
          <p className="text-sm font-black text-white mt-1">{approvedRequests}</p>
        </div>
      </div>

      {/* Grid: Request List & Submit Form (Employee only) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Requests List */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-zinc-400" />
            <h2 className="font-semibold text-sm text-white">
              {isEmployee ? "Riwayat Pengajuan Cuti Anda" : "Semua Pengajuan Menunggu Tindakan"}
            </h2>
          </div>

          {requests.length === 0 ? (
            <div className="glass-panel py-16 text-center text-zinc-500 text-xs rounded-xl border border-zinc-900">
              Belum ada pengajuan izin atau cuti yang tercatat saat ini.
            </div>
          ) : (
            <div className="space-y-3.5">
              {requests.map((req: any) => (
                <div
                  key={req.id}
                  className="glass-panel p-5 rounded-xl border border-zinc-900 flex flex-col gap-4 relative overflow-hidden"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        {!isEmployee && (
                          <span className="font-bold text-xs text-white">{req.employee.name}</span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[8px] font-extrabold uppercase border ${
                            req.type === "SICK"
                              ? "bg-red-500/5 text-red-400 border-red-500/10"
                              : req.type === "URGENT"
                              ? "bg-zinc-900 text-zinc-300 border border-zinc-800"
                              : "bg-white/5 text-white border border-white/10"
                          }`}
                        >
                          {req.type === "SICK" ? "Sakit" : req.type === "URGENT" ? "Keperluan Mendesak" : "Cuti"}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed font-semibold mt-1">
                        Sebab: {req.reason}
                      </p>
                      <div className="flex items-center gap-4 text-[10px] text-zinc-500 font-bold pt-1.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          Durasi: <span className="text-zinc-350">
                            {new Date(req.startDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short' })} - {new Date(req.endDate).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="shrink-0 self-start">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase border ${
                          req.status === "APPROVED"
                            ? "bg-zinc-900 text-white border-zinc-800"
                            : req.status === "REJECTED"
                            ? "bg-red-500/5 text-red-400 border-red-500/15"
                            : "bg-zinc-950 text-zinc-500 border border-zinc-900"
                        }`}
                      >
                        {req.status === "APPROVED" ? (
                          <CheckCircle className="w-3.5 h-3.5" />
                        ) : req.status === "REJECTED" ? (
                          <XCircle className="w-3.5 h-3.5" />
                        ) : (
                          <Clock className="w-3.5 h-3.5" />
                        )}
                        <span>{req.status === "APPROVED" ? "Disetujui" : req.status === "REJECTED" ? "Ditolak" : "Pending"}</span>
                      </span>
                    </div>
                  </div>

                  {/* Admin Notes Section */}
                  {req.adminNotes && (
                    <div className="p-3.5 bg-zinc-950/60 rounded-lg border border-zinc-900 text-[11px] text-zinc-400 italic">
                      <span className="font-bold text-white not-italic block mb-0.5">Catatan Admin:</span>
                      {req.adminNotes}
                    </div>
                  )}

                  {/* Admin Action Buttons */}
                  {!isEmployee && req.status === "PENDING" && (
                    <div className="pt-3.5 border-t border-zinc-900 flex flex-col sm:flex-row gap-3">
                      <form
                        action={async (formData: FormData) => {
                          "use server";
                          await approveLeaveRequest(req.id, formData.get("adminNotes") as string);
                        }}
                        className="flex-1 flex gap-2"
                      >
                        <input
                          type="text"
                          name="adminNotes"
                          placeholder="Catatan persetujuan (opsional)..."
                          className="flex-1 px-3 py-2 rounded-lg glass-input text-xs"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-lg apple-btn-primary text-xs uppercase cursor-pointer"
                        >
                          Setujui
                        </button>
                      </form>

                      <form
                        action={async (formData: FormData) => {
                          "use server";
                          await rejectLeaveRequest(req.id, formData.get("adminNotes") as string);
                        }}
                        className="flex gap-2"
                      >
                        <input
                          type="text"
                          name="adminNotes"
                          placeholder="Alasan penolakan..."
                          required
                          className="px-3 py-2 rounded-lg glass-input text-xs w-48"
                        />
                        <button
                          type="submit"
                          className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-red-400 hover:text-red-300 text-xs font-bold uppercase cursor-pointer"
                        >
                          Tolak
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit Request Form (Employee only) */}
        {isEmployee && (
          <div className="glass-panel p-5 rounded-xl border border-zinc-900 h-fit space-y-5">
            <div className="flex items-center gap-2">
              <PlusCircle className="w-4.5 h-4.5 text-zinc-400" />
              <h2 className="font-semibold text-sm text-white">Ajukan Cuti / Izin</h2>
            </div>

            <form
              action={async (formData: FormData) => {
                "use server";
                await submitLeaveRequest(formData);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Tipe Pengajuan
                </label>
                <select
                  name="type"
                  required
                  className="w-full px-3 py-2 rounded-lg glass-input text-xs text-zinc-300"
                >
                  <option value="SICK">Sakit (Sick Leave)</option>
                  <option value="LEAVE">Cuti Tahunan (Annual Leave)</option>
                  <option value="URGENT">Keperluan Mendesak (Urgent Leave)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Tanggal Mulai
                  </label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    className="w-full px-3 py-2 rounded-lg glass-input text-xs text-zinc-400"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                    Tanggal Selesai
                  </label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    className="w-full px-3 py-2 rounded-lg glass-input text-xs text-zinc-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                  Alasan & Keterangan
                </label>
                <textarea
                  name="reason"
                  rows={4}
                  required
                  placeholder="Tuliskan keterangan detail mengapa Anda mengajukan izin cuti..."
                  className="w-full px-3 py-2 rounded-lg glass-input text-xs resize-none"
                />
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer animate-pulse-hover"
              >
                Kirim Pengajuan Resmi
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
