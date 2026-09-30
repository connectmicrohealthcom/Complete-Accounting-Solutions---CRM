import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useListStaff, useListClients, getListStaffQueryKey, getListClientsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Download, CreditCard, Banknote, Smartphone, Wallet } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";

const PM_LABELS: Record<string, string> = {
  cash: "Cash", card: "Card", bank_transfer: "Bank Transfer", loyalty_points: "Loyalty Points"
};
const PM_COLORS: Record<string, string> = {
  cash: "#22c55e", card: "#3b82f6", bank_transfer: "#a855f7", loyalty_points: "#f59e0b"
};
const PM_ICONS: Record<string, React.ElementType> = {
  cash: Banknote, card: CreditCard, bank_transfer: Smartphone, loyalty_points: Wallet
};

const PRESETS = [
  { label: "Today", from: format(new Date(), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") },
  { label: "Last 7 Days", from: format(subDays(new Date(), 6), "yyyy-MM-dd"), to: format(new Date(), "yyyy-MM-dd") },
  { label: "This Month", from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: format(endOfMonth(new Date()), "yyyy-MM-dd") },
  { label: "Last Month", from: format(startOfMonth(new Date(new Date().setMonth(new Date().getMonth()-1))), "yyyy-MM-dd"), to: format(endOfMonth(new Date(new Date().setMonth(new Date().getMonth()-1))), "yyyy-MM-dd") },
  { label: "All Time", from: "2020-01-01", to: format(new Date(), "yyyy-MM-dd") },
];

function exportCSV(rows: any[], filename: string) {
  const headers = ["Date", "Client", "Staff", "Subtotal", "Discount", "Total", "Payment Method", "Items"];
  const data = rows.map((r: any) => [
    format(new Date(r.created_at), "yyyy-MM-dd HH:mm"),
    r.client_name, r.staff_name,
    Number(r.subtotal).toFixed(2), Number(r.discount).toFixed(2), Number(r.total).toFixed(2),
    PM_LABELS[r.payment_method] ?? r.payment_method,
    (r.items ?? []).map((i: any) => i.name).join("; "),
  ]);
  const csv = [headers, ...data].map((r) => r.map((v: any) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
}

export default function FinancePaymentSummary() {
  const [preset, setPreset] = useState(2);
  const [from, setFrom] = useState(PRESETS[2].from);
  const [to, setTo] = useState(PRESETS[2].to);
  const [paymentMethod, setPaymentMethod] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [clientSearch, setClientSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"log" | "breakdown" | "client">("log");

  const { data: staffList } = useListStaff({ query: { queryKey: getListStaffQueryKey() } });

  const qs = new URLSearchParams({ from, to });
  if (paymentMethod !== "all") qs.set("paymentMethod", paymentMethod);
  if (staffFilter !== "all") qs.set("staffId", staffFilter);

  const { data: salesData, isLoading: loadingSales } = useQuery({
    queryKey: ["sales-log", from, to, paymentMethod, staffFilter],
    queryFn: () => fetch(`/api/finance/sales-log?${qs}&limit=200`).then((r) => r.json()),
  });

  const { data: breakdown = [], isLoading: loadingBreakdown } = useQuery({
    queryKey: ["payment-breakdown", from, to],
    queryFn: () => fetch(`/api/finance/payment-breakdown?from=${from}&to=${to}`).then((r) => r.json()),
  });

  const { data: clientData } = useListClients({ search: clientSearch, limit: 20 }, {
    query: { queryKey: getListClientsQueryKey({ search: clientSearch, limit: 20 }), enabled: activeTab === "client" }
  });
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const { data: clientPayments = [], isLoading: loadingClientPay } = useQuery({
    queryKey: ["client-payments", selectedClientId],
    queryFn: () => fetch(`/api/finance/client-payments/${selectedClientId}`).then((r) => r.json()),
    enabled: !!selectedClientId,
  });

  const totalRevenue = breakdown.reduce((s: number, r: any) => s + r.totalAmount, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight">Payment Summary</h1>
          <p className="text-muted-foreground mt-1">Sales log, payment methods, and client payment history.</p>
        </div>
      </div>

      {/* Date range */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p, i) => (
              <Button key={i} size="sm" variant={preset === i ? "default" : "outline"}
                onClick={() => { setPreset(i); setFrom(p.from); setTo(p.to); }}>
                {p.label}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 items-end">
            <div className="space-y-1"><Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPreset(-1); }} className="w-36 h-8 text-sm" />
            </div>
            <div className="space-y-1"><Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPreset(-1); }} className="w-36 h-8 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border">
        {[{ key: "log", label: "Sales Log" }, { key: "breakdown", label: "Payment Breakdown" }, { key: "client", label: "Client History" }].map((t) => (
          <button key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* SALES LOG */}
      {activeTab === "log" && (
        <Card className="shadow-sm border-border">
          <CardHeader className="border-b border-border pb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">
                Sales Log {salesData ? <span className="text-muted-foreground font-normal">({salesData.total} transactions · AED {totalRevenue.toFixed(2)})</span> : ""}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Payment method" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="loyalty_points">Loyalty Points</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Staff" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Staff</SelectItem>
                    {staffList?.map((s: any) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="sm" className="gap-1.5 h-8"
                  onClick={() => exportCSV(salesData?.sales ?? [], `sales-log-${from}-${to}.csv`)}>
                  <Download className="w-3.5 h-3.5" />CSV
                </Button>
              </div>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  {["Date", "Client", "Staff", "Subtotal", "Discount", "Total", "Method"].map((h) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase ${h === "Total" || h === "Subtotal" || h === "Discount" ? "text-right" : "text-left"}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingSales ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      <td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
                    </tr>
                  ))
                ) : (salesData?.sales ?? []).map((sale: any) => (
                  <tr key={sale.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                      {format(new Date(sale.created_at), "d MMM yyyy, HH:mm")}
                    </td>
                    <td className="px-4 py-3 font-medium">{sale.client_name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{sale.staff_name}</td>
                    <td className="px-4 py-3 text-right">AED {Number(sale.subtotal).toFixed(2)}</td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {Number(sale.discount) > 0 ? `-AED ${Number(sale.discount).toFixed(2)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">AED {Number(sale.total).toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" className="text-xs">{PM_LABELS[sale.payment_method] ?? sale.payment_method}</Badge>
                    </td>
                  </tr>
                ))}
                {!loadingSales && (salesData?.sales ?? []).length === 0 && (
                  <tr><td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">No sales found for this period.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* PAYMENT BREAKDOWN */}
      {activeTab === "breakdown" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base">Revenue by Payment Method</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingBreakdown ? <Skeleton className="h-48 w-full" /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={breakdown}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="paymentMethod" tickFormatter={(v) => PM_LABELS[v] ?? v} tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `AED ${v}`} />
                    <Tooltip formatter={(v: any) => [`AED ${Number(v).toFixed(2)}`, "Revenue"]} />
                    <Bar dataKey="totalAmount" radius={[4, 4, 0, 0]}>
                      {breakdown.map((b: any) => (
                        <Cell key={b.paymentMethod} fill={PM_COLORS[b.paymentMethod] ?? "#8884d8"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base">Summary Table</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Method</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Transactions</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Revenue</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((b: any) => {
                    const Icon = PM_ICONS[b.paymentMethod] ?? CreditCard;
                    return (
                      <tr key={b.paymentMethod} className="border-b border-border">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Icon className="w-4 h-4 text-muted-foreground" />
                            <span className="font-medium">{PM_LABELS[b.paymentMethod] ?? b.paymentMethod}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{b.transactionCount}</td>
                        <td className="px-4 py-3 text-right font-semibold">AED {Number(b.totalAmount).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">
                          {totalRevenue > 0 ? `${((b.totalAmount / totalRevenue) * 100).toFixed(1)}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right">{breakdown.reduce((s: number, b: any) => s + b.transactionCount, 0)}</td>
                    <td className="px-4 py-3 text-right">AED {totalRevenue.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">100%</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CLIENT PAYMENT HISTORY */}
      {activeTab === "client" && (
        <div className="space-y-4">
          <div className="flex gap-3">
            <Input placeholder="Search client by name or phone..."
              value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="max-w-sm" />
          </div>
          {clientSearch && (
            <Card className="shadow-sm border-border">
              <CardContent className="p-0">
                {(clientData?.clients ?? []).map((c: any) => (
                  <div key={c.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 border-b border-border transition-colors ${selectedClientId === c.id ? "bg-primary/5" : ""}`}
                    onClick={() => setSelectedClientId(c.id)}>
                    <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{c.name.charAt(0)}</div>
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-xs text-muted-foreground">{c.phone || c.email || "—"}</div>
                    </div>
                    <div className="ml-auto text-xs text-muted-foreground">AED {Number(c.totalSpent).toFixed(2)} · {c.visitCount} visits</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {selectedClientId && (
            <Card className="shadow-sm border-border">
              <CardHeader className="border-b border-border pb-3">
                <CardTitle className="text-base">Payment History</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      {["Date","Staff","Items","Subtotal","Discount","Total","Method"].map((h) => (
                        <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase ${["Subtotal","Discount","Total"].includes(h) ? "text-right" : "text-left"}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {loadingClientPay ? [...Array(5)].map((_, i) => (
                      <tr key={i} className="border-b"><td colSpan={7} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td></tr>
                    )) : clientPayments.map((p: any) => (
                      <tr key={p.id} className="border-b border-border hover:bg-muted/30">
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{format(new Date(p.created_at), "d MMM yyyy, HH:mm")}</td>
                        <td className="px-4 py-3">{p.staff_name}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">
                          {(p.items ?? []).map((i: any) => i.name).join(", ") || "—"}
                        </td>
                        <td className="px-4 py-3 text-right">AED {Number(p.subtotal).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{Number(p.discount) > 0 ? `-AED ${Number(p.discount).toFixed(2)}` : "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold">AED {Number(p.total).toFixed(2)}</td>
                        <td className="px-4 py-3"><Badge variant="outline" className="text-xs">{PM_LABELS[p.payment_method] ?? p.payment_method}</Badge></td>
                      </tr>
                    ))}
                    {!loadingClientPay && clientPayments.length === 0 && (
                      <tr><td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">No payment history found.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
