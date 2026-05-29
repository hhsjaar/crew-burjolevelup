import { login, getCurrentEmployee } from "@/actions/auth";
import { Lock, Mail, ShieldAlert, User, ShieldCheck } from "lucide-react";
import { redirect } from "next/navigation";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await getCurrentEmployee();
  if (user) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const errorMsg = params.error;

  return (
    <main className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-black">
      {/* Decorative Minimal Blurs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-zinc-900/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-zinc-900/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Glassmorphic Card */}
      <div className="w-full max-w-md glass-panel p-8 rounded-xl relative z-10 border border-zinc-900">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-zinc-900 rounded-lg mb-4 border border-zinc-800">
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-1.5">
            burjolevelup
          </h1>
          <p className="text-xs text-zinc-550 mt-2 font-medium uppercase tracking-widest">
            Sistem Absensi & Operasional Karyawan
          </p>
        </div>

        {errorMsg && (
          <div className="mb-6 p-4 bg-zinc-950 border border-zinc-900 rounded-lg flex items-center gap-3 text-red-400 text-xs">
            <ShieldAlert className="w-4.5 h-4.5 shrink-0" />
            <p>{errorMsg}</p>
          </div>
        )}

        <form action={async (formData: FormData) => {
          "use server";
          const res = await login(formData);
          if (res?.error) {
            redirect(`/login?error=${encodeURIComponent(res.error)}`);
          } else if (res?.success) {
            redirect("/dashboard");
          }
        }} className="space-y-4">
          <div>
            <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
              ID Pengguna / Username
            </label>
            <div className="relative">
              <User className="w-4.5 h-4.5 text-zinc-650 absolute left-4.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                name="email"
                required
                placeholder="Masukkan ID Pengguna (contoh: burjolevelup)"
                className="w-full pl-12 pr-4 py-2.5 rounded-lg glass-input text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">
              Kata Sandi
            </label>
            <div className="relative">
              <Lock className="w-4.5 h-4.5 text-zinc-650 absolute left-4.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                name="password"
                required
                placeholder="••••••••"
                className="w-full pl-12 pr-4 py-2.5 rounded-lg glass-input text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer mt-2"
          >
            Masuk Ke Sistem
          </button>
        </form>

        {/* Instant Access Demo Section */}
        <div className=" hidden mt-8 pt-6 border-t border-zinc-900">
          <p className="text-[10px] text-center text-zinc-500 font-bold tracking-wider mb-4 uppercase">
            AKSES CEPAT INTEGRASI (KLIK LOGIN INSTAN)
          </p>
          <div className="grid grid-cols-2 gap-3">
            {/* Karyawan Quick Login */}
            <form action={async () => {
              "use server";
              const fd = new FormData();
              fd.append("email", "hamam");
              fd.append("password", "burjolevelup");
              const res = await login(fd);
              if (res?.success) redirect("/dashboard");
            }}>
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-zinc-300 font-semibold text-xs transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <User className="w-4 h-4 text-zinc-500" />
                <span className="text-[10px]">Hamam (Karyawan)</span>
              </button>
            </form>

            {/* Admin Quick Login */}
            <form action={async () => {
              "use server";
              const fd = new FormData();
              fd.append("email", "burjolevelup");
              fd.append("password", "admin");
              const res = await login(fd);
              if (res?.success) redirect("/dashboard");
            }}>
              <button
                type="submit"
                className="w-full py-2 px-3 rounded-lg bg-zinc-950 hover:bg-zinc-900 border border-zinc-900 hover:border-zinc-800 text-zinc-300 font-semibold text-xs transition-colors flex flex-col items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-zinc-500" />
                <span className="text-[10px]">Owner (Admin)</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
