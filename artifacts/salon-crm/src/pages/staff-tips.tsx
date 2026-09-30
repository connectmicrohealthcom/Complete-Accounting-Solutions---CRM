import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, Users, Download } from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { useListStaff, getListStaffQueryKey } from "@workspace/api-client-react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const PRESETS = [
  { label: "Today", from: () => format(new Date(), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "Last 7 Days", from: () => format(subDays(new Date(), 6), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "This Month", from: () => format(startOfMonth(new Date()), "yyyy-MM-dd"), to: () => format(endOfMonth(new Date()), "yyyy-MM-dd") },
  { label: "Last Month", from: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return format(startOfMonth(d), "yyyy-MM-dd"); }, to: () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return format(endOfMonth(d), "yyyy-MM-dd"); } },
];

function fetchTips(params: { from?: string; to?: string; staffId?: string }) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.staffId) qs.set("staffId", params.staffId);
  return fetch(`${API_BASE_URL}/api/tips?${qs}`, { credentials: "include" }).then((r) => r.json());
}

function fetchTipsSummary(params: { from?: string; to?: string }) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  return fetch(`${API_BASE_URL}/api/tips/summary?${qs}`, { credentials: "include" }).then((r) => r.json());
}

export default function StaffTips() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [staffFilter, setStaffFilter] = useState("all");

  const { data: staff } = useListStaff({ query: { queryKey: getListStaffQueryKey() } });

  const summaryQuery = useQuery({
    queryKey: ["tips-summary", from, to],
    queryFn: () => fetchTipsSummary({ from, to }),
  });

  const tipsQuery = useQuery({
    queryKey: ["tips-list", from, to, staffFilter],
    queryFn: () => fetchTips({ from, to, staffId: staffFilter !== "all" ? staffFilter : undefined }),
  });

  const summary = summaryQuery.data;
  const tips: any[] = tipsQuery.data ?? [];

  const applyPreset = (preset: (typeof PRESETS)[0]) => {
    setFrom(preset.from());
    setTo(preset.to());
  };

  const exportCSV = () => {
    const rows = [["Date", "Client", "Staff", "Amount (AED)", "Note"]];
    for (const t of tips) {
      rows.push([
        format(new Date(t.createdAt), "dd/MM/yyyy"),
        t.clientName,
        t.staffName,
        t.amount.toFixed(2),
        t.note ?? "",
      ]);
    }
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tips-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Tips Summary</h1>
          <p className="text-muted-foreground mt-1">Track tips received by staff members.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV}>
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* Date Filters */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2 mb-4">
            {PRESETS.map((p) => (
              <Button key={p.label} variant="outline" size="sm" onClick={() => applyPreset(p)}>{p.label}</Button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Staff</Label>
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Staff</SelectItem>
                  {staff?.map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryQuery.isLoading ? (
          [...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        ) : (
          <>
            <Card className="shadow-sm border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <DollarSign className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tips</p>
                  <p className="text-2xl font-bold">AED {(summary?.totalTips ?? 0).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-6 h-6 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Tip Transactions</p>
                  <p className="text-2xl font-bold">{summary?.tipCount ?? 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-border">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Tip Amount</p>
                  <p className="text-2xl font-bold">
                    AED {summary?.tipCount > 0 ? ((summary.totalTips / summary.tipCount)).toFixed(2) : "0.00"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Chart */}
      {!summaryQuery.isLoading && summary?.byStaff?.length > 0 && (
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Tips by Staff Member</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={summary.byStaff} layout="vertical" margin={{ left: 16, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={(v) => `AED ${v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="staffName" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => [`AED ${Number(v).toFixed(2)}`, "Tips"]} />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Staff Tip Breakdown */}
      {!summaryQuery.isLoading && summary?.byStaff?.length > 0 && (
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg font-serif">Staff Tip Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {summary.byStaff.map((s: any) => (
                <div key={s.staffId} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{s.staffName}</p>
                    <p className="text-xs text-muted-foreground">{s.count} tip{s.count !== 1 ? "s" : ""}</p>
                  </div>
                  <p className="text-lg font-bold text-primary">AED {s.total.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full Tips Log */}
      <Card className="shadow-sm border-border">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-lg font-serif">Tips Log</CardTitle>
          <Badge variant="secondary">{tips.length} records</Badge>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-10 px-2 text-left font-medium text-muted-foreground">Date</th>
                  <th className="h-10 px-2 text-left font-medium text-muted-foreground">Client</th>
                  <th className="h-10 px-2 text-left font-medium text-muted-foreground">Staff</th>
                  <th className="h-10 px-2 text-left font-medium text-muted-foreground">Note</th>
                  <th className="h-10 px-2 text-right font-medium text-muted-foreground">Amount</th>
                </tr>
              </thead>
              <tbody>
                {tipsQuery.isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b">
                      {[...Array(5)].map((_, j) => <td key={j} className="p-2"><Skeleton className="h-4 w-full" /></td>)}
                    </tr>
                  ))
                ) : tips.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="h-24 text-center text-muted-foreground">No tips recorded in this period.</td>
                  </tr>
                ) : (
                  tips.map((tip: any) => (
                    <tr key={tip.id} className="border-b hover:bg-muted/40">
                      <td className="p-2 text-muted-foreground">{format(new Date(tip.createdAt), "dd/MM/yyyy")}</td>
                      <td className="p-2 font-medium">{tip.clientName}</td>
                      <td className="p-2">{tip.staffName}</td>
                      <td className="p-2 text-muted-foreground">{tip.note ?? "—"}</td>
                      <td className="p-2 text-right font-semibold text-primary">AED {tip.amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
