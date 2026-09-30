import { useState, useMemo, useEffect } from "react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, parseISO } from "date-fns";
import { useSearch } from "wouter";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAppointments, getListAppointmentsQueryKey,
  useGetAppointmentSummary, getGetAppointmentSummaryQueryKey,
  useUpdateAppointmentStatus, useCreateAppointment,
  useListClients, getListClientsQueryKey,
  useListStaff, getListStaffQueryKey,
  useListServices, getListServicesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Legend,
} from "recharts";
import {
  Plus, CalendarIcon, Download, ChevronDown, ChevronRight, BarChart2, List,
  Users, CheckCircle, XCircle, AlertCircle, Clock, TrendingUp, UserCheck, UserPlus,
} from "lucide-react";
import { AppointmentStatusUpdateStatus } from "@workspace/api-client-react";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-blue-100 text-blue-800 border-blue-200",
  in_progress: "bg-purple-100 text-purple-800 border-purple-200",
  completed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  no_show: "bg-gray-100 text-gray-700 border-gray-200",
};

const PIE_COLORS = ["#22c55e", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#6b7280"];

type Preset = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";
type ApptForm = { clientId: string; staffId: string; serviceId: string; date: string; startTime: string; notes: string };

function getPresetDates(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "today": return { from: fmt(today), to: fmt(today) };
    case "yesterday": { const y = subDays(today, 1); return { from: fmt(y), to: fmt(y) }; }
    case "this_week": return { from: fmt(startOfWeek(today, { weekStartsOn: 1 })), to: fmt(endOfWeek(today, { weekStartsOn: 1 })) };
    case "last_week": { const lw = subWeeks(today, 1); return { from: fmt(startOfWeek(lw, { weekStartsOn: 1 })), to: fmt(endOfWeek(lw, { weekStartsOn: 1 })) }; }
    case "this_month": return { from: fmt(startOfMonth(today)), to: fmt(endOfMonth(today)) };
    case "last_month": { const lm = subMonths(today, 1); return { from: fmt(startOfMonth(lm)), to: fmt(endOfMonth(lm)) }; }
    default: return { from: fmt(startOfMonth(today)), to: fmt(endOfMonth(today)) };
  }
}

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7am–8pm

function Heatmap({ data }: { data: { dayOfWeek: number; hour: number; count: number }[] }) {
  const maxCount = Math.max(1, ...data.map(d => d.count));
  const map = new Map(data.map(d => [`${d.dayOfWeek}-${d.hour}`, d.count]));
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[500px]">
        <div className="flex mb-1">
          <div className="w-8" />
          {HOURS.map(h => (
            <div key={h} className="flex-1 text-center text-[10px] text-muted-foreground">
              {h % 3 === 0 ? `${h}h` : ""}
            </div>
          ))}
        </div>
        {DOW_LABELS.map((day, dow) => (
          <div key={dow} className="flex items-center mb-0.5">
            <div className="w-8 text-[10px] text-muted-foreground text-right pr-1">{day}</div>
            {HOURS.map(h => {
              const count = map.get(`${dow}-${h}`) ?? 0;
              const intensity = count / maxCount;
              const bg = count === 0 ? "bg-muted/30" : "";
              const style = count > 0 ? { backgroundColor: `hsl(338 48% ${Math.round(80 - intensity * 50)}%)` } : {};
              return (
                <div
                  key={h}
                  className={`flex-1 h-5 mx-0.5 rounded-sm ${bg}`}
                  style={style}
                  title={`${day} ${h}:00 — ${count} appts`}
                />
              );
            })}
          </div>
        ))}
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <span>Low</span>
          {[0.1, 0.3, 0.5, 0.7, 1].map(i => (
            <div
              key={i}
              className="w-4 h-4 rounded-sm"
              style={{ backgroundColor: `hsl(338 48% ${Math.round(80 - i * 50)}%)` }}
            />
          ))}
          <span>High</span>
        </div>
      </div>
    </div>
  );
}

function exportCSV(appointments: any[]) {
  const headers = ["ID", "Date", "Time", "Client", "Phone", "Staff", "Service", "Category", "Status", "Total (AED)", "Payment", "Notes"];
  const rows = appointments.map(a => [
    a.id,
    a.date,
    a.startTime.substring(0, 5),
    `"${a.clientName}"`,
    a.clientPhone ?? "",
    `"${a.staffName}"`,
    `"${a.serviceName}"`,
    a.serviceCategoryName ?? "",
    a.status,
    Number(a.totalPrice).toFixed(2),
    a.paymentMethod ?? "",
    `"${(a.notes ?? "").replace(/"/g, "'")}"`
  ]);
  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appointments-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Appointments() {
  const queryString = useSearch();
  const urlTab = new URLSearchParams(queryString).get("tab");
  const [tab, setTab] = useState<"summary" | "list">(() =>
    urlTab === "summary" ? "summary" : "list"
  );

  useEffect(() => {
    if (urlTab === "summary") setTab("summary");
    else if (urlTab === "list") setTab("list");
  }, [urlTab]);

  const [apptDialog, setApptDialog] = useState(false);

  // Summary state
  const [summaryPreset, setSummaryPreset] = useState<Preset>("this_month");
  const [summaryCustomFrom, setSummaryCustomFrom] = useState("");
  const [summaryCustomTo, setSummaryCustomTo] = useState("");

  // List filters
  const [search, setSearch] = useState("");
  const [listFrom, setListFrom] = useState("");
  const [listTo, setListTo] = useState("");
  const [listStatus, setListStatus] = useState("all");
  const [listStaff, setListStaff] = useState("all");
  const [listService, setListService] = useState("all");
  const [listPayment, setListPayment] = useState("all");
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [sortCol, setSortCol] = useState<"date" | "client" | "staff" | "total">("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  // Summary dates
  const summaryDates = summaryPreset === "custom"
    ? { from: summaryCustomFrom || format(startOfMonth(new Date()), "yyyy-MM-dd"), to: summaryCustomTo || today }
    : getPresetDates(summaryPreset);

  // Summary data
  const { data: summary, isLoading: summaryLoading } = useGetAppointmentSummary(
    { from: summaryDates.from, to: summaryDates.to },
    { query: { queryKey: getGetAppointmentSummaryQueryKey({ from: summaryDates.from, to: summaryDates.to }), enabled: tab === "summary" } }
  );

  // List data
  const listParams = {
    search: search || undefined,
    from: listFrom || undefined,
    to: listTo || undefined,
    status: (listStatus !== "all" ? listStatus : undefined),
    staffId: (listStaff !== "all" ? parseInt(listStaff) : undefined),
    serviceId: (listService !== "all" ? parseInt(listService) : undefined),
    paymentMethod: (listPayment !== "all" ? listPayment : undefined),
  };
  const { data: appointments, isLoading } = useListAppointments(listParams, {
    query: { queryKey: getListAppointmentsQueryKey(listParams) }
  });

  // Filter dropdowns data
  const { data: allStaff } = useListStaff({ query: { queryKey: getListStaffQueryKey() } });
  const { data: allServices } = useListServices({}, { query: { queryKey: getListServicesQueryKey({}) } });
  const { data: clients } = useListClients({ limit: 500 }, { query: { queryKey: getListClientsQueryKey({ limit: 500 }), enabled: apptDialog } });

  const updateStatus = useUpdateAppointmentStatus();
  const createAppointment = useCreateAppointment();

  const form = useForm<ApptForm>({
    defaultValues: { clientId: "", staffId: "", serviceId: "", date: today, startTime: "10:00", notes: "" }
  });

  const handleStatusChange = (id: number, status: AppointmentStatusUpdateStatus) => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() })
    });
  };

  const onSubmit = (data: ApptForm) => {
    const selectedService = allServices?.find(s => s.id.toString() === data.serviceId);
    const duration = selectedService?.duration || 60;
    const [h, m] = data.startTime.split(":").map(Number);
    const endDate = new Date(0, 0, 0, h, m + duration);
    const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
    createAppointment.mutate({
      data: { clientId: parseInt(data.clientId), staffId: parseInt(data.staffId), serviceId: parseInt(data.serviceId) || 0, date: data.date, startTime: data.startTime, notes: data.notes || undefined }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setApptDialog(false);
      }
    });
  };

  // Sorted + paginated list
  const sortedAppts = useMemo(() => {
    if (!appointments) return [];
    return [...appointments].sort((a, b) => {
      let cmp = 0;
      if (sortCol === "date") cmp = (a.date + a.startTime).localeCompare(b.date + b.startTime);
      else if (sortCol === "client") cmp = a.clientName.localeCompare(b.clientName);
      else if (sortCol === "staff") cmp = a.staffName.localeCompare(b.staffName);
      else if (sortCol === "total") cmp = Number(a.totalPrice) - Number(b.totalPrice);
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [appointments, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedAppts.length / rowsPerPage));
  const pageAppts = sortedAppts.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const toggleSort = (col: typeof sortCol) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === pageAppts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(pageAppts.map(a => a.id)));
  };

  const clearFilters = () => {
    setSearch(""); setListFrom(""); setListTo(""); setListStatus("all");
    setListStaff("all"); setListService("all"); setListPayment("all"); setPage(1);
  };

  const hasFilters = search || listFrom || listTo || listStatus !== "all" || listStaff !== "all" || listService !== "all" || listPayment !== "all";

  const PRESET_LABELS: { key: Preset; label: string }[] = [
    { key: "today", label: "Today" }, { key: "yesterday", label: "Yesterday" },
    { key: "this_week", label: "This Week" }, { key: "last_week", label: "Last Week" },
    { key: "this_month", label: "This Month" }, { key: "last_month", label: "Last Month" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Appointments</h1>
          <p className="text-muted-foreground mt-1">Manage, analyse, and track all salon appointments.</p>
        </div>
        <Button className="shrink-0 gap-2" onClick={() => { form.reset({ clientId: "", staffId: "", serviceId: "", date: today, startTime: "10:00", notes: "" }); setApptDialog(true); }}>
          <Plus className="w-4 h-4" /> New Appointment
        </Button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-border">
        {([{ key: "list", icon: List, label: "Appointment List" }, { key: "summary", icon: BarChart2, label: "Summary & Analytics" }] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── SUMMARY TAB ─── */}
      {tab === "summary" && (
        <div className="space-y-6">
          {/* Date presets */}
          <div className="flex flex-wrap gap-2 items-center">
            {PRESET_LABELS.map(p => (
              <button
                key={p.key}
                onClick={() => setSummaryPreset(p.key)}
                className={`px-3 py-1.5 text-sm rounded-full border transition-colors ${summaryPreset === p.key ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-foreground"}`}
              >
                {p.label}
              </button>
            ))}
            {summaryPreset === "custom" && (
              <div className="flex items-center gap-2 ml-2">
                <input type="date" value={summaryCustomFrom} onChange={e => setSummaryCustomFrom(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                <span className="text-muted-foreground text-sm">to</span>
                <input type="date" value={summaryCustomTo} onChange={e => setSummaryCustomTo(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
              </div>
            )}
            <span className="text-xs text-muted-foreground ml-1">
              {summaryDates.from} → {summaryDates.to}
            </span>
          </div>

          {/* KPI Cards */}
          {summaryLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : summary && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: "Total Appointments", value: summary.totals.total, icon: CalendarIcon, color: "text-blue-500" },
                  { label: "Completed", value: summary.totals.completed, icon: CheckCircle, color: "text-green-500" },
                  { label: "Cancelled", value: summary.totals.cancelled, icon: XCircle, color: "text-red-500" },
                  { label: "No Shows", value: summary.totals.noShow, icon: AlertCircle, color: "text-gray-500" },
                  { label: "Total Revenue", value: `AED ${summary.totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0 })}`, icon: TrendingUp, color: "text-primary" },
                  { label: "Avg. Revenue", value: `AED ${summary.totals.avgRevenue.toFixed(0)}`, icon: BarChart2, color: "text-purple-500" },
                  { label: "New Clients", value: summary.totals.newClients, icon: UserPlus, color: "text-orange-500" },
                  { label: "Returning Clients", value: summary.totals.returningClients, icon: UserCheck, color: "text-teal-500" },
                ].map(kpi => (
                  <Card key={kpi.label} className="shadow-sm">
                    <CardContent className="pt-5 pb-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">{kpi.label}</p>
                          <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                        </div>
                        <kpi.icon className={`w-5 h-5 mt-1 ${kpi.color}`} />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Charts Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Status donut */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Appointments by Status</CardTitle></CardHeader>
                  <CardContent>
                    {summary.byStatus.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">No data for this period.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={summary.byStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3}>
                            {summary.byStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip formatter={(v, n) => [v, String(n).replace("_", " ")]} />
                          <Legend formatter={(v) => String(v).replace("_", " ")} />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Staff bar */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Appointments by Staff</CardTitle></CardHeader>
                  <CardContent>
                    {summary.byStaff.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">No data for this period.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={summary.byStaff} layout="vertical" margin={{ left: 0, right: 16 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis type="category" dataKey="staffName" width={90} tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="count" fill="hsl(338 48% 44%)" radius={[0, 4, 4, 0]} name="Appointments" />
                          <Bar dataKey="completed" fill="hsl(142 71% 45%)" radius={[0, 4, 4, 0]} name="Completed" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category pie */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Appointments by Service Category</CardTitle></CardHeader>
                  <CardContent>
                    {summary.byCategory.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">No data for this period.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie data={summary.byCategory} dataKey="count" nameKey="categoryName" cx="50%" cy="50%" outerRadius={85} paddingAngle={2}>
                            {summary.byCategory.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Heatmap */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Peak Times Heatmap</CardTitle></CardHeader>
                  <CardContent>
                    {summary.byDayHour.length === 0 ? (
                      <p className="text-center text-muted-foreground py-8 text-sm">No data for this period.</p>
                    ) : (
                      <Heatmap data={summary.byDayHour} />
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Bottom tables */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Top 5 services */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 Services</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="pb-2 text-left font-medium">Service</th>
                          <th className="pb-2 text-right font-medium">Count</th>
                          <th className="pb-2 text-right font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.topServicesByCount.map((s, i) => (
                          <tr key={s.serviceId} className="border-b last:border-0">
                            <td className="py-2 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                              {s.serviceName}
                            </td>
                            <td className="py-2 text-right">{s.count}</td>
                            <td className="py-2 text-right text-primary font-medium">AED {s.revenue.toFixed(0)}</td>
                          </tr>
                        ))}
                        {summary.topServicesByCount.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* Top 5 staff */}
                <Card className="shadow-sm">
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Top 5 Staff by Completions</CardTitle></CardHeader>
                  <CardContent>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-muted-foreground text-xs">
                          <th className="pb-2 text-left font-medium">Staff</th>
                          <th className="pb-2 text-right font-medium">Completed</th>
                          <th className="pb-2 text-right font-medium">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.topStaffByCompleted.map((s, i) => (
                          <tr key={s.staffId} className="border-b last:border-0">
                            <td className="py-2 flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                              {s.staffName}
                            </td>
                            <td className="py-2 text-right">{s.completed}</td>
                            <td className="py-2 text-right text-primary font-medium">AED {s.revenue.toFixed(0)}</td>
                          </tr>
                        ))}
                        {summary.topStaffByCompleted.length === 0 && <tr><td colSpan={3} className="py-4 text-center text-muted-foreground">No data</td></tr>}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}

      {/* ─── LIST TAB ─── */}
      {tab === "list" && (
        <div className="space-y-4">
          {/* Filter row */}
          <Card className="shadow-sm border-border">
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Search client</label>
                  <Input placeholder="Name or phone..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} className="h-9" />
                </div>
                <div className="min-w-[130px]">
                  <label className="text-xs text-muted-foreground mb-1 block">From</label>
                  <input type="date" value={listFrom} onChange={e => { setListFrom(e.target.value); setPage(1); }} className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="min-w-[130px]">
                  <label className="text-xs text-muted-foreground mb-1 block">To</label>
                  <input type="date" value={listTo} onChange={e => { setListTo(e.target.value); setPage(1); }} className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
                </div>
                <div className="min-w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                  <Select value={listStatus} onValueChange={v => { setListStatus(v); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="no_show">No Show</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[150px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Staff</label>
                  <Select value={listStaff} onValueChange={v => { setListStaff(v); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All Staff" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Staff</SelectItem>
                      {allStaff?.filter(s => s.role !== "admin").map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Service</label>
                  <Select value={listService} onValueChange={v => { setListService(v); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All Services" /></SelectTrigger>
                    <SelectContent className="max-h-64">
                      <SelectItem value="all">All Services</SelectItem>
                      {allServices?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="min-w-[140px]">
                  <label className="text-xs text-muted-foreground mb-1 block">Payment</label>
                  <Select value={listPayment} onValueChange={v => { setListPayment(v); setPage(1); }}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="All Methods" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                      <SelectItem value="loyalty_points">Loyalty Points</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {hasFilters && (
                  <Button variant="ghost" size="sm" className="h-9 mt-5" onClick={clearFilters}>Clear filters</Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Bulk actions + export + pagination controls */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{appointments?.length ?? 0} results</span>
              {selectedIds.size > 0 && (
                <>
                  <span>·</span>
                  <span className="font-medium text-foreground">{selectedIds.size} selected</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1"
                    onClick={() => {
                      const sel = sortedAppts.filter(a => selectedIds.has(a.id));
                      exportCSV(sel);
                    }}
                  >
                    <Download className="w-3 h-3" /> Export selected
                  </Button>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1"
                onClick={() => exportCSV(sortedAppts)}
              >
                <Download className="w-3 h-3" /> Export all
              </Button>
              <Select value={rowsPerPage.toString()} onValueChange={v => { setRowsPerPage(parseInt(v)); setPage(1); }}>
                <SelectTrigger className="h-8 w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map(n => <SelectItem key={n} value={n.toString()}>{n} / page</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Table */}
          <Card className="shadow-sm border-border">
            <CardContent className="p-0">
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="h-10 px-3 text-left w-8">
                        <Checkbox
                          checked={pageAppts.length > 0 && selectedIds.size === pageAppts.length}
                          onCheckedChange={toggleSelectAll}
                        />
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("date")}>
                        Date / Time {sortCol === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("client")}>
                        Client {sortCol === "client" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Service</th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("staff")}>
                        Staff {sortCol === "staff" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground cursor-pointer hover:text-foreground" onClick={() => toggleSort("total")}>
                        Total {sortCol === "total" ? (sortDir === "asc" ? "↑" : "↓") : ""}
                      </th>
                      <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Status</th>
                      <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Update</th>
                    </tr>
                  </thead>
                  <tbody className="[&_tr:last-child]:border-0">
                    {isLoading ? (
                      [...Array(8)].map((_, i) => (
                        <tr key={i} className="border-b">
                          {[...Array(8)].map((_, j) => (
                            <td key={j} className="p-2"><Skeleton className="h-4 w-full" /></td>
                          ))}
                        </tr>
                      ))
                    ) : pageAppts.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="h-24 text-center text-muted-foreground">
                          <CalendarIcon className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                          {hasFilters ? "No appointments match your filters." : "No appointments found."}
                        </td>
                      </tr>
                    ) : (
                      pageAppts.map(apt => (
                        <>
                          <tr
                            key={apt.id}
                            className={`border-b transition-colors hover:bg-muted/30 cursor-pointer ${selectedIds.has(apt.id) ? "bg-primary/5" : ""}`}
                            onClick={() => setExpandedId(expandedId === apt.id ? null : apt.id)}
                          >
                            <td className="px-3 py-2 align-middle" onClick={e => { e.stopPropagation(); toggleSelect(apt.id); }}>
                              <Checkbox checked={selectedIds.has(apt.id)} onCheckedChange={() => toggleSelect(apt.id)} />
                            </td>
                            <td className="p-2 align-middle">
                              <div className="font-medium text-xs">{apt.startTime.substring(0, 5)}</div>
                              <div className="text-xs text-muted-foreground">{format(parseISO(apt.date), "dd MMM yyyy")}</div>
                            </td>
                            <td className="p-2 align-middle">
                              <div className="font-medium">{apt.clientName}</div>
                              {apt.clientPhone && <div className="text-xs text-muted-foreground">{apt.clientPhone}</div>}
                            </td>
                            <td className="p-2 align-middle">
                              <div className="text-sm">{apt.serviceName}</div>
                              {apt.serviceCategoryName && <div className="text-xs text-muted-foreground">{apt.serviceCategoryName}</div>}
                            </td>
                            <td className="p-2 align-middle text-sm text-muted-foreground">{apt.staffName}</td>
                            <td className="p-2 align-middle text-sm font-medium">
                              AED {Number(apt.totalPrice).toFixed(0)}
                            </td>
                            <td className="p-2 align-middle">
                              <Badge variant="outline" className={`capitalize text-xs ${STATUS_COLORS[apt.status] || ""}`}>
                                {apt.status.replace("_", " ")}
                              </Badge>
                            </td>
                            <td className="p-2 align-middle text-right" onClick={e => e.stopPropagation()}>
                              <Select
                                value={apt.status}
                                onValueChange={(val: AppointmentStatusUpdateStatus) => handleStatusChange(apt.id, val)}
                              >
                                <SelectTrigger className="w-[120px] h-8 ml-auto text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="confirmed">Confirmed</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                  <SelectItem value="cancelled">Cancelled</SelectItem>
                                  <SelectItem value="no_show">No Show</SelectItem>
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                          {expandedId === apt.id && (
                            <tr key={`${apt.id}-exp`} className="border-b bg-muted/20">
                              <td />
                              <td colSpan={7} className="px-4 py-3">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Appointment ID</p>
                                    <p className="font-mono font-medium">#{apt.id}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Service</p>
                                    <p className="font-medium">{apt.serviceName}</p>
                                    <p className="text-xs text-muted-foreground">{apt.serviceDuration}min · AED {Number(apt.totalPrice).toFixed(2)}</p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Payment Method</p>
                                    <p className="font-medium capitalize">{apt.paymentMethod ? apt.paymentMethod.replace("_", " ") : "—"}</p>
                                    {apt.saleId && <p className="text-xs text-muted-foreground">Sale #{apt.saleId}</p>}
                                  </div>
                                  <div>
                                    <p className="text-xs text-muted-foreground mb-0.5">Booked On</p>
                                    <p className="font-medium">{format(new Date(apt.createdAt), "dd MMM yyyy")}</p>
                                    <p className="text-xs text-muted-foreground">{format(new Date(apt.createdAt), "HH:mm")}</p>
                                  </div>
                                  {apt.notes && (
                                    <div className="col-span-2 sm:col-span-4">
                                      <p className="text-xs text-muted-foreground mb-0.5">Notes</p>
                                      <p className="italic text-muted-foreground">{apt.notes}</p>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Showing {(page - 1) * rowsPerPage + 1}–{Math.min(page * rowsPerPage, sortedAppts.length)} of {sortedAppts.length}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(1)}>«</Button>
                <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>‹</Button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  return start + i;
                }).map(n => (
                  <Button key={n} variant={n === page ? "default" : "outline"} size="sm" className="w-8" onClick={() => setPage(n)}>
                    {n}
                  </Button>
                ))}
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>›</Button>
                <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => setPage(totalPages)}>»</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Appointment Dialog */}
      <Dialog open={apptDialog} onOpenChange={setApptDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">New Appointment</DialogTitle>
            <DialogDescription>Book a new appointment for a client.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={form.watch("clientId")} onValueChange={v => form.setValue("clientId", v)}>
                <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {clients?.clients?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={form.watch("staffId")} onValueChange={v => form.setValue("staffId", v)}>
                <SelectTrigger><SelectValue placeholder="Assign to staff..." /></SelectTrigger>
                <SelectContent>
                  {allStaff?.filter(s => s.role !== "admin").map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name} — {s.specialization || s.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={form.watch("serviceId")} onValueChange={v => form.setValue("serviceId", v)}>
                <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                <SelectContent className="max-h-64">
                  {allServices?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>{s.name} — AED {s.price} ({s.duration}m)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="appt-date">Date *</Label>
                <Input id="appt-date" type="date" {...form.register("date", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="appt-time">Start Time *</Label>
                <Input id="appt-time" type="time" step="900" {...form.register("startTime", { required: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="appt-notes">Notes</Label>
              <Input id="appt-notes" placeholder="Any special requests..." {...form.register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApptDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createAppointment.isPending || !form.watch("clientId") || !form.watch("staffId")}>
                {createAppointment.isPending ? "Booking..." : "Book Appointment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
