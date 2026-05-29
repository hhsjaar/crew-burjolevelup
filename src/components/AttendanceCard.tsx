"use client";

import { useState, useRef, useEffect } from "react";
import { clockIn, clockOut } from "@/actions/attendance";
import { Camera, MapPin, CheckCircle, Clock, AlertCircle, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

interface AttendanceCardProps {
  attendance: any;
  employeeId: string;
}

export default function AttendanceCard({ attendance: initialAttendance, employeeId }: AttendanceCardProps) {
  const [attendance, setAttendance] = useState(initialAttendance);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState<"in" | "out">("in");
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
    if (!photo) {
      toast.error("Wajib mengambil foto selfie sebelum absen.");
      return;
    }
    if (!coords) {
      toast.error("Wajib memuat lokasi GPS.");
      return;
    }

    setLoading(true);
    try {
      const res =
        mode === "in"
          ? await clockIn(notes, coords.lat, coords.lng, photo)
          : await clockOut(notes, coords.lat, coords.lng, photo);

      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success(mode === "in" ? "Absen masuk sukses!" : "Absen pulang sukses!");
        setAttendance(res.attendance);
        setIsModalOpen(false);
        setNotes("");
      }
    } catch (err) {
      toast.error("Terjadi kesalahan teknis saat absensi.");
    } finally {
      setLoading(false);
    }
  };

  const openAbsenceModal = (type: "in" | "out") => {
    setMode(type);
    setIsModalOpen(true);
  };

  return (
    <div className="glass-panel p-6 rounded-xl border border-zinc-900 relative overflow-hidden flex flex-col justify-between min-h-[340px]">
      <div>
        <div className="flex items-center gap-2.5 mb-4">
          <Clock className="w-4.5 h-4.5 text-zinc-400" />
          <h2 className="font-semibold text-base text-white">Presensi Kerja</h2>
        </div>
        <p className="text-xs text-zinc-400 mb-6 leading-relaxed">
          Silakan catat absensi masuk (batas pukul 08:00 WIB) dan absen pulang dengan selfie kamera dan verifikasi koordinat GPS aktif.
        </p>
      </div>

      <div className="my-4 p-5 rounded-lg bg-zinc-950/40 border border-zinc-900/60 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="text-center sm:text-left">
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Waktu Presensi Hari Ini</p>
          <div className="flex items-center gap-6 mt-2">
            <div>
              <span className="text-[9px] text-zinc-500 font-bold block">MASUK</span>
              <span className="text-xs font-semibold text-zinc-300">
                {attendance?.clockIn ? new Date(attendance.clockIn).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) : "-- : --"}
              </span>
            </div>
            <div className="border-l border-zinc-900 h-6" />
            <div>
              <span className="text-[9px] text-zinc-500 font-bold block">PULANG</span>
              <span className="text-xs font-semibold text-zinc-300">
                {attendance?.clockOut ? new Date(attendance.clockOut).toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' }) : "-- : --"}
              </span>
            </div>
          </div>
        </div>

        <div>
          {!attendance ? (
            <button
              onClick={() => openAbsenceModal("in")}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer"
            >
              Clock-In Masuk
            </button>
          ) : !attendance.clockOut ? (
            <button
              onClick={() => openAbsenceModal("out")}
              className="px-5 py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-secondary cursor-pointer"
            >
              Clock-Out Pulang
            </button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-zinc-300 rounded-lg border border-zinc-800 text-[10px] font-bold uppercase tracking-wider">
              <CheckCircle className="w-4 h-4 text-zinc-400" />
              <span>Absensi Selesai</span>
            </div>
          )}
        </div>
      </div>

      <div className="text-[10px] text-zinc-500 text-center sm:text-left">
        Autentikasi terenkripsi • Burjolevelup Outlet Cabang Ungaran
      </div>

      {/* Modal Absensi Kamera + GPS */}
      {isModalOpen && (
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
                Validasi Presensi: {mode === "in" ? "Clock-In Masuk" : "Clock-Out Pulang"}
              </h3>
              <p className="text-[11px] text-zinc-500 mt-1">
                Kamera dan lokasi GPS mendeteksi kedisiplinan Anda.
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
                placeholder="Contoh: Buka shift pagi / Beres-beres closing..."
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
