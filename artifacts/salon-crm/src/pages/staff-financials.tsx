import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useGetStaff, getGetStaffQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, Plus, Download, DollarSign, Clock, TrendingUp, CreditCard } from "lucide-react";
import { format, startOfMonth, endOfMonth, subDays } from "date-fns";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const api = (path: string, opts?: RequestInit) =>
  fetch(`${API_BASE_URL}/api${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts });

function useStaffFinancials(staffId: number, from: string, to: string) {
  const wageSettings = useQuery({
    queryKey: ["wage-settings", staffId],
    queryFn: () => api(`/staff/${staffId}/wage-settings`).then((r) => r.json()),
    enabled: !!staffId,
  });
  const wagePayments = useQuery({
    queryKey: ["wage-payments", staffId],
    queryFn: () => api(`/staff/${staffId}/wage-payments`).then((r) => r.json()),
    enabled: !!staffId,
  });
  const commissionSlabs = useQuery({
    queryKey: ["commission-slabs", staffId],
    queryFn: () => api(`/staff/${staffId}/commission-slabs`).then((r) => r.json()),
    enabled: !!staffId,
  });
  const attendanceLogs = useQuery({
    queryKey: ["attendance-logs", staffId, from, to],
    queryFn: () => api(`/staff/${staffId}/attendance-logs?from=${from}&to=${to}`).then((r) => r.json()),
    enabled: !!staffId,
  });
  const financialSummary = useQuery({
    queryKey: ["financial-summary", staffId, from, to],
    queryFn: () => api(`/staff/${staffId}/financial-summary?from=${from}&to=${to}`).then((r) => r.json()),
    enabled: !!staffId,
  });
  return { wageSettings, wagePayments, commissionSlabs, attendanceLogs, financialSummary };
}

export default function StaffFinancials() {
  const [, params] = useRoute("/staff/:id/financials");
  const staffId = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [from, setFrom] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));

  const [wageDialog, setWageDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [slabDialog, setSlabDialog] = useState(false);
  const [attendanceDialog, setAttendanceDialog] = useState(false);

  const [wageForm, setWageForm] = useState({ wageType: "monthly", baseAmount: "" });
  const [payForm, setPayForm] = useState({ amount: "", periodFrom: from, periodTo: to, paymentDate: format(new Date(), "yyyy-MM-dd"), paymentMethod: "cash", notes: "" });
  const [slabForm, setSlabForm] = useState({ minAmount: "", maxAmount: "", rate: "" });
  const [attendForm, setAttendForm] = useState({ date: format(new Date(), "yyyy-MM-dd"), clockIn: "", clockOut: "", notes: "" });

  const { data: staff } = useGetStaff(staffId, { query: { queryKey: getGetStaffQueryKey(staffId), enabled: !!staffId } });
  const { wageSettings, wagePayments, commissionSlabs, attendanceLogs, financialSummary } = useStaffFinancials(staffId, from, to);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wage-settings", staffId] });
    qc.invalidateQueries({ queryKey: ["wage-payments", staffId] });
    qc.invalidateQueries({ queryKey: ["commission-slabs", staffId] });
    qc.invalidateQueries({ queryKey: ["attendance-logs", staffId] });
    qc.invalidateQueries({ queryKey: ["financial-summary", staffId] });
  };

  const saveWage = async () => {
    const r = await api(`/staff/${staffId}/wage-settings`, {
      method: "PUT",
      body: JSON.stringify({ wageType: wageForm.wageType, baseAmount: parseFloat(wageForm.baseAmount) }),
    });
    if (r.ok) { toast({ title: "Wage settings saved" }); setWageDialog(false); invalidate(); }
    else toast({ title: "Error saving wage settings", variant: "destructive" });
  };

  const savePayment = async () => {
    const r = await api(`/staff/${staffId}/wage-payments`, {
      method: "POST",
      body: JSON.stringify({ ...payForm, amount: parseFloat(payForm.amount) }),
    });
    if (r.ok) { toast({ title: "Payment recorded" }); setPaymentDialog(false); invalidate(); }
    else toast({ title: "Error recording payment", variant: "destructive" });
  };

  const saveSlab = async () => {
    const r = await api(`/staff/${staffId}/commission-slabs`, {
      method: "POST",
      body: JSON.stringify({
        minAmount: parseFloat(slabForm.minAmount),
        maxAmount: slabForm.maxAmount ? parseFloat(slabForm.maxAmount) : null,
        rate: parseFloat(slabForm.rate),
      }),
    });
    if (r.ok) { toast({ title: "Commission slab added" }); setSlabDialog(false); invalidate(); }
    else toast({ title: "Error adding slab", variant: "destructive" });
  };

  const deleteSlab = async (id: number) => {
    await api(`/staff/${staffId}/commission-slabs/${id}`, { method: "DELETE" });
    invalidate();
  };

  const saveAttendance = async () => {
    let totalHours: number | null = null;
    if (attendForm.clockIn && attendForm.clockOut) {
      const [ih, im] = attendForm.clockIn.split(":").map(Number);
      const [oh, om] = attendForm.clockOut.split(":").map(Number);
      totalHours = (oh * 60 + om - (ih * 60 + im)) / 60;
    }
    const r = await api(`/staff/${staffId}/attendance-logs`, {
      method: "POST",
      body: JSON.stringify({ ...attendForm, totalHours }),
    });
    if (r.ok) { toast({ title: "Attendance logged" }); setAttendanceDialog(false); invalidate(); }
    else toast({ title: "Error logging attendance", variant: "destructive" });
  };

  const summary = financialSummary.data;
  const logs: any[] = attendanceLogs.data ?? [];
  const payments: any[] = wagePayments.data ?? [];
  const slabs: any[] = commissionSlabs.data ?? [];
  const ws = wageSettings.data;

  const totalHoursLogged = logs.reduce((s, l) => s + (Number(l.totalHours) || 0), 0);

  const exportAttendanceCSV = () => {
    const rows = [["Date", "Clock In", "Clock Out", "Total Hours", "Notes"]];
    for (const l of logs) rows.push([l.date, l.clockIn ?? "", l.clockOut ?? "", l.totalHours ?? "", l.notes ?? ""]);
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${staffId}-${from}-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!staff) return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href={`/staff/${staffId}`}>
          <Button variant="outline" size="icon"><ChevronLeft className="w-4 h-4" /></Button>
        </Link>
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight">{staff.name} — Financial Details</h1>
          <p className="text-muted-foreground mt-1">Wages, commission, tips, and attendance logs.</p>
        </div>
      </div>

      {/* Date Range */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1">
            <Label className="text-xs">From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40 h-8 text-sm" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40 h-8 text-sm" />
          </div>
          <Button variant="outline" size="sm" onClick={() => { setFrom(format(startOfMonth(new Date()), "yyyy-MM-dd")); setTo(format(new Date(), "yyyy-MM-dd")); }}>This Month</Button>
          <Button variant="outline" size="sm" onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 1); setFrom(format(startOfMonth(d), "yyyy-MM-dd")); setTo(format(endOfMonth(d), "yyyy-MM-dd")); }}>Last Month</Button>
        </CardContent>
      </Card>

      {/* Financial Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {financialSummary.isLoading ? [...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />) : (
          <>
            <Card className="shadow-sm border-border"><CardContent className="p-5"><p className="text-xs text-muted-foreground mb-1">Total Sales</p><p className="text-2xl font-bold">AED {(summary?.totalSales ?? 0).toFixed(2)}</p></CardContent></Card>
            <Card className="shadow-sm border-border"><CardContent className="p-5"><p className="text-xs text-muted-foreground mb-1">Commission Earned</p><p className="text-2xl font-bold text-primary">AED {(summary?.commissionEarned ?? 0).toFixed(2)}</p></CardContent></Card>
            <Card className="shadow-sm border-border"><CardContent className="p-5"><p className="text-xs text-muted-foreground mb-1">Tips Received</p><p className="text-2xl font-bold text-green-600">AED {(summary?.tipsTotal ?? 0).toFixed(2)}</p></CardContent></Card>
            <Card className="shadow-sm border-border"><CardContent className="p-5"><p className="text-xs text-muted-foreground mb-1">Outstanding Wages</p><p className="text-2xl font-bold text-orange-500">AED {(summary?.outstandingWages ?? 0).toFixed(2)}</p></CardContent></Card>
          </>
        )}
      </div>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="attendance">Working Hours Log</TabsTrigger>
          <TabsTrigger value="wages">Wages</TabsTrigger>
          <TabsTrigger value="commission">Commission Slabs</TabsTrigger>
          <TabsTrigger value="summary">Full Summary</TabsTrigger>
        </TabsList>

        {/* ATTENDANCE / WORKING HOURS LOG */}
        <TabsContent value="attendance">
          <Card className="shadow-sm border-border">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg font-serif flex items-center gap-2"><Clock className="w-5 h-5 text-primary" />Working Hours Log</CardTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="gap-1" onClick={exportAttendanceCSV}><Download className="w-3.5 h-3.5" />Export</Button>
                <Button size="sm" className="gap-1" onClick={() => setAttendanceDialog(true)}><Plus className="w-3.5 h-3.5" />Log Hours</Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-muted/30 rounded-lg flex gap-6">
                <div><p className="text-xs text-muted-foreground">Days Logged</p><p className="text-xl font-bold">{logs.length}</p></div>
                <div><p className="text-xs text-muted-foreground">Total Hours</p><p className="text-xl font-bold">{totalHoursLogged.toFixed(1)} hrs</p></div>
                {ws?.wageType === "hourly" && <div><p className="text-xs text-muted-foreground">Calculated Wages</p><p className="text-xl font-bold text-primary">AED {(totalHoursLogged * Number(ws?.baseAmount || 0)).toFixed(2)}</p></div>}
              </div>
              <div className="relative overflow-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="h-10 px-2 text-left font-medium text-muted-foreground">Date</th><th className="h-10 px-2 text-left font-medium text-muted-foreground">Clock In</th><th className="h-10 px-2 text-left font-medium text-muted-foreground">Clock Out</th><th className="h-10 px-2 text-right font-medium text-muted-foreground">Hours</th><th className="h-10 px-2 text-left font-medium text-muted-foreground">Notes</th></tr></thead>
                  <tbody>
                    {attendanceLogs.isLoading ? [...Array(5)].map((_, i) => <tr key={i} className="border-b"><td colSpan={5} className="p-2"><Skeleton className="h-4 w-full" /></td></tr>) :
                    logs.length === 0 ? <tr><td colSpan={5} className="h-24 text-center text-muted-foreground">No attendance logs for this period.</td></tr> :
                    logs.map((l: any) => (
                      <tr key={l.id} className="border-b hover:bg-muted/40">
                        <td className="p-2 font-medium">{l.date}</td>
                        <td className="p-2 text-muted-foreground">{l.clockIn ?? "—"}</td>
                        <td className="p-2 text-muted-foreground">{l.clockOut ?? "—"}</td>
                        <td className="p-2 text-right font-medium">{l.totalHours != null ? `${Number(l.totalHours).toFixed(1)} hrs` : "—"}</td>
                        <td className="p-2 text-muted-foreground">{l.notes ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WAGES */}
        <TabsContent value="wages">
          <div className="space-y-4">
            <Card className="shadow-sm border-border">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg font-serif flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" />Wage Settings</CardTitle>
                <Button size="sm" variant="outline" onClick={() => { setWageForm({ wageType: ws?.wageType ?? "monthly", baseAmount: ws?.baseAmount?.toString() ?? "" }); setWageDialog(true); }}>Edit</Button>
              </CardHeader>
              <CardContent>
                {wageSettings.isLoading ? <Skeleton className="h-12 w-full" /> : ws ? (
                  <div className="flex gap-8">
                    <div><p className="text-xs text-muted-foreground">Wage Type</p><p className="font-semibold capitalize">{ws.wageType}</p></div>
                    <div><p className="text-xs text-muted-foreground">Base Amount</p><p className="font-semibold">AED {Number(ws.baseAmount).toFixed(2)} {ws.wageType === "hourly" ? "/ hr" : "/ month"}</p></div>
                  </div>
                ) : <p className="text-sm text-muted-foreground">No wage settings configured yet.</p>}
              </CardContent>
            </Card>

            <Card className="shadow-sm border-border">
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-lg font-serif flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" />Wage Payments</CardTitle>
                <Button size="sm" className="gap-1" onClick={() => setPaymentDialog(true)}><Plus className="w-3.5 h-3.5" />Record Payment</Button>
              </CardHeader>
              <CardContent>
                <div className="relative overflow-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b"><th className="h-10 px-2 text-left font-medium text-muted-foreground">Payment Date</th><th className="h-10 px-2 text-left font-medium text-muted-foreground">Period</th><th className="h-10 px-2 text-left font-medium text-muted-foreground">Method</th><th className="h-10 px-2 text-left font-medium text-muted-foreground">Notes</th><th className="h-10 px-2 text-right font-medium text-muted-foreground">Amount</th></tr></thead>
                    <tbody>
                      {wagePayments.isLoading ? [...Array(3)].map((_, i) => <tr key={i} className="border-b"><td colSpan={5} className="p-2"><Skeleton className="h-4 w-full" /></td></tr>) :
                      payments.length === 0 ? <tr><td colSpan={5} className="h-24 text-center text-muted-foreground">No wage payments recorded.</td></tr> :
                      payments.map((p: any) => (
                        <tr key={p.id} className="border-b hover:bg-muted/40">
                          <td className="p-2 font-medium">{p.paymentDate}</td>
                          <td className="p-2 text-muted-foreground">{p.periodFrom} → {p.periodTo}</td>
                          <td className="p-2 capitalize">{p.paymentMethod.replace("_", " ")}</td>
                          <td className="p-2 text-muted-foreground">{p.notes ?? "—"}</td>
                          <td className="p-2 text-right font-bold">AED {Number(p.amount).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* COMMISSION SLABS */}
        <TabsContent value="commission">
          <Card className="shadow-sm border-border">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-lg font-serif flex items-center gap-2"><TrendingUp className="w-5 h-5 text-primary" />Commission Slabs</CardTitle>
              <Button size="sm" className="gap-1" onClick={() => { setSlabForm({ minAmount: "", maxAmount: "", rate: "" }); setSlabDialog(true); }}><Plus className="w-3.5 h-3.5" />Add Slab</Button>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">Define tiered commission rates. The system automatically applies the correct rate based on monthly sales volume.</p>
              {commissionSlabs.isLoading ? <Skeleton className="h-40 w-full" /> :
              slabs.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p>No commission slabs configured. Add slabs to enable tiered commission.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {slabs.sort((a: any, b: any) => Number(a.minAmount) - Number(b.minAmount)).map((slab: any, i: number) => (
                    <div key={slab.id} className="flex items-center justify-between p-4 border border-border rounded-lg bg-card">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                        <div>
                          <p className="font-medium">
                            AED {Number(slab.minAmount).toFixed(0)} — {slab.maxAmount != null ? `AED ${Number(slab.maxAmount).toFixed(0)}` : "Unlimited"}
                          </p>
                          <p className="text-xs text-muted-foreground">Sales in this range</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <Badge className="text-base px-4 py-1">{Number(slab.rate).toFixed(1)}%</Badge>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteSlab(slab.id)}>Delete</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!commissionSlabs.isLoading && summary?.commissionSlab && (
                <div className="mt-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium">Current Period Commission (Slab-Based)</p>
                  <p className="text-muted-foreground text-sm">Sales: AED {(summary.totalSales ?? 0).toFixed(2)} → Slab: {summary.commissionSlab.rate}% → <span className="font-bold text-primary">AED {(summary.commissionEarned ?? 0).toFixed(2)}</span></p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FULL SUMMARY */}
        <TabsContent value="summary">
          <Card className="shadow-sm border-border">
            <CardHeader>
              <CardTitle className="text-lg font-serif">Complete Financial Summary</CardTitle>
            </CardHeader>
            <CardContent>
              {financialSummary.isLoading ? <Skeleton className="h-48 w-full" /> : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { label: "Total Sales Revenue", value: `AED ${(summary?.totalSales ?? 0).toFixed(2)}`, color: "" },
                      { label: "Commission Earned", value: `AED ${(summary?.commissionEarned ?? 0).toFixed(2)}`, color: "text-primary" },
                      { label: "Tips Received", value: `AED ${(summary?.tipsTotal ?? 0).toFixed(2)}`, color: "text-green-600" },
                      { label: "Total Wages Due", value: `AED ${(summary?.wagesDue ?? 0).toFixed(2)}`, color: "" },
                      { label: "Total Wages Paid", value: `AED ${(summary?.wagesPaid ?? 0).toFixed(2)}`, color: "text-blue-600" },
                      { label: "Outstanding Balance", value: `AED ${(summary?.outstandingWages ?? 0).toFixed(2)}`, color: "text-orange-500" },
                    ].map((item) => (
                      <div key={item.label} className="p-4 border border-border rounded-lg flex justify-between items-center">
                        <p className="text-sm text-muted-foreground">{item.label}</p>
                        <p className={`font-bold text-lg ${item.color}`}>{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 border border-border rounded-lg mt-2">
                    <p className="text-sm text-muted-foreground mb-1">Hours Worked ({from} to {to})</p>
                    <p className="font-bold text-xl">{(summary?.totalHours ?? 0).toFixed(1)} hrs across {summary?.daysWorked ?? 0} days</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Wage Settings Dialog */}
      <Dialog open={wageDialog} onOpenChange={setWageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Wage Settings</DialogTitle><DialogDescription>Set base wage for {staff.name}.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Wage Type</Label>
              <Select value={wageForm.wageType} onValueChange={(v) => setWageForm((f) => ({ ...f, wageType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="hourly">Hourly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Base Amount (AED)</Label>
              <Input type="number" min="0" step="0.01" value={wageForm.baseAmount} onChange={(e) => setWageForm((f) => ({ ...f, baseAmount: e.target.value }))} placeholder="e.g. 3000" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWageDialog(false)}>Cancel</Button>
            <Button onClick={saveWage}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Record Wage Payment</DialogTitle><DialogDescription>Log a wage payment for {staff.name}.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Period From</Label><Input type="date" value={payForm.periodFrom} onChange={(e) => setPayForm((f) => ({ ...f, periodFrom: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Period To</Label><Input type="date" value={payForm.periodTo} onChange={(e) => setPayForm((f) => ({ ...f, periodTo: e.target.value }))} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Payment Date</Label><Input type="date" value={payForm.paymentDate} onChange={(e) => setPayForm((f) => ({ ...f, paymentDate: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Amount (AED)</Label><Input type="number" min="0" step="0.01" value={payForm.amount} onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))} placeholder="0.00" /></div>
            </div>
            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={payForm.paymentMethod} onValueChange={(v) => setPayForm((f) => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Input value={payForm.notes} onChange={(e) => setPayForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional notes..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>Cancel</Button>
            <Button onClick={savePayment} disabled={!payForm.amount}>Record Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Commission Slab Dialog */}
      <Dialog open={slabDialog} onOpenChange={setSlabDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Add Commission Slab</DialogTitle><DialogDescription>Define a sales range and commission rate.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Min Sales (AED)</Label><Input type="number" min="0" step="100" value={slabForm.minAmount} onChange={(e) => setSlabForm((f) => ({ ...f, minAmount: e.target.value }))} placeholder="0" /></div>
              <div className="space-y-2"><Label>Max Sales (AED, blank = unlimited)</Label><Input type="number" min="0" step="100" value={slabForm.maxAmount} onChange={(e) => setSlabForm((f) => ({ ...f, maxAmount: e.target.value }))} placeholder="Unlimited" /></div>
            </div>
            <div className="space-y-2"><Label>Commission Rate (%)</Label><Input type="number" min="0" max="100" step="0.5" value={slabForm.rate} onChange={(e) => setSlabForm((f) => ({ ...f, rate: e.target.value }))} placeholder="e.g. 8" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSlabDialog(false)}>Cancel</Button>
            <Button onClick={saveSlab} disabled={!slabForm.minAmount || !slabForm.rate}>Add Slab</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Attendance Log Dialog */}
      <Dialog open={attendanceDialog} onOpenChange={setAttendanceDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-serif">Log Working Hours</DialogTitle><DialogDescription>Record clock-in/clock-out for {staff.name}.</DialogDescription></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><Label>Date</Label><Input type="date" value={attendForm.date} onChange={(e) => setAttendForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Clock In</Label><Input type="time" value={attendForm.clockIn} onChange={(e) => setAttendForm((f) => ({ ...f, clockIn: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Clock Out</Label><Input type="time" value={attendForm.clockOut} onChange={(e) => setAttendForm((f) => ({ ...f, clockOut: e.target.value }))} /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Input value={attendForm.notes} onChange={(e) => setAttendForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Optional..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAttendanceDialog(false)}>Cancel</Button>
            <Button onClick={saveAttendance}>Log Hours</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
