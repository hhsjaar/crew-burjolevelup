import { getCurrentEmployee } from "@/actions/auth";
import { getWhatsAppSettings } from "@/actions/whatsappSettings";
import WhatsAppSettingsForm from "@/components/WhatsAppSettingsForm";
import { MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";

export default async function WhatsAppSettingsPage() {
  const user = await getCurrentEmployee();
  if (!user || user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const settings = await getWhatsAppSettings();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-zinc-400" />
          <span>Pengaturan Notifikasi WhatsApp</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          Atur notifikasi otomatis melalui WhatsApp untuk memantau keterlambatan karyawan secara real-time dan rekap pengerjaan tugas rutin harian.
        </p>
      </div>

      {/* Main Settings Form */}
      <WhatsAppSettingsForm initialSettings={settings} />
    </div>
  );
}
