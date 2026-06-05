"use client";

import { useState } from "react";
import { 
  addShoppingItem, 
  markAsPurchased, 
  deleteShoppingItem 
} from "@/actions/shopping";
import { 
  ShoppingBag, 
  Plus, 
  Check, 
  Trash2, 
  Filter, 
  Search, 
  Clipboard, 
  Calendar, 
  User, 
  AlertCircle,
  FileText
} from "lucide-react";
import { toast } from "sonner";

interface Employee {
  id: string;
  name: string;
  role: string;
  email: string;
}

interface ShoppingItem {
  id: string;
  itemName: string;
  quantity: number;
  unit: string;
  notes: string | null;
  status: string;
  employeeId: string;
  employee: {
    name: string;
    email: string;
  };
  createdAt: any;
  updatedAt: any;
}

interface ShoppingManagerProps {
  initialItems: ShoppingItem[];
  currentEmployee: Employee;
  employeesList?: { id: string; name: string }[];
}

export default function ShoppingManager({ 
  initialItems, 
  currentEmployee,
  employeesList = []
}: ShoppingManagerProps) {
  const [items, setItems] = useState<ShoppingItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  
  // Form State
  const [itemName, setItemName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("Pcs");
  const [notes, setNotes] = useState("");

  // Filter & Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "PENDING" | "PURCHASED">("ALL");
  const [employeeFilter, setEmployeeFilter] = useState("ALL");

  const isAdmin = currentEmployee.role === "ADMIN";

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName.trim()) {
      toast.error("Nama barang wajib diisi.");
      return;
    }
    const qtyVal = parseFloat(quantity);
    if (isNaN(qtyVal) || qtyVal <= 0) {
      toast.error("Jumlah harus berupa angka lebih besar dari 0.");
      return;
    }
    if (!unit.trim()) {
      toast.error("Satuan wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await addShoppingItem(itemName, qtyVal, unit, notes);
      if (res.error) {
        toast.error(res.error);
      } else if (res.success && res.shoppingItem) {
        toast.success(`Berhasil menambahkan "${itemName}" ke daftar belanja!`);
        
        // Add new item to state
        const newItem: ShoppingItem = {
          ...(res.shoppingItem as any),
          employee: {
            name: currentEmployee.name,
            email: currentEmployee.email
          }
        };
        setItems((prev) => [newItem, ...prev]);
        
        // Reset form
        setItemName("");
        setQuantity("");
        setUnit("Pcs");
        setNotes("");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan teknis saat menambahkan barang.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkPurchased = async (id: string) => {
    try {
      const res = await markAsPurchased(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Barang belanjaan berhasil ditandai sebagai sudah dibeli!");
        setItems((prev) => 
          prev.map((item) => 
            item.id === id ? { ...item, status: "PURCHASED" } : item
          )
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal memperbarui status barang belanjaan.");
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm("Apakah Anda yakin ingin menghapus barang ini dari daftar belanja?")) return;
    
    try {
      const res = await deleteShoppingItem(id);
      if (res.error) {
        toast.error(res.error);
      } else {
        toast.success("Barang belanjaan berhasil dihapus.");
        setItems((prev) => prev.filter((item) => item.id !== id));
      }
    } catch (err) {
      console.error(err);
      toast.error("Gagal menghapus barang belanjaan.");
    }
  };

  // Filter Logic
  const filteredItems = items.filter((item) => {
    const matchesSearch = item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.notes && item.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesStatus = statusFilter === "ALL" || item.status === statusFilter;
    
    const matchesEmployee = employeeFilter === "ALL" || item.employeeId === employeeFilter;
    
    return matchesSearch && matchesStatus && matchesEmployee;
  });

  // Common Unit Chips
  const commonUnits = ["Kg", "Liter", "Pcs", "Dus", "Pack", "Ikat", "Box"];

  // Stats Calculations
  const pendingCount = items.filter((i) => i.status === "PENDING").length;
  const purchasedCount = items.filter((i) => i.status === "PURCHASED").length;
  const totalCount = items.length;

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-white" />
            Daftar Belanja Bahan & Stok
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            {isAdmin 
              ? "Pantau seluruh kebutuhan bahan dari karyawan, tandai barang jika sudah dibeli." 
              : "Ajukan daftar bahan makanan, minuman, atau perlengkapan yang habis atau menipis."}
          </p>
        </div>
      </div>

      {/* Stats Widget Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-5 rounded-xl border border-zinc-900 bg-zinc-950/20">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Belanja Kebutuhan</p>
          <p className="text-2xl font-extrabold text-white mt-2">{totalCount}</p>
          <span className="text-[10px] text-zinc-400 font-medium block mt-1">Diajukan di sistem</span>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-zinc-900 bg-zinc-950/20">
          <p className="text-[10px] font-bold text-yellow-500 uppercase tracking-widest">Menunggu Dibeli (Pending)</p>
          <p className="text-2xl font-extrabold text-yellow-400 mt-2">{pendingCount}</p>
          <span className="text-[10px] text-zinc-400 font-medium block mt-1">Harus segera dibelanjakan</span>
        </div>
        <div className="glass-panel p-5 rounded-xl border border-zinc-900 bg-zinc-950/20">
          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Sudah Dibeli</p>
          <p className="text-2xl font-extrabold text-emerald-400 mt-2">{purchasedCount}</p>
          <span className="text-[10px] text-zinc-400 font-medium block mt-1">Telah diselesaikan</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* ================= FORM ADD ITEM (EMPLOYEE/ALL) ================= */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-panel p-6 rounded-xl border border-zinc-900 relative overflow-hidden bg-zinc-950/20">
            <h2 className="font-semibold text-sm text-white mb-4 flex items-center gap-2 border-b border-zinc-900 pb-3">
              <Plus className="w-4 h-4 text-zinc-400" />
              Tambah Kebutuhan Belanja
            </h2>

            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Nama Bahan / Barang
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="Contoh: Susu UHT Cokelat, Kopi Arabika"
                  className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Jumlah
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Contoh: 10, 2.5"
                    className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                    Satuan
                  </label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="Pcs, Kg, Liter, dll."
                    className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Common Unit Suggestion Chips */}
              <div className="flex flex-wrap gap-1.5 mt-1">
                {commonUnits.map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnit(u)}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${
                      unit === u 
                        ? "bg-white text-black border-white" 
                        : "bg-zinc-950 text-zinc-400 border-zinc-900 hover:border-zinc-800"
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1.5">
                  Catatan Tambahan (Opsional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Stok tinggal 1 pcs, ambil merek Frisian Flag"
                  rows={3}
                  className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg text-xs font-semibold uppercase tracking-wider apple-btn-primary cursor-pointer mt-2 flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                {loading ? "Menambahkan..." : "Tambahkan ke Daftar"}
              </button>
            </form>
          </div>
        </div>

        {/* ================= MONITORING LIST (ALL) ================= */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Filters Bar */}
          <div className="glass-panel p-4 rounded-xl border border-zinc-900 bg-zinc-950/20 flex flex-col md:flex-row md:items-center justify-between gap-4">
            
            {/* Search Input */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-zinc-600" />
              <input
                type="text"
                placeholder="Cari barang atau catatan..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-900 focus:border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-zinc-650 focus:outline-none transition-colors"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-900">
                <Filter className="w-3.5 h-3.5 text-zinc-500" />
                <select
                  value={statusFilter}
                  onChange={(e: any) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-xs text-zinc-300 border-none outline-none cursor-pointer focus:ring-0"
                >
                  <option value="ALL" className="bg-zinc-950 text-white">Semua Status</option>
                  <option value="PENDING" className="bg-zinc-950 text-white">Pending</option>
                  <option value="PURCHASED" className="bg-zinc-950 text-white">Sudah Dibeli</option>
                </select>
              </div>

              {isAdmin && employeesList.length > 0 && (
                <div className="flex items-center gap-2 bg-zinc-950 px-3 py-1.5 rounded-lg border border-zinc-900">
                  <User className="w-3.5 h-3.5 text-zinc-500" />
                  <select
                    value={employeeFilter}
                    onChange={(e) => setEmployeeFilter(e.target.value)}
                    className="bg-transparent text-xs text-zinc-300 border-none outline-none cursor-pointer focus:ring-0"
                  >
                    <option value="ALL" className="bg-zinc-950 text-white">Semua Karyawan</option>
                    {employeesList.map((emp) => (
                      <option key={emp.id} value={emp.id} className="bg-zinc-950 text-white">
                        {emp.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* List Display */}
          {filteredItems.length === 0 ? (
            <div className="glass-panel py-12 rounded-xl border border-zinc-900 bg-zinc-950/10 text-center space-y-2">
              <AlertCircle className="w-8 h-8 text-zinc-700 mx-auto" />
              <p className="text-xs text-zinc-500 italic">Tidak ada daftar belanjaan yang cocok dengan penyaringan Anda.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredItems.map((item) => {
                const isItemPending = item.status === "PENDING";
                const dateStr = item.createdAt 
                  ? new Date(item.createdAt).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : "-";

                return (
                  <div
                    key={item.id}
                    className={`glass-panel p-5 rounded-xl border flex flex-col justify-between transition-all duration-300 ${
                      item.status === "PURCHASED"
                        ? "bg-zinc-950/40 border-zinc-900/60 opacity-70"
                        : "bg-zinc-950/20 border-zinc-900/80 hover:border-zinc-800 shadow-md"
                    }`}
                  >
                    {/* Item Card Body */}
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className={`font-semibold text-sm tracking-tight ${
                            item.status === "PURCHASED" ? "line-through text-zinc-500" : "text-white"
                          }`}>
                            {item.itemName}
                          </h3>
                          <p className="text-xs text-zinc-400 font-extrabold mt-0.5">
                            {item.quantity} {item.unit}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase border ${
                          item.status === "PURCHASED"
                            ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/10"
                            : "bg-yellow-500/5 text-yellow-400 border-yellow-500/10"
                        }`}>
                          {item.status === "PURCHASED" ? "Selesai" : "Pending"}
                        </span>
                      </div>

                      {/* Notes Box */}
                      {item.notes && (
                        <div className="bg-zinc-950/60 p-2.5 rounded-lg border border-zinc-900/60 flex items-start gap-2">
                          <FileText className="w-3.5 h-3.5 text-zinc-500 shrink-0 mt-0.5" />
                          <p className="text-[11px] text-zinc-400 leading-relaxed italic">{item.notes}</p>
                        </div>
                      )}

                      {/* Submitter Info & Date */}
                      <div className="border-t border-zinc-900/80 pt-3 space-y-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                          <User className="w-3 h-3 text-zinc-650" />
                          <span>Diajukan oleh: <strong className="text-zinc-400 font-semibold">{item.employee.name}</strong></span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
                          <Calendar className="w-3 h-3 text-zinc-650" />
                          <span>Waktu: {dateStr} WIB</span>
                        </div>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-zinc-900/50">
                      {/* Admin checkoff option */}
                      {isAdmin && isItemPending && (
                        <button
                          onClick={() => handleMarkPurchased(item.id)}
                          className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/15 text-[10px] font-bold uppercase cursor-pointer transition-colors"
                        >
                          <Check className="w-3 h-3" />
                          Sudah Dibeli
                        </button>
                      )}

                      {/* Delete option: Admin can delete anything, Employee can delete their own only if still pending */}
                      {(isAdmin || (item.employeeId === currentEmployee.id && isItemPending)) && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 border border-transparent hover:border-red-500/10 transition-colors cursor-pointer"
                          title="Hapus Kebutuhan"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                  </div>
                );
              })}
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
