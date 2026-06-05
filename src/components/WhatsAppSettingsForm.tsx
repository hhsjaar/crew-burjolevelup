"use client";

import { useState } from "react";
import { saveWhatsAppSettings, sendWhatsAppTestMessage, triggerUnfinishedTasksRecap } from "@/actions/whatsappSettings";
import { toast } from "sonner";
import { Send, Bell, Settings, Power, Clock, MessageSquare, AlertCircle, RefreshCw } from "lucide-react";

interface WhatsAppSettingsFormProps {
  initialSettings: {
    adminNumber: string;
    notificationTime: string;
    enabled: boolean;
  };
}

export default function WhatsAppSettingsForm({ initialSettings }: WhatsAppSettingsFormProps) {
  const [adminNumber, setAdminNumber] = useState(initialSettings.adminNumber);
  const [notificationTime, setNotificationTime] = useState(initialSettings.notificationTime);
  const [enabled, setEnabled] = useState(initialSettings.enabled);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isRecapping, setIsRecapping] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    const formData = new FormData();
    formData.append("adminNumber", adminNumber);
    formData.append("notificationTime", notificationTime);
    formData.append("enabled", enabled ? "true" : "false");

    try {
      const res = await saveWhatsAppSettings(formData);
      if (res.success) {
        toast.success("Pengaturan WhatsApp berhasil disimpan!");
      } else {
        toast.error(res.error || "Gagal menyimpan pengaturan.");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan sistem saat menyimpan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestMessage = async () => {
    setIsTesting(true);
    toast.info("Mengirim pesan tes WhatsApp...");
    try {
      const res = await sendWhatsAppTestMessage();
      if (res.success) {
        toast.success("Pesan tes berhasil dikirim ke " + adminNumber);
      } else {
        toast.error(res.error || "Gagal mengirim pesan tes.");
      }
    } catch (err) {
      toast.error("Koneksi gagal atau terjadi error.");
    } finally {
      setIsTesting(false);
    }
  };

  const handleTriggerRecap = async () => {
    setIsRecapping(true);
    toast.info("Mengompilasi dan mengirim rekap tugas...");
    try {
      const res = await triggerUnfinishedTasksRecap();
      if (res.success) {
        toast.success(`Rekap terkirim! Ditemukan ${res.count} tugas belum selesai.`);
      } else {
        toast.error(res.error || "Gagal mengirim rekap tugas.");
      }
    } catch (err) {
      toast.error("Gagal mengirim rekap tugas.");
    } finally {
      setIsRecapping(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Settings Form Card */}
      <div className="lg:col-span-2 glass-panel p-6 rounded-xl border border-zinc-900 space-y-6">
        <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-900">
          <Settings className="w-5 h-5 text-zinc-400" />
          <h2 className="font-bold text-sm text-white">Konfigurasi Gateway WhatsApp</h2>
        </div>

        <form onSubmit={handleSave} className="space-y-5">
          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-zinc-900 rounded-lg">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                <Power className="w-4 h-4" />
              </div>
              <div>
                <label htmlFor="enabled" className="text-xs font-bold text-white block cursor-pointer">
                  Aktifkan Notifikasi WhatsApp
                </label>
                <span className="text-[10px] text-zinc-500 block">
                  Kirim peringatan absensi terlambat & rekap tugas otomatis ke WhatsApp.
                </span>
              </div>
            </div>
            <button
              type="button"
              id="enabled"
              onClick={() => setEnabled(!enabled)}
              className={`w-11 h-6 flex items-center rounded-full p-0.5 cursor-pointer transition-colors duration-200 focus:outline-none ${
                enabled ? "bg-emerald-500 justify-end" : "bg-zinc-850 justify-start"
              }`}
            >
              <span className="bg-white w-5 h-5 rounded-full shadow-md" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Admin WhatsApp Number Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Nomor WA Admin Penerima
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs text-zinc-500 font-bold">
                  +
                </span>
                <input
                  type="text"
                  value={adminNumber}
                  onChange={(e) => setAdminNumber(e.target.value)}
                  placeholder="6285878094821"
                  disabled={!enabled}
                  className="w-full pl-7 pr-3.5 py-2 rounded-lg glass-input text-xs text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-950 border border-zinc-900"
                />
              </div>
              <span className="text-[10px] text-zinc-500 block">
                Gunakan format kode negara (contoh: 62858xxxxxx).
              </span>
            </div>

            {/* Cron Notification Time Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                Jam Pengiriman Rekap Tugas
              </label>
              <div className="relative">
                <Clock className="absolute left-3.5 top-2.5 w-4 h-4 text-zinc-500" />
                <input
                  type="time"
                  value={notificationTime}
                  onChange={(e) => setNotificationTime(e.target.value)}
                  disabled={!enabled}
                  className="w-full pl-10 pr-3.5 py-2 rounded-lg glass-input text-xs text-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed bg-zinc-950 border border-zinc-900 cursor-pointer"
                />
              </div>
              <span className="text-[10px] text-zinc-500 block">
                Pukul berapa rekap harian tugas akan dikirim via WA.
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex justify-end pt-3 border-t border-zinc-900">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 rounded-lg bg-white text-black font-semibold text-xs hover:bg-zinc-200 cursor-pointer disabled:opacity-50 transition-all duration-200 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Menyimpan...</span>
                </>
              ) : (
                <span>Simpan Pengaturan</span>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Manual Actions Card */}
      <div className="glass-panel p-6 rounded-xl border border-zinc-900 flex flex-col justify-between space-y-6">
        <div className="space-y-6">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-900">
            <Send className="w-5 h-5 text-zinc-400" />
            <h2 className="font-bold text-sm text-white">Uji Coba & Aksi Cepat</h2>
          </div>

          <div className="space-y-4">
            {/* Quick action: send test message */}
            <div className="p-3 bg-zinc-950/30 border border-zinc-900/60 rounded-lg space-y-3">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Uji Koneksi WhatsApp</span>
                <p className="text-[10px] text-zinc-550 leading-relaxed mt-0.5">
                  Kirim pesan teks uji coba ke nomor WA Admin yang disimpan untuk memverifikasi fungsionalitas Fonnte API.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTestMessage}
                disabled={isTesting || !enabled}
                className="w-full py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-350 hover:text-white font-bold text-[10px] uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                {isTesting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim Uji Coba...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>Kirim Test WhatsApp</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick action: trigger recap */}
            <div className="p-3 bg-zinc-950/30 border border-zinc-900/60 rounded-lg space-y-3">
              <div>
                <span className="text-xs font-bold text-zinc-200 block">Kirim Rekap Tugas Manual</span>
                <p className="text-[10px] text-zinc-550 leading-relaxed mt-0.5">
                  Proses rekap tugas karyawan yang belum selesai dan kirim rangkuman laporannya saat ini juga tanpa menunggu jadwal cron job.
                </p>
              </div>
              <button
                type="button"
                onClick={handleTriggerRecap}
                disabled={isRecapping || !enabled}
                className="w-full py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-350 hover:text-white font-bold text-[10px] uppercase cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
              >
                {isRecapping ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Mengirim Rekap...</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>Kirim Rekap Tugas Sekarang</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Integration Instructions Alert */}
        <div className="p-3 bg-zinc-950/60 border border-zinc-900 text-zinc-500 rounded-lg text-[10px] flex gap-2.5 items-start mt-auto">
          <AlertCircle className="w-4 h-4 text-zinc-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-bold text-zinc-300 block">Petunjuk Cron Job:</span>
            <p className="leading-relaxed">
              Untuk mengotomatisasi pengiriman berkala, pasang schedule cron job pada server eksternal (misal: Cron-Job.org) yang memicu endpoint:
            </p>
            <code className="block bg-zinc-900 p-1.5 rounded font-mono text-[9px] text-zinc-300 break-all select-all border border-zinc-850">
              /api/cron/check-tasks
            </code>
            <p className="leading-relaxed">
              Disarankan untuk diatur agar berjalan *setiap 1 jam*. Sistem otomatis mencocokkan jam lokal agar pesan hanya dikirim 1x sehari pada waktu yang Anda tentukan di atas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
