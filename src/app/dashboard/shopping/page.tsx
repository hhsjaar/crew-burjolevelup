import { getCurrentEmployee } from "@/actions/auth";
import { getShoppingItems } from "@/actions/shopping";
import { getAllEmployees } from "@/actions/tasks";
import ShoppingManager from "@/components/ShoppingManager";
import { redirect } from "next/navigation";

export default async function ShoppingPage() {
  const user = await getCurrentEmployee();
  if (!user) redirect("/login");

  const isAdmin = user.role === "ADMIN";

  // Ambil data belanjaan awal
  const items = await getShoppingItems();

  // Ambil daftar karyawan jika admin untuk dropdown penyaringan
  const employees = isAdmin ? await getAllEmployees() : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <ShoppingManager 
        initialItems={items as any[]} 
        currentEmployee={user as any}
        employeesList={employees as any[]}
      />
    </div>
  );
}
