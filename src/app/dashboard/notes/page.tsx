import { getCurrentEmployee } from "@/actions/auth";
import { getEmployeePrivateNotes, getAllPrivateNotesForAdmin } from "@/actions/notes";
import { getAllEmployees } from "@/actions/tasks";
import NotesManager from "@/components/NotesManager";
import { FileText } from "lucide-react";
import { redirect } from "next/navigation";

export default async function NotesPage() {
  const user = await getCurrentEmployee();
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  // Fetch initial notes based on role
  const notes = isAdmin 
    ? await getAllPrivateNotesForAdmin()
    : await getEmployeePrivateNotes(user.id);

  // Fetch employees list if ADMIN
  const employees = isAdmin ? await getAllEmployees() : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div>
        <h1 className="text-xl lg:text-2xl font-bold text-white flex items-center gap-2.5">
          <FileText className="w-5 h-5 text-zinc-400" />
          <span>Catatan & Kasbon Burjolevelup</span>
        </h1>
        <p className="text-zinc-500 text-xs mt-1 leading-relaxed">
          {isAdmin
            ? "Tinjau pengajuan kasbon karyawan, kelola pelunasan utang, publikasikan ulasan evaluasi kinerja, dan tulis catatan operasional khusus."
            : "Ajukan pinjaman kasbon mandiri secara resmi, pantau status persetujuan, dan tinjau catatan ulasan evaluasi kinerja Anda dari owner."}
        </p>
      </div>

      {/* Unified Notes Manager Container */}
      <NotesManager 
        initialNotes={notes as any[]} 
        employees={employees as any[]} 
        isAdmin={isAdmin} 
        userId={user.id} 
      />
    </div>
  );
}
