import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/hooks/use-toast";
import { Plus, Download, Trash2, Edit2, Settings } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";

const DEFAULT_CATEGORIES = ["Product Purchase", "Transportation", "Consumables", "Utilities", "Staff Wages", "Miscellaneous"];

function exportCSV(expenses: any[]) {
  const headers = ["Date", "Category", "Description", "Amount (AED)", "Payment Method", "Receipt Ref", "Added By"];
  const rows = expenses.map((e: any) => [
    e.date, e.category_name ?? "Uncategorized", e.description ?? "",
    Number(e.amount).toFixed(2), e.payment_method, e.receipt_ref ?? "", e.added_by ?? ""
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v: any) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = `expenses-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
}

export default function FinanceExpenses() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [catFilter, setCatFilter] = useState("all");
  const [pmFilter, setPmFilter] = useState("all");
  const [showExpenseDialog, setShowExpenseDialog] = useState(false);
  const [editExpense, setEditExpense] = useState<any>(null);
  const [showCatDialog, setShowCatDialog] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const qs = new URLSearchParams({ from, to });
  if (catFilter !== "all") qs.set("categoryId", catFilter);
  if (pmFilter !== "all") qs.set("paymentMethod", pmFilter);

  const { data: expenseData, isLoading } = useQuery({
    queryKey: ["expenses", from, to, catFilter, pmFilter],
    queryFn: () => fetch(`/api/expenses?${qs}`).then((r) => r.json()),
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["expense-categories"],
    queryFn: () => fetch("/api/expense-categories").then((r) => r.json()),
  });

  const deleteExpense = async (id: number) => {
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    toast({ title: "Expense deleted" });
    qc.invalidateQueries({ queryKey: ["expenses"] });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight">Expense Tracker</h1>
          <p className="text-muted-foreground mt-1">Record and track all salon expenses.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowCatDialog(true)}>
            <Settings className="w-4 h-4" />
            Categories
          </Button>
          <Button className="gap-1.5" onClick={() => { setEditExpense(null); setShowExpenseDialog(true); }}>
            <Plus className="w-4 h-4" />
            Add Expense
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="space-y-1"><Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <div className="space-y-1"><Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-36 h-8 text-sm" />
          </div>
          <div className="space-y-1"><Label className="text-xs">Category</Label>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label className="text-xs">Payment Method</Label>
            <Select value={pmFilter} onValueChange={setPmFilter}>
              <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5 h-8 ml-auto"
            onClick={() => exportCSV(expenseData?.expenses ?? [])}>
            <Download className="w-3.5 h-3.5" />CSV
          </Button>
        </CardContent>
      </Card>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Expenses", value: `AED ${Number(expenseData?.summary?.total ?? 0).toFixed(2)}`, color: "text-destructive" },
          { label: "Transactions", value: String(expenseData?.summary?.count ?? 0), color: "text-foreground" },
          { label: "Top Category", value: expenseData?.summary?.byCategory?.[0]?.category ?? "—", color: "text-foreground" },
          { label: "Avg per Entry", value: expenseData?.summary?.count ? `AED ${(expenseData.summary.total / expenseData.summary.count).toFixed(2)}` : "—", color: "text-foreground" },
        ].map((kpi) => (
          <Card key={kpi.label} className="shadow-sm border-border">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{kpi.label}</div>
              <div className={`text-xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <Card className="lg:col-span-1 shadow-sm border-border">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm">By Category</CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={expenseData?.summary?.byCategory ?? []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}`} />
                <YAxis type="category" dataKey="category" width={90} tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => [`AED ${Number(v).toFixed(2)}`, "Amount"]} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Expense List */}
        <Card className="lg:col-span-2 shadow-sm border-border overflow-hidden">
          <CardHeader className="border-b border-border pb-3">
            <CardTitle className="text-sm">Expense Log</CardTitle>
          </CardHeader>
          <div className="overflow-y-auto max-h-[420px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border sticky top-0">
                <tr>
                  {["Date","Category","Description","Amount","Method",""].map((h, i) => (
                    <th key={i} className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase ${h === "Amount" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? [...Array(6)].map((_, i) => (
                  <tr key={i} className="border-b"><td colSpan={6} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>
                )) : (expenseData?.expenses ?? []).map((e: any) => (
                  <tr key={e.id} className="border-b border-border hover:bg-muted/30 transition-colors group">
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-3 text-xs">{e.category_name ?? "—"}</td>
                    <td className="px-4 py-3 max-w-[160px] truncate text-muted-foreground">{e.description || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-destructive">AED {Number(e.amount).toFixed(2)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground capitalize">{e.payment_method}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditExpense(e); setShowExpenseDialog(true); }}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => deleteExpense(e.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!isLoading && (expenseData?.expenses ?? []).length === 0 && (
                  <tr><td colSpan={6} className="py-10 text-center text-muted-foreground text-sm">No expenses recorded for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add/Edit Expense Dialog */}
      {showExpenseDialog && (
        <ExpenseDialog
          expense={editExpense}
          categories={categories}
          onClose={() => { setShowExpenseDialog(false); setEditExpense(null); }}
          onSaved={() => qc.invalidateQueries({ queryKey: ["expenses"] })}
        />
      )}

      {/* Category Manager */}
      {showCatDialog && (
        <CategoryManagerDialog
          categories={categories}
          onClose={() => setShowCatDialog(false)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["expense-categories"] })}
        />
      )}
    </div>
  );
}

function ExpenseDialog({ expense, categories, onClose, onSaved }: { expense?: any; categories: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    date: expense?.date ?? format(new Date(), "yyyy-MM-dd"),
    categoryId: expense?.category_id ? String(expense.category_id) : "",
    amount: expense?.amount ? String(expense.amount) : "",
    description: expense?.description ?? "",
    paymentMethod: expense?.payment_method ?? "cash",
    receiptRef: expense?.receipt_ref ?? "",
    addedBy: expense?.added_by ?? "",
  });
  const { toast } = useToast();

  const save = async () => {
    if (!form.date || !form.amount) { toast({ title: "Date and amount required", variant: "destructive" }); return; }
    const method = expense ? "PUT" : "POST";
    const url = expense ? `/api/expenses/${expense.id}` : "/api/expenses";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (r.ok) {
      toast({ title: expense ? "Expense updated" : "Expense recorded" });
      onSaved(); onClose();
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">{expense ? "Edit Expense" : "Add Expense"}</DialogTitle>
          <DialogDescription>Record a salon expense.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Amount (AED) *</Label>
              <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={form.categoryId} onValueChange={(v) => setForm({ ...form, categoryId: v })}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Input placeholder="e.g. Hair dye products from supplier" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Payment Method</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm({ ...form, paymentMethod: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Receipt Ref</Label>
              <Input placeholder="INV-001" value={form.receiptRef} onChange={(e) => setForm({ ...form, receiptRef: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Added By</Label>
            <Input placeholder="Staff name" value={form.addedBy} onChange={(e) => setForm({ ...form, addedBy: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>{expense ? "Save Changes" : "Add Expense"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CategoryManagerDialog({ categories, onClose, onChanged }: { categories: any[]; onClose: () => void; onChanged: () => void }) {
  const [newName, setNewName] = useState("");
  const { toast } = useToast();

  const addCat = async () => {
    if (!newName.trim()) return;
    await fetch("/api/expense-categories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    toast({ title: "Category added" }); setNewName(""); onChanged();
  };

  const deleteCat = async (id: number) => {
    await fetch(`/api/expense-categories/${id}`, { method: "DELETE" });
    toast({ title: "Category deleted" }); onChanged();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-serif">Manage Categories</DialogTitle>
          <DialogDescription>Add or remove expense categories.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="flex gap-2">
            <Input placeholder="New category name" value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addCat()} />
            <Button onClick={addCat} size="sm"><Plus className="w-4 h-4" /></Button>
          </div>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {categories.map((c: any) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-2 border border-border rounded-md">
                <span className="text-sm">{c.name}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10"
                  onClick={() => deleteCat(c.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
