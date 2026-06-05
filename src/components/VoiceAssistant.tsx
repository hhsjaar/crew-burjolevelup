"use client";

import { useState, useRef, useEffect } from "react";
import { Mic, MicOff, X, Sparkles, Volume2, HelpCircle } from "lucide-react";
import { processVoiceCommand } from "@/actions/voiceAssistant";

interface VoiceAssistantProps {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

export default function VoiceAssistant({ user }: VoiceAssistantProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [response, setResponse] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [voices, setVoices] = useState<any[]>([]);

  const recognitionRef = useRef<any>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Check if browser supports Web Speech API and load voices
  useEffect(() => {
    if (SpeechRecognitionAPI) {
      setIsSupported(true);
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const loadVoices = () => {
        setVoices(window.speechSynthesis.getVoices());
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const speakText = (text: string) => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      // Only cancel if it is currently speaking, avoiding Chrome bug when idle
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      
      // Ensure the engine is resumed if paused
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }

      // Delay execution slightly to bypass Chrome's cancel-state timing bug
      setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "id-ID";

        // Keep reference in React ref to prevent garbage collection cut-off
        activeUtteranceRef.current = utterance;

        // Try to find a natural Indonesian voice
        const activeVoices = voices.length > 0 ? voices : window.speechSynthesis.getVoices();
        const indVoice = activeVoices.find((v) => v.lang.includes("id") || v.lang.includes("ID"));
        if (indVoice) {
          utterance.voice = indVoice;
        }

        utterance.onstart = () => console.log("SpeechSynthesis started speaking:", text);
        utterance.onend = () => {
          activeUtteranceRef.current = null;
        };
        utterance.onerror = (e) => {
          activeUtteranceRef.current = null;
          console.error("SpeechSynthesis error code:", e.error, "Event:", e);
          // Only trigger fallback if the error is not 'canceled'
          if (e.error !== "canceled") {
            const fallback = new SpeechSynthesisUtterance(text);
            activeUtteranceRef.current = fallback;
            fallback.onend = () => {
              activeUtteranceRef.current = null;
            };
            fallback.onerror = () => {
              activeUtteranceRef.current = null;
            };
            window.speechSynthesis.speak(fallback);
          }
        };

        window.speechSynthesis.speak(utterance);
      }, 50);
    }
  };

  const stopSpeaking = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  };

  const startListening = () => {
    if (!isSupported || !SpeechRecognitionAPI) return;

    stopSpeaking();
    setErrorMsg("");
    setTranscript("");
    setResponse("");

    // Unlocking browser audio policy with a synchronous silent utterance
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      const silent = new SpeechSynthesisUtterance(" ");
      silent.volume = 0;
      window.speechSynthesis.speak(silent);
    }

    try {
      const rec = new SpeechRecognitionAPI();
      rec.lang = "id-ID";
      rec.interimResults = false;
      rec.maxAlternatives = 1;

      rec.onstart = () => {
        setIsListening(true);
        setIsOpen(true);
      };

      rec.onresult = async (event: any) => {
        // Stop recording immediately to release browser microphone
        try {
          rec.stop();
        } catch (e) {}

        const text = event.results[0][0].transcript;
        setTranscript(text);
        setIsProcessing(true);

        try {
          const result = await processVoiceCommand(text);
          if (result.error) {
            const errReply = "Maaf, terjadi kesalahan pemrosesan perintah.";
            setResponse(errReply);
            speakText(errReply);
          } else {
            setResponse(result.response || "");
            speakText(result.response || "");
          }
        } catch (err) {
          const networkReply = "Gagal menghubungi server asisten suara.";
          setResponse(networkReply);
          speakText(networkReply);
        } finally {
          setIsProcessing(false);
        }
      };

      rec.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setErrorMsg("Izin penggunaan mikrofon ditolak browser.");
        } else {
          setErrorMsg("Gagal mengenali suara, silakan coba lagi.");
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.start();
      recognitionRef.current = rec;
    } catch (err) {
      console.error("Failed to start SpeechRecognition:", err);
      setIsListening(false);
    }
  };

  const toggleAssistant = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
    } else {
      setIsOpen(true);
      startListening();
    }
  };

  const handleClose = () => {
    stopSpeaking();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setIsOpen(false);
    setIsListening(false);
    setTranscript("");
    setResponse("");
    setErrorMsg("");
  };

  if (!isSupported) {
    return null; // Gracefully hide if not supported by current browser
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 font-sans">
      {/* Balon Ucapan Asisten (Popover) */}
      {isOpen && (
        <div className="w-76 md:w-80 bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl p-4 shadow-2xl animate-slide-in relative flex flex-col space-y-3.5">
          <button
            onClick={handleClose}
            className="absolute top-3 right-3 text-zinc-500 hover:text-zinc-350 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-1.5 border-b border-zinc-900 pb-2">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">
              Voice Assistant
            </span>
          </div>

          <div className="space-y-3 text-xs leading-relaxed max-h-48 overflow-y-auto pr-1">
            {isListening && (
              <div className="flex flex-col items-center py-2 text-center text-zinc-400">
                <span className="inline-block w-8 h-8 rounded-full border border-indigo-500/20 bg-indigo-500/10 flex items-center justify-center animate-ping mb-2">
                  <Mic className="w-3.5 h-3.5 text-indigo-400" />
                </span>
                <p className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider animate-pulse">
                  Mendengarkan suara Anda...
                </p>
                <p className="text-[9px] text-zinc-550 mt-1 italic">
                  Karyawan: "apakah ada jobdesk saya yang belum?"
                </p>
                <p className="text-[9px] text-zinc-550 italic">
                  Admin: "siapa saja yang terlambat?"
                </p>
              </div>
            )}

            {!isListening && !transcript && !response && !errorMsg && !isProcessing && (
              <div className="flex flex-col items-center py-3 text-center text-zinc-400">
                <HelpCircle className="w-6 h-6 text-zinc-650 mb-2" />
                <p className="font-semibold text-zinc-350 text-[10px]">Asisten Suara Siap</p>
                <p className="text-[9px] text-zinc-550 mt-1 max-w-[180px]">
                  Klik tombol mikrofon di bawah untuk berbicara dengan asisten.
                </p>
              </div>
            )}

            {transcript && (
              <div className="flex flex-col space-y-1">
                <span className="text-[8px] font-bold text-zinc-500 uppercase tracking-wider">Anda berkata</span>
                <p className="bg-zinc-900/40 border border-zinc-850 px-2.5 py-1.5 rounded-lg text-zinc-300 italic font-medium">
                  "{transcript}"
                </p>
              </div>
            )}

            {isProcessing && (
              <div className="flex items-center gap-2 text-zinc-400 text-[10px] py-1 font-semibold uppercase tracking-wider">
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-100" />
                <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce delay-200" />
                <span>Memproses Data...</span>
              </div>
            )}

            {response && (
              <div className="flex flex-col space-y-1 animate-fade-in">
                <span className="text-[8px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                  <Volume2 className="w-3 h-3 animate-pulse" />
                  Asisten
                </span>
                <p className="bg-indigo-950/20 border border-indigo-900/30 px-2.5 py-2 rounded-lg text-zinc-200 font-semibold leading-relaxed">
                  {response}
                </p>
              </div>
            )}

            {errorMsg && (
              <p className="text-[10px] text-red-400 font-bold border border-red-950/50 bg-red-950/10 px-2.5 py-1.5 rounded-lg">
                ⚠ {errorMsg}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tombol Mikrofon Melayang */}
      <button
        type="button"
        onClick={toggleAssistant}
        className={`w-11 h-11 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 border cursor-pointer hover:scale-105 active:scale-95 ${
          isListening
            ? "bg-indigo-500/25 border-indigo-400 text-white animate-pulse"
            : "bg-zinc-950/90 hover:bg-zinc-900 border-zinc-800 hover:border-zinc-750 text-indigo-400"
        }`}
        title={isListening ? "Hentikan perekaman" : "Tanya asisten suara"}
      >
        {isListening ? (
          <Mic className="w-5 h-5 text-indigo-300 animate-spin-slow" />
        ) : (
          <Mic className="w-5 h-5 text-indigo-400" />
        )}
      </button>
    </div>
  );
}
