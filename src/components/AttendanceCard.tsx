"use client";

import { useState, useRef, useEffect } from "react";
import { clockIn } from "@/actions/attendance";
import { Camera, MapPin, CheckCircle, Clock, AlertCircle, RefreshCw, X, AlertOctagon } from "lucide-react";
import { toast } from "sonner";

// Keep global reference to prevent garbage collection cut-off in Chrome
const activeUtterances: SpeechSynthesisUtterance[] = [];

interface Shift {
  id: string;
  name: string;
  startTime: string;
  isActive: boolean;
}

interface AttendanceCardProps {
  todayAttendances: any[];
  activeShifts: Shift[];
  employeeId: string;
}

export default function AttendanceCard({ todayAttendances, activeShifts, employeeId }: AttendanceCardProps) {
  const [attendances, setAttendances] = useState<any[]>(todayAttendances);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Camera & Location State
  const [cameraActive, setCameraActive] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Auto-detect location when modal opens
  useEffect(() => {
    if (isModalOpen) {
      detectLocation();
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [isModalOpen]);

  const detectLocation = () => {
    setLocating(true);
    setLocationError(null);
    if (!navigator.geolocation) {
      setLocationError("Browser Anda tidak mendukung deteksi lokasi.");
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setLocating(false);
      },
      (error) => {
        console.error("GPS Error:", error);
        setLocationError("Gagal mendeteksi koordinat GPS. Pastikan izin lokasi aktif.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const startCamera = async () => {
    setPhoto(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 400, height: 400, facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      
      // If the ref is instantly available, bind it
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      } else {
        // Fallback: set active first to force DOM rendering, then try binding after a short tick
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
        // Draw the video frame to canvas
        canvas.width = 300;
        canvas.height = 300;
        
        // Crop/Draw center square
        const size = Math.min(video.videoWidth, video.videoHeight);
        const sx = (video.videoWidth - size) / 2;
        const sy = (video.videoHeight - size) / 2;
        
        context.drawImage(video, sx, sy, size, size, 0, 0, 300, 300);
        
        // Convert to highly compressed JPEG base64 (quality = 0.6)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
        setPhoto(dataUrl);
        stopCamera();
      }
    }
  };

  const handleAttendance = async () => {
    if (!selectedShift) return;
    if (!photo) {
      toast.error("Wajib mengambil foto selfie sebelum absen.");
      return;
    }
    if (!coords) {
      toast.error("Wajib memuat lokasi GPS.");
      return;
    }

    // Unlocking browser audio policy with a synchronous silent utterance
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    }

    setLoading(true);
    try {
      const res = await clockIn(selectedShift.id, notes, coords.lat, coords.lng, photo);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(`Absen masuk ${selectedShift.name} sukses!`);
        
        // Pemicu suara sambutan & pembacaan jobdesk bawaan browser (100% gratis & offline-safe)
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
          
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }

          let speechText = `Absensi masuk shift ${selectedShift.name} berhasil dicatat. Selamat bekerja! `;
          
          const tasks = (res as any).tasks || [];
          if (tasks.length > 0) {
            const taskTitles = tasks.map((t: any, idx: number) => `tugas ke ${idx + 1}, ${t.title}`).join(". ");
            speechText += `Berikut adalah daftar tugas kamu hari ini: ${taskTitles}. Tetap semangat dan jaga kesehatan!`;
          } else {
            speechText += "Hari ini kamu tidak memiliki tugas pending khusus. Tetap semangat!";
          }

          setTimeout(() => {
            const utterance = new SpeechSynthesisUtterance(speechText);
            utterance.lang = "id-ID";
            const voices = window.speechSynthesis.getVoices();
            const indVoice = voices.find((v) => v.lang.includes("id") || v.lang.includes("ID"));
            if (indVoice) {
              utterance.voice = indVoice;
            }

            // Keep reference to prevent GC cut-off
            activeUtterances.push(utterance);

            utterance.onend = () => {
              const idx = activeUtterances.indexOf(utterance);
              if (idx > -1) activeUtterances.splice(idx, 1);
            };

            utterance.onerror = (e) => {
              const idx = activeUtterances.indexOf(utterance);
              if (idx > -1) activeUtterances.splice(idx, 1);

              console.error("SpeechSynthesis error on clockIn welcome. Code:", e.error, "Event:", e);
              if (e.error !== "canceled") {
                const fallback = new SpeechSynthesisUtterance(speechText);
                activeUtterances.push(fallback);
                fallback.onend = () => {
                  const fIdx = activeUtterances.indexOf(fallback);
                  if (fIdx > -1) activeUtterances.splice(fIdx, 1);
                };
                window.speechSynthesis.speak(fallback);
              }
            };
            window.speechSynthesis.speak(utterance);
          }, 100);
        }

        // Append shift details to updated attendance
        const finalAttendance = {
          ...res.attendance,
          shift: selectedShift,
        };
        setAttendances((prev) => [...prev, finalAttendance]);
        setIsModalOpen(false);
        setNotes("");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan teknis saat absensi.");
    } finally {
      setLoading(false);
    }
  };

  const openAbsenceModal = (shift: Shift) => {
    setSelectedShift(shift);
    setIsModalOpen(true);
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-zinc-900 relative overflow-hidden flex flex-col justify-between min-h-[340px]">
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <Clock className="w-4.5 h-4.5 text-zinc-400" />
          <h2 className="font-semibold text-base text-white">Presensi Kerja Shift</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          Silakan catat absensi masuk untuk shift kerja aktif Anda hari ini. Batas keterlambatan adalah 15 menit dari jam mulai shift. Verifikasi foto selfie dan lokasi GPS diperlukan untuk setiap shift.
        </p>
      </div>

      {/* Shifts List Grid */}
      <div className="my-4 space-y-3">
        <p className="text-[10px] font-bold text-zinc-550 uppercase tracking-widest">Daftar Shift Kerja Hari Ini</p>
        
        {activeShifts.length === 0 ? (
          <div className="py-8 text-center text-zinc-650 text-xs italic">
            Belum ada shift kerja aktif yang terdaftar di sistem.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {activeShifts.map((shift) => {
              const att = attendances.find((a) => a.shiftId === shift.id);
              const isCheckedIn = !!att;

              return (
                <div
                  key={shift.id}
                  className={`p-4 rounded-xl border flex items-center justify-between gap-4 transition-all ${
                    isCheckedIn
                      ? "bg-zinc-950/60 border-zinc-900/60"
                      : "bg-zinc-950/20 border-zinc-900/40 hover:border-zinc-800"
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <span className="font-semibold text-xs text-white block">{shift.name}</span>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                      <Clock className="w-3.5 h-3.5 text-zinc-600" />
                      <span>Mulai: {shift.startTime} WIB</span>
                    </div>
                  </div>

                  <div>
                    {isCheckedIn ? (
                      <div className="flex flex-col items-end gap-1.5">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[8.5px] font-extrabold uppercase border ${
                            att.status === "LATE"
                              ? "bg-red-500/5 text-red-400 border-red-500/10"
                              : "bg-white/5 text-white border-white/20"
                          }`}
                        >
                          {att.status === "LATE" ? (
                            <>
                              <AlertOctagon className="w-2.5 h-2.5" />
                              Terlambat
                            </>
                          ) : (
                            <>
                              <CheckCircle className="w-2.5 h-2.5" />
                              Tepat Waktu
                            </>
                          )}
                        </span>
                        <span className="text-[9px] text-zinc-500 font-bold">
                          In: {new Date(att.clockIn).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ) : (
                      <button
                        onClick={() => openAbsenceModal(shift)}
                        className="px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider apple-btn-primary cursor-pointer shrink-0"
                      >
                        Absen Masuk
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-[10px] text-zinc-500 text-center sm:text-left mt-6">
        Autentikasi terenkripsi • Burjolevelup Outlet Cabang Ungaran
      </div>

      {/* Modal Absensi Kamera + GPS */}
      {isModalOpen && selectedShift && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="glass-panel w-full max-w-md rounded-xl border border-zinc-800 p-6 space-y-5 relative">
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute right-5 top-5 p-1 rounded-lg hover:bg-zinc-900 text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <X className="w-4.5 h-4.5" />
            </button>

            <div>
              <h3 className="font-semibold text-sm text-white">
                Validasi Presensi: {selectedShift.name}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1">
                Kamera dan lokasi GPS mendeteksi kedisiplinan Anda pada jam masuk {selectedShift.startTime} WIB.
              </p>
            </div>

            {/* Kamera Viewport */}
            <div className="relative aspect-square w-full max-w-[240px] mx-auto rounded-lg overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center">
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
                  alt="Selfie Absen"
                  className="w-full h-full object-cover"
                />
              )}
              {!cameraActive && !photo && (
                <div className="flex flex-col items-center gap-2 text-zinc-600">
                  <Camera className="w-8 h-8 animate-pulse" />
                  <span className="text-[10px]">Mengaktifkan kamera...</span>
                </div>
              )}

              {cameraActive && !photo && (
                <button
                  onClick={capturePhoto}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-white text-black font-semibold rounded-full shadow text-[10px] uppercase hover:bg-zinc-200 cursor-pointer"
                >
                  Ambil Foto
                </button>
              )}

              {photo && (
                <button
                  onClick={startCamera}
                  className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-zinc-900/90 text-white font-semibold rounded-full shadow text-[10px] uppercase hover:bg-zinc-800 cursor-pointer border border-zinc-800"
                >
                  Foto Ulang
                </button>
              )}
            </div>
            
            <canvas ref={canvasRef} className="hidden" />

            {/* GPS Detail */}
            <div className="p-3.5 bg-zinc-950 rounded-lg border border-zinc-900 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5" /> Lokasi GPS Anda
                </span>
                {locating && <span className="text-[9px] text-zinc-400 flex items-center gap-1"><RefreshCw className="w-2.5 h-2.5 animate-spin" /> Memuat...</span>}
              </div>

              {coords ? (
                <p className="font-mono text-[10px] text-zinc-300">
                  Lat: {coords.lat.toFixed(6)} • Lng: {coords.lng.toFixed(6)}
                </p>
              ) : locationError ? (
                <p className="text-[10px] text-red-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" /> {locationError}
                </p>
              ) : (
                <p className="text-[10px] text-zinc-500 italic">Mencari lokasi GPS...</p>
              )}

              {locationError && (
                <button
                  onClick={detectLocation}
                  className="text-[9px] text-white underline font-bold mt-1 block cursor-pointer"
                >
                  Coba Muat Ulang Lokasi
                </button>
              )}
            </div>

            {/* Notes input */}
            <div>
              <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
                Catatan Operasional (Opsional)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Contoh: Datang bersiap buka kasir / telat karena jalan licin..."
                className="w-full px-3 py-2 rounded-lg glass-input text-xs"
              />
            </div>

            <button
              onClick={handleAttendance}
              disabled={loading || !photo || !coords}
              className={`w-full py-3 rounded-lg text-xs font-semibold uppercase tracking-wider ${
                loading || !photo || !coords
                  ? "bg-zinc-800 text-zinc-500 border border-zinc-900 cursor-not-allowed"
                  : "apple-btn-primary cursor-pointer"
              }`}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Memproses Absensi...
                </span>
              ) : (
                "Kirim Absensi Resmi"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

