import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useListStaff, getListStaffQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart2, Clock, DollarSign, TrendingUp, ChevronRight, Download, Printer } from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  receptionist: "bg-green-100 text-green-700",
  stylist: "bg-amber-100 text-amber-700",
  therapist: "bg-rose-100 text-rose-700",
};

const MONTH_PRESETS = [
  { label: "This Month", from: format(startOfMonth(new Date()), "yyyy-MM-dd"), to: format(endOfMonth(new Date()), "yyyy-MM-dd") },
  { label: "Last Month", from: format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd"), to: format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") },
  { label: "2 Months Ago", from: format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd"), to: format(endOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd") },
];

function StaffFinancialRow({ staff, from, to }: { staff: any; from: string; to: string }) {
  const { data: summary, isLoading } = useQuery({
    queryKey: ["payroll-summary", staff.id, from, to],
    queryFn: () =>
      fetch(`${API_BASE_URL}/api/staff/${staff.id}/financial-summary?from=${from}&to=${to}`, { credentials: "include" }).then((r) => r.json()),
  });

  const { data: wageSettings } = useQuery({
    queryKey: ["wage-settings", staff.id],
    queryFn: () => fetch(`${API_BASE_URL}/api/staff/${staff.id}/wage-settings`, { credentials: "include" }).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <tr className="border-b border-border">
        <td className="py-4 px-5" colSpan={6}><Skeleton className="h-8 w-full" /></td>
      </tr>
    );
  }

  const revenue = summary?.totalRevenue ?? 0;
  const commission = summary?.commissionEarned ?? 0;
  const wagePaid = summary?.wagePaid ?? 0;
  const netPayable = summary?.netPayable ?? 0;
  const hoursLogged = summary?.totalHoursLogged ?? 0;
  const wageType = wageSettings?.wageType ?? "—";
  const baseWage = wageSettings?.baseAmount ? `AED ${Number(wageSettings.baseAmount).toLocaleString()}` : "Not set";

  return (
    <tr className="border-b border-border hover:bg-muted/30 transition-colors group">
      <td className="py-4 px-5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
            style={{ backgroundColor: `${staff.color || "#8C7355"}20`, color: staff.color || "#8C7355" }}
          >
            {staff.name.charAt(0)}
          </div>
          <div>
            <div className="font-medium text-sm">{staff.name}</div>
            <Badge variant="secondary" className={`text-[10px] font-normal mt-0.5 ${ROLE_COLORS[staff.role] || ""}`}>
              {staff.role}
            </Badge>
          </div>
        </div>
      </td>
      <td className="py-4 px-4 text-sm text-right">
        <div className="font-medium">AED {Number(revenue).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="text-xs text-muted-foreground">gross revenue</div>
      </td>
      <td className="py-4 px-4 text-sm text-right">
        <div className="font-medium text-primary">AED {Number(commission).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        <div className="text-xs text-muted-foreground">earned</div>
      </td>
      <td className="py-4 px-4 text-sm text-right">
        <div className="font-medium">{baseWage}</div>
        <div className="text-xs text-muted-foreground capitalize">{wageType !== "—" ? wageType : "—"}</div>
      </td>
      <td className="py-4 px-4 text-sm text-right">
        <div className={`font-semibold ${netPayable > 0 ? "text-green-600" : "text-muted-foreground"}`}>
          AED {Number(netPayable).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
        <div className="text-xs text-muted-foreground">{hoursLogged > 0 ? `${hoursLogged}h logged` : "—"}</div>
      </td>
      <td className="py-4 px-4 text-right">
        <Link href={`/staff/${staff.id}/financials`}>
          <Button size="sm" variant="ghost" className="gap-1 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            Details
            <ChevronRight className="w-3.5 h-3.5" />
          </Button>
        </Link>
      </td>
    </tr>
  );
}

function exportPayrollCSV(rows: any[]) {
  const data = [
    ["Staff Member", "Role", "Revenue", "Commission", "Base Wage", "Wage Paid", "Net Payable", "Hours"],
    ...rows.map(r => [r.staff.name, r.staff.role, Number(r.summary?.totalRevenue ?? 0).toFixed(2), Number(r.summary?.commissionEarned ?? 0).toFixed(2), Number(r.wageSettings?.baseAmount ?? 0).toFixed(2), Number(r.summary?.wagePaid ?? 0).toFixed(2), Number(r.summary?.netPayable ?? 0).toFixed(2), Number(r.summary?.totalHoursLogged ?? 0).toFixed(2)])
  ];
  const csv = data.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" }); const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `payroll-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

export default function Payroll() {
  const [preset, setPreset] = useState(0);
  const { from, to } = MONTH_PRESETS[preset];

  const { data: staffList, isLoading } = useListStaff({
    query: { queryKey: getListStaffQueryKey() },
  });

  const activeStaff = staffList?.filter((s: any) => s.isActive && s.role !== "admin") ?? [];
  const payrollRows = activeStaff.map((staff: any) => ({ staff, summary: undefined, wageSettings: undefined }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Payroll Overview</h1>
          <p className="text-muted-foreground mt-1">
            Staff wages, commissions, and net payable — all in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => window.print()}><Printer className="w-3.5 h-3.5" />Print / PDF</Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportPayrollCSV(payrollRows)}><Download className="w-3.5 h-3.5" />CSV</Button>
          <Select value={String(preset)} onValueChange={(v) => setPreset(Number(v))}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTH_PRESETS.map((p, i) => <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active Staff", value: String(activeStaff.length), icon: BarChart2, color: "text-primary" },
          { label: "Period", value: `${format(new Date(from), "d MMM")} – ${format(new Date(to), "d MMM")}`, icon: Clock, color: "text-muted-foreground" },
          { label: "Commission Basis", value: "Per-staff slabs", icon: TrendingUp, color: "text-amber-600" },
          { label: "Currency", value: "AED", icon: DollarSign, color: "text-green-600" },
        ].map((item) => (
          <Card key={item.label} className="shadow-sm border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <item.icon className={`w-8 h-8 ${item.color} opacity-70`} />
              <div>
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="font-semibold text-sm">{item.value}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Staff Table */}
      <Card className="shadow-sm border-border overflow-hidden">
        <CardHeader className="border-b border-border px-5 py-4">
          <CardTitle className="text-base font-semibold">
            Staff Financial Summary — {MONTH_PRESETS[preset].label}
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-3 px-5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Staff Member</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Revenue</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Commission</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Base Wage</th>
                <th className="text-right py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Net Payable</th>
                <th className="py-3 px-4" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-4 px-5" colSpan={6}><Skeleton className="h-10 w-full" /></td>
                  </tr>
                ))
              ) : activeStaff.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No active staff found.
                  </td>
                </tr>
              ) : (
                activeStaff.map((staff: any) => (
                  <StaffFinancialRow key={staff.id} staff={staff} from={from} to={to} />
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Click any row's "Details" button to view full financials — working hours log, wage payments, commission slabs, and complete summary.
      </p>
    </div>
  );
}
