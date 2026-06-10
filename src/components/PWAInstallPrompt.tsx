"use client";

import { useEffect, useState } from "react";
import { Download, X, Share2, Plus } from "lucide-react";
import Image from "next/image";

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // 1. Check if the app is already running in standalone mode (already installed)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
      setIsStandalone(isStandaloneMode);
      return isStandaloneMode;
    };

    const isStandaloneMode = checkStandalone();

    // 2. Check if the user is on iOS Safari
    const checkIOS = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isIpadOrIphone = /ipad|iphone|ipod/.test(userAgent) && !(window as any).MSStream;
      setIsIOS(isIpadOrIphone);
      return isIpadOrIphone;
    };

    const ios = checkIOS();

    // 3. Register the service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("Service Worker registered with scope:", reg.scope))
        .catch((err) => console.error("Service Worker registration failed:", err));
    }

    // 4. Handle chrome beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);

      // Only show if not dismissed in the last 3 days
      const dismissedUntil = localStorage.getItem("pwa_prompt_dismissed_until");
      const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();

      if (!isDismissed && !isStandaloneMode) {
        // Show after a brief delay for smoother page loading
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // 5. For iOS, if they haven't installed and haven't dismissed, show after 2.5 seconds
    if (ios && !isStandaloneMode) {
      const dismissedUntil = localStorage.getItem("pwa_prompt_dismissed_until");
      const isDismissed = dismissedUntil && Number(dismissedUntil) > Date.now();

      if (!isDismissed) {
        const timer = setTimeout(() => {
          setShowPrompt(true);
        }, 2500);
        return () => clearTimeout(timer);
      }
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      return;
    }

    if (!deferredPrompt) return;

    // Show the browser's install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);

    // We no longer need the prompt, clear it
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Dismiss for 3 days
    const nextShowTime = Date.now() + 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem("pwa_prompt_dismissed_until", String(nextShowTime));
  };

  if (!showPrompt || isStandalone) return null;

  return (
    <div className="fixed inset-x-4 bottom-4 md:bottom-6 md:right-6 md:left-auto md:w-96 z-50 animate-fade-in">
      <div className="glass-panel rounded-2xl p-5 border border-zinc-800 shadow-2xl relative bg-zinc-950/90 backdrop-blur-xl">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 p-1 rounded-full text-zinc-450 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="flex gap-4 items-start">
          <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border border-zinc-800 bg-zinc-950 shadow-md">
            <Image
              src="/icon-192.png"
              alt="Burjo LevelUp Logo"
              width={56}
              height={56}
              className="object-cover"
            />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white tracking-tight">
              Instal Internal Burjolevelup
            </h3>
            <p className="text-[11px] text-zinc-450 leading-relaxed">
              Dapatkan akses absensi selfie, pelacakan jobdesk, dan pencatatan operasional dengan lebih cepat langsung dari layar utama perangkat Anda.
            </p>
          </div>
        </div>

        {/* Dynamic section: Android/Chrome vs iOS Safari instructions */}
        {isIOS ? (
          <div className="mt-4 pt-3 border-t border-zinc-900/60 space-y-2.5 text-[11px] text-zinc-350">
            <p className="font-semibold text-zinc-200">Langkah instalasi iOS Safari:</p>
            <ol className="list-decimal pl-4 space-y-1.5 leading-relaxed">
              <li>
                Ketuk tombol Bagikan <Share2 className="inline-block w-3 h-3 mx-0.5 text-zinc-400" /> (Share) di Safari.
              </li>
              <li>
                Scroll ke bawah dan pilih <span className="font-semibold text-white">Tambahkan ke Layar Utama</span> <Plus className="inline-block w-3 h-3 mx-0.5 text-zinc-400" /> (Add to Home Screen).
              </li>
            </ol>
            <button
              onClick={handleDismiss}
              className="w-full mt-2 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-secondary cursor-pointer"
            >
              Saya Mengerti
            </button>
          </div>
        ) : (
          <div className="mt-5 flex gap-2.5">
            <button
              onClick={handleDismiss}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider apple-btn-secondary cursor-pointer text-center"
            >
              Nanti Saja
            </button>
            <button
              onClick={handleInstallClick}
              className="flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider apple-btn-primary cursor-pointer text-center flex items-center justify-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              Instal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
