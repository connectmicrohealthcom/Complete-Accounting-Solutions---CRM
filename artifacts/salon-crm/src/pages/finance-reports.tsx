import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, TrendingUp, TrendingDown, Scale } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const SALON_NAME = "Layal Al Zahra";
const SALON_ADDRESS = "Dubai, UAE";

// ─── CSV Export ───────────────────────────────────────────────────────────────

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
  a.download = filename; a.click();
}

function pnlToCSV(data: any): string {
  const rows = [
    [`${SALON_NAME} - Profit & Loss Statement`],
    [`Period: ${data.period?.from ?? ""} to ${data.period?.to ?? ""}`],
    [],
    ["REVENUE"],
    ["Category", "Amount (AED)"],
    ...(data.revenue?.byCategory ?? []).map((r: any) => [r.category, Number(r.revenue).toFixed(2)]),
    ["TOTAL REVENUE", Number(data.revenue?.total ?? 0).toFixed(2)],
    [],
    ["OPERATING EXPENSES"],
    ["Category", "Amount (AED)"],
    ...(data.expenses?.byCategory ?? []).map((e: any) => [e.category, Number(e.total).toFixed(2)]),
    ["TOTAL EXPENSES", Number(data.expenses?.total ?? 0).toFixed(2)],
    [],
    ["NET PROFIT / (LOSS)", Number(data.netProfit ?? 0).toFixed(2)],
  ];
  return rows.map((r) => r.map((v: any) => `"${v}"`).join(",")).join("\n");
}

function tbToCSV(data: any): string {
  const rows = [
    [`${SALON_NAME} - Trial Balance`],
    [],
    ["Date", "Description", "Debit (AED)", "Credit (AED)"],
    ...(data.entries ?? []).map((e: any) => [e.date, e.description, Number(e.debit).toFixed(2), Number(e.credit).toFixed(2)]),
    [],
    ["TOTALS", "", Number(data.totalDebit ?? 0).toFixed(2), Number(data.totalCredit ?? 0).toFixed(2)],
    ["NET BALANCE", "", "", Number(data.netBalance ?? 0).toFixed(2)],
  ];
  return rows.map((r) => r.map((v: any) => `"${v}"`).join(",")).join("\n");
}

function bsToCSV(data: any): string {
  const rows = [
    [`${SALON_NAME} - Balance Sheet`],
    [`As of: ${data.asOf ?? ""}`],
    [],
    ["ASSETS"],
    ["Cash on Hand (Cash Sales)", Number(data.assets?.cashOnHand ?? 0).toFixed(2)],
    ["Wallet Receivables", Number(data.assets?.walletReceivables ?? 0).toFixed(2)],
    ["TOTAL ASSETS", Number(data.assets?.totalAssets ?? 0).toFixed(2)],
    [],
    ["LIABILITIES"],
    ["Gift Card Outstanding Liability", Number(data.liabilities?.giftCardOutstanding ?? 0).toFixed(2)],
    ["TOTAL LIABILITIES", Number(data.liabilities?.totalLiabilities ?? 0).toFixed(2)],
    [],
    ["EQUITY"],
    ["Net Profit", Number(data.equity?.netProfit ?? 0).toFixed(2)],
    ["TOTAL EQUITY", Number(data.equity?.totalEquity ?? 0).toFixed(2)],
  ];
  return rows.map((r) => r.map((v: any) => `"${v}"`).join(",")).join("\n");
}

// ─── P&L Component ────────────────────────────────────────────────────────────

function PnLReport({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["pnl", from, to],
    queryFn: () => fetch(`/api/finance/reports/pnl?from=${from}&to=${to}`).then((r) => r.json()),
  });

  if (isLoading) return <Skeleton className="h-96 w-full" />;
  if (!data) return null;

  const netColor = data.netProfit >= 0 ? "text-green-600" : "text-red-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{SALON_NAME}</div>
          <div className="text-sm text-muted-foreground">Profit & Loss · {from} to {to}</div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"
          onClick={() => downloadCSV(pnlToCSV(data), `pnl-${from}-${to}.csv`)}>
          <Download className="w-3.5 h-3.5" />CSV
        </Button>
      </div>

      {/* Revenue */}
      <Card className="border-border">
        <CardHeader className="pb-2 border-b border-border">
          <CardTitle className="text-sm font-semibold text-green-700 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />Revenue
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <tbody>
              {(data.revenue?.byCategory ?? []).map((r: any) => (
                <tr key={r.category} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-muted-foreground">{r.category}</td>
                  <td className="px-4 py-2.5 text-right">AED {Number(r.revenue).toFixed(2)}</td>
                </tr>
              ))}
              <tr className="bg-green-50 font-semibold">
                <td className="px-4 py-3 text-green-700">Total Revenue</td>
                <td className="px-4 py-3 text-right text-green-700">AED {Number(data.revenue?.total ?? 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Expenses */}
      <Card className="border-border">
        <CardHeader className="pb-2 border-b border-border">
          <CardTitle className="text-sm font-semibold text-red-700 flex items-center gap-2">
            <TrendingDown className="w-4 h-4" />Operating Expenses
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <tbody>
              {(data.expenses?.byCategory ?? []).map((e: any) => (
                <tr key={e.category} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 text-muted-foreground">{e.category}</td>
                  <td className="px-4 py-2.5 text-right">AED {Number(e.total).toFixed(2)}</td>
                </tr>
              ))}
              {(data.expenses?.byCategory ?? []).length === 0 && (
                <tr><td colSpan={2} className="px-4 py-3 text-muted-foreground text-center text-xs">No expenses recorded for this period.</td></tr>
              )}
              <tr className="bg-red-50 font-semibold">
                <td className="px-4 py-3 text-red-700">Total Expenses</td>
                <td className="px-4 py-3 text-right text-red-700">AED {Number(data.expenses?.total ?? 0).toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Net Profit */}
      <div className={`rounded-xl border-2 p-6 text-center ${data.netProfit >= 0 ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50"}`}>
        <div className="text-sm text-muted-foreground mb-1">Net Profit / (Loss)</div>
        <div className={`text-4xl font-bold font-serif ${netColor}`}>
          AED {Number(data.netProfit).toFixed(2)}
        </div>
        <div className={`text-xs mt-2 ${netColor}`}>
          {data.netProfit >= 0 ? "Profit" : "Loss"} for selected period
        </div>
      </div>
    </div>
  );
}

// ─── Trial Balance ────────────────────────────────────────────────────────────

function TrialBalance({ from, to }: { from: string; to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["trial-balance", from, to],
    queryFn: () => fetch(`/api/finance/reports/trial-balance?from=${from}&to=${to}`).then((r) => r.json()),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{SALON_NAME}</div>
          <div className="text-sm text-muted-foreground">Trial Balance · {from} to {to}</div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"
          onClick={() => downloadCSV(tbToCSV(data), `trial-balance-${from}-${to}.csv`)}>
          <Download className="w-3.5 h-3.5" />CSV
        </Button>
      </div>
      <Card className="border-border overflow-hidden">
        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border sticky top-0">
              <tr>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Description</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Debit (AED)</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Credit (AED)</th>
              </tr>
            </thead>
            <tbody>
              {(data.entries ?? []).map((e: any, i: number) => (
                <tr key={i} className="border-b border-border hover:bg-muted/20">
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{e.date ? String(e.date).split("T")[0] : "—"}</td>
                  <td className="px-4 py-2.5">{e.description}</td>
                  <td className="px-4 py-2.5 text-right text-red-600">{e.debit > 0 ? `${Number(e.debit).toFixed(2)}` : "—"}</td>
                  <td className="px-4 py-2.5 text-right text-green-600">{e.credit > 0 ? `${Number(e.credit).toFixed(2)}` : "—"}</td>
                </tr>
              ))}
              {(data.entries ?? []).length === 0 && (
                <tr><td colSpan={4} className="py-10 text-center text-muted-foreground text-sm">No entries for this period.</td></tr>
              )}
            </tbody>
            <tfoot className="bg-muted/50 border-t-2 border-border">
              <tr>
                <td className="px-4 py-3 font-semibold" colSpan={2}>Totals</td>
                <td className="px-4 py-3 text-right font-semibold text-red-600">AED {Number(data.totalDebit ?? 0).toFixed(2)}</td>
                <td className="px-4 py-3 text-right font-semibold text-green-600">AED {Number(data.totalCredit ?? 0).toFixed(2)}</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-bold text-primary" colSpan={2}>Net Balance</td>
                <td colSpan={2} className={`px-4 py-3 text-right font-bold ${data.netBalance >= 0 ? "text-green-600" : "text-red-600"}`}>
                  AED {Number(data.netBalance ?? 0).toFixed(2)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── Balance Sheet ────────────────────────────────────────────────────────────

function BalanceSheet({ to }: { to: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["balance-sheet", to],
    queryFn: () => fetch(`/api/finance/reports/balance-sheet?to=${to}`).then((r) => r.json()),
  });

  if (isLoading) return <Skeleton className="h-64 w-full" />;
  if (!data) return null;

  const balanced = Math.abs((data.assets?.totalAssets ?? 0) - (data.liabilities?.totalLiabilities ?? 0) - (data.equity?.totalEquity ?? 0)) < 0.01;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-lg font-semibold">{SALON_NAME}</div>
          <div className="text-sm text-muted-foreground">Balance Sheet · as of {data.asOf}</div>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5"
          onClick={() => downloadCSV(bsToCSV(data), `balance-sheet-${to}.csv`)}>
          <Download className="w-3.5 h-3.5" />CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Assets */}
        <Card className="border-border">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-sm text-blue-700">Assets</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border"><td className="px-4 py-2.5 text-muted-foreground">Cash on Hand</td><td className="px-4 py-2.5 text-right">AED {Number(data.assets?.cashOnHand ?? 0).toFixed(2)}</td></tr>
                <tr className="border-b border-border"><td className="px-4 py-2.5 text-muted-foreground">Wallet Receivables</td><td className="px-4 py-2.5 text-right">AED {Number(data.assets?.walletReceivables ?? 0).toFixed(2)}</td></tr>
                <tr className="bg-blue-50 font-semibold"><td className="px-4 py-3 text-blue-700">Total Assets</td><td className="px-4 py-3 text-right text-blue-700">AED {Number(data.assets?.totalAssets ?? 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Liabilities */}
        <Card className="border-border">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-sm text-red-700">Liabilities</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border"><td className="px-4 py-2.5 text-muted-foreground">Gift Card Liability</td><td className="px-4 py-2.5 text-right">AED {Number(data.liabilities?.giftCardOutstanding ?? 0).toFixed(2)}</td></tr>
                <tr className="bg-red-50 font-semibold"><td className="px-4 py-3 text-red-700">Total Liabilities</td><td className="px-4 py-3 text-right text-red-700">AED {Number(data.liabilities?.totalLiabilities ?? 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Equity */}
        <Card className="border-border">
          <CardHeader className="pb-2 border-b border-border">
            <CardTitle className="text-sm text-green-700">Equity</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border"><td className="px-4 py-2.5 text-muted-foreground">Net Profit</td><td className={`px-4 py-2.5 text-right ${Number(data.equity?.netProfit ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>AED {Number(data.equity?.netProfit ?? 0).toFixed(2)}</td></tr>
                <tr className="bg-green-50 font-semibold"><td className="px-4 py-3 text-green-700">Total Equity</td><td className="px-4 py-3 text-right text-green-700">AED {Number(data.equity?.totalEquity ?? 0).toFixed(2)}</td></tr>
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg ${balanced ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>
        <Scale className="w-4 h-4 shrink-0" />
        <span className="text-sm font-medium">
          {balanced ? "Balance sheet is balanced (Assets = Liabilities + Equity)" : "Note: Simplified balance sheet — equity equals net profit only."}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinanceReports() {
  const [report, setReport] = useState<"pnl" | "trial" | "balance">("pnl");
  const [preset, setPreset] = useState(0);
  const thisMonth = { from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: format(endOfMonth(new Date()), "yyyy-MM-dd") };
  const lastMonth = { from: format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), to: format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") };
  const PRESETS = [
    { label: "This Month", ...thisMonth },
    { label: "Last Month", ...lastMonth },
    { label: "This Year", from: `${new Date().getFullYear()}-01-01`, to: format(new Date(), "yyyy-MM-dd") },
  ];
  const [from, setFrom] = useState(PRESETS[0].from);
  const [to, setTo] = useState(PRESETS[0].to);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-semibold tracking-tight">Financial Reports</h1>
        <p className="text-muted-foreground mt-1">P&L, Trial Balance, and Balance Sheet — all exportable to CSV.</p>
      </div>

      {/* Report selector + date range */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">Report Type</Label>
            <Select value={report} onValueChange={(v) => setReport(v as any)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pnl">Profit & Loss Statement</SelectItem>
                <SelectItem value="trial">Trial Balance</SelectItem>
                <SelectItem value="balance">Balance Sheet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-1.5">
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

      {report === "pnl"     && <PnLReport from={from} to={to} />}
      {report === "trial"   && <TrialBalance from={from} to={to} />}
      {report === "balance" && <BalanceSheet to={to} />}
    </div>
  );
}
