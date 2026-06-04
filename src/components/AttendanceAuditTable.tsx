"use client";

import { useState } from "react";
import { Camera, MapPin, X, Calendar, User, Clock, AlertCircle } from "lucide-react";

interface AttendanceAuditTableProps {
  attendances: any[];
}

export default function AttendanceAuditTable({ attendances }: AttendanceAuditTableProps) {
  const [selectedSelfie, setSelectedSelfie] = useState<{ name: string; type: "Masuk" | "Pulang"; image: string } | null>(null);

  const formatTime = (dateStr: Date | string | null) => {
    if (!dateStr) return "--:--";
    return new Date(dateStr).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-zinc-900 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Camera className="w-4.5 h-4.5 text-zinc-400" />
          <h2 className="font-semibold text-sm text-white">Log Audit Kehadiran (Selfie & GPS)</h2>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider bg-zinc-900 text-zinc-400 px-3 py-1 rounded border border-zinc-800">
          {attendances.length} Catatan Absensi
        </span>
      </div>

      {attendances.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 text-xs">
          Belum ada rekaman kehadiran untuk periode terpilih.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 text-zinc-550 font-bold uppercase tracking-wider text-[9px]">
                <th className="py-2.5 px-3">Karyawan</th>
                <th className="py-2.5 px-3">Tanggal</th>
                <th className="py-2.5 px-3">Shift</th>
                <th className="py-2.5 px-3">Jam Absen</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 max-w-[200px]">Catatan / Alasan</th>
              </tr>
            </thead>
            <tbody>
              {attendances.map((att) => (
                <tr key={att.id} className="border-b border-zinc-950 hover:bg-zinc-950/20 transition-colors">
                  <td className="py-4 px-3">
                    <span className="font-bold text-zinc-200 block">{att.employee.name}</span>
                    <span className="text-[10px] text-zinc-500">{att.employee.email}</span>
                  </td>
                  <td className="py-4 px-3 font-semibold text-zinc-300">
                    {new Date(att.date).toLocaleDateString("id-ID", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  
                  {/* Shift info */}
                  <td className="py-4 px-3 font-semibold text-zinc-300">
                    <span className="font-bold text-zinc-300 block">{att.shift?.name || "-"}</span>
                    <span className="text-[10px] text-zinc-500">{att.shift?.startTime ? `${att.shift.startTime} WIB` : ""}</span>
                  </td>

                  {/* Clock In Audit info */}
                  <td className="py-4 px-3 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                      <Clock className="w-3.5 h-3.5 text-zinc-550" />
                      {formatTime(att.clockIn)}
                    </div>
                    <div className="flex items-center gap-2">
                      {att.clockInSelfie ? (
                        <button
                          onClick={() => setSelectedSelfie({ name: att.employee.name, type: "Masuk", image: att.clockInSelfie })}
                          className="w-8 h-8 rounded bg-zinc-900 border border-zinc-850 overflow-hidden hover:border-zinc-500 transition-colors cursor-pointer shrink-0"
                        >
                          <img src={att.clockInSelfie} alt="Selfie Clock In" className="w-full h-full object-cover" />
                        </button>
                      ) : (
                        <span className="text-[8px] bg-zinc-900 text-zinc-650 px-1 py-0.5 rounded border border-zinc-900 shrink-0">NO SELFIE</span>
                      )}
                      
                      {att.clockInLatitude && att.clockInLongitude ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${att.clockInLatitude},${att.clockInLongitude}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-zinc-900 border border-zinc-850 text-zinc-400 hover:text-white transition-colors"
                          title="Lihat Lokasi GPS Masuk"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-[8px] text-zinc-650">NO GPS</span>
                      )}
                    </div>
                  </td>

                  {/* Status Info */}
                  <td className="py-4 px-3 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase border ${
                        att.status === "LATE"
                          ? "bg-red-500/5 text-red-400 border-red-500/10"
                          : att.status === "LEAVE"
                          ? "bg-zinc-900/60 text-zinc-400 border-zinc-800"
                          : "bg-white/5 text-white border-white/20"
                      }`}
                    >
                      {att.status === "LATE" ? (
                        "Terlambat"
                      ) : att.status === "LEAVE" ? (
                        "Izin/Cuti"
                      ) : att.status === "ABSENT" ? (
                        "Alpa"
                      ) : (
                        "Tepat Waktu"
                      )}
                    </span>
                  </td>

                  {/* Notes */}
                  <td className="py-4 px-3 text-zinc-400 font-medium italic max-w-[200px] truncate" title={att.notes || ""}>
                    {att.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
              <h3 className="font-semibold text-sm text-white">Selfie Absensi</h3>
              <p className="text-[10px] text-zinc-500 mt-0.5">
                Karyawan: <span className="text-zinc-300 font-semibold">{selectedSelfie.name}</span> • Absen: <span className="text-zinc-300 font-semibold">{selectedSelfie.type}</span>
              </p>
            </div>

            <div className="aspect-square w-full rounded-lg overflow-hidden border border-zinc-800 bg-black">
              <img src={selectedSelfie.image} alt="Selfie Absensi" className="w-full h-full object-cover" />
            </div>

            <button
              onClick={() => setSelectedSelfie(null)}
              className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-secondary cursor-pointer"
            >
              Tutup Pratinjau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
