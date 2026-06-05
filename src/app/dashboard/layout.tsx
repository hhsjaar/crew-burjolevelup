import { getCurrentEmployee } from "@/actions/auth";
import Sidebar from "@/components/Sidebar";
import { redirect } from "next/navigation";
import { getClaimableTasks } from "@/actions/tasks";
import VoiceAssistant from "@/components/VoiceAssistant";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentEmployee();

  if (!user) {
    redirect("/login");
  }

  // Cast user role to string for the client-side component compatibility
  const clientUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as string,
  };

  let claimableCount = 0;
  if (user.role === "EMPLOYEE") {
    const claimableTasks = await getClaimableTasks();
    claimableCount = claimableTasks.length;
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-black">
      {/* Sidebar Navigation */}
      <Sidebar user={clientUser} claimableCount={claimableCount} />

      {/* Main Panel Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="hidden lg:flex py-4 px-6 lg:px-8 items-center justify-end sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-semibold text-zinc-550 uppercase tracking-widest">
              burjolevelup active
            </span>
          </div>
        </header>

        <main className="flex-1 pt-20 pb-16 px-5 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Asisten Suara Global (TTS & STT Bawaan Browser) */}
      <VoiceAssistant user={clientUser} />
    </div>
  );
}
