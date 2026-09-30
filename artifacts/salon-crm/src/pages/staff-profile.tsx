import { useRoute, Link } from "wouter";
import { 
  useGetStaff, getGetStaffQueryKey,
  useFetchStaffPerformance, getFetchStaffPerformanceQueryKey,
  useGetStaffSchedule, getGetStaffScheduleQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, Mail, Phone, Edit2, Scissors, Calendar as CalendarIcon, BarChart2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

export default function StaffProfile() {
  const [, params] = useRoute("/staff/:id");
  const staffId = params?.id ? parseInt(params.id) : 0;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [scheduleDialog, setScheduleDialog] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<{ dayOfWeek: number; isWorking: boolean; startTime: string; endTime: string }[]>([]);

  const { data: staff, isLoading: isLoadingStaff } = useGetStaff(staffId, {
    query: { queryKey: getGetStaffQueryKey(staffId), enabled: !!staffId }
  });

  const { data: perf, isLoading: isLoadingPerf } = useFetchStaffPerformance(staffId, {
    query: { queryKey: getFetchStaffPerformanceQueryKey(staffId), enabled: !!staffId }
  });

  const { data: schedule, isLoading: isLoadingSchedule } = useGetStaffSchedule(staffId, {
    query: { queryKey: getGetStaffScheduleQueryKey(staffId), enabled: !!staffId }
  });

  const openScheduleEdit = () => {
    const existing = schedule ?? [];
    const form = DAYS.map((_, i) => {
      const found = existing.find((s: any) => s.dayOfWeek === i);
      return found
        ? { dayOfWeek: i, isWorking: found.isWorking, startTime: found.startTime ?? "09:00", endTime: found.endTime ?? "18:00" }
        : { dayOfWeek: i, isWorking: i >= 1 && i <= 5, startTime: "09:00", endTime: "18:00" };
    });
    setScheduleForm(form);
    setScheduleDialog(true);
  };

  const saveSchedule = async () => {
    const r = await fetch(`${API_BASE_URL}/api/staff/${staffId}/schedule`, { credentials: "include",
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hours: scheduleForm }),
    });
    if (r.ok) {
      toast({ title: "Attendance schedule saved" });
      qc.invalidateQueries({ queryKey: getGetStaffScheduleQueryKey(staffId) });
      setScheduleDialog(false);
    } else {
      toast({ title: "Failed to save", variant: "destructive" });
    }
  };

  if (isLoadingStaff) {
    return <div className="p-8"><Skeleton className="h-64 w-full" /></div>;
  }

  if (!staff) {
    return <div className="text-center py-12">Staff member not found.</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/staff">
            <Button variant="outline" size="icon"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <div>
            <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">{staff.name}</h1>
            <p className="text-muted-foreground mt-1 capitalize">{staff.role.replace("_", " ")}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/staff/${staffId}/financials`}>
            <Button variant="outline" className="gap-2">
              <BarChart2 className="w-4 h-4" />
              Financial Details
            </Button>
          </Link>
          <Button variant="outline" className="gap-2">
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-border overflow-hidden">
            <div className="h-24 w-full" style={{ backgroundColor: staff.color || "hsl(var(--primary))", opacity: 0.2 }}></div>
            <CardContent className="p-6 pt-0 relative -mt-12 text-center">
              <div
                className="w-24 h-24 rounded-full bg-card border-4 border-card flex items-center justify-center text-4xl font-serif font-bold shadow-sm mx-auto mb-4"
                style={{ color: staff.color || "hsl(var(--primary))" }}
              >
                {staff.name.charAt(0)}
              </div>
              <div className="flex justify-center gap-2 mb-6 flex-wrap">
                {!staff.isActive && <Badge variant="outline">Inactive</Badge>}
                {staff.specialization?.split(",").map((spec: string) => (
                  <Badge key={spec} variant="secondary" className="bg-muted font-normal">{spec.trim()}</Badge>
                ))}
              </div>
              <div className="space-y-4 text-sm text-left">
                {staff.email && (
                  <div className="flex items-center text-muted-foreground border-b border-border pb-3">
                    <Mail className="w-4 h-4 mr-3 shrink-0" />
                    <span className="truncate">{staff.email}</span>
                  </div>
                )}
                {staff.phone && (
                  <div className="flex items-center text-muted-foreground border-b border-border pb-3">
                    <Phone className="w-4 h-4 mr-3 shrink-0" />
                    <span>{staff.phone}</span>
                  </div>
                )}
                {staff.commissionRate != null && (
                  <div className="flex items-center justify-between text-muted-foreground border-b border-border pb-3">
                    <span>Commission Rate</span>
                    <span className="font-medium text-foreground">{staff.commissionRate}%</span>
                  </div>
                )}
                {staff.targetMonthly != null && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Monthly Target</span>
                    <span className="font-medium text-foreground">AED {Number(staff.targetMonthly).toLocaleString()}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="performance" className="w-full">
            <Card className="shadow-sm border-border">
              <CardHeader className="border-b border-border pb-0 px-6 pt-6">
                <TabsList className="bg-transparent h-10 p-0 space-x-6">
                  <TabsTrigger value="performance" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3">
                    Performance
                  </TabsTrigger>
                  <TabsTrigger value="attendance" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3">
                    Attendance
                  </TabsTrigger>
                </TabsList>
              </CardHeader>

              <CardContent className="p-6">
                {/* PERFORMANCE TAB */}
                <TabsContent value="performance" className="m-0 space-y-6">
                  {isLoadingPerf ? (
                    <div className="space-y-4">
                      <Skeleton className="h-32 w-full" />
                      <Skeleton className="h-48 w-full" />
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                          <p className="text-xl font-bold">AED {perf?.totalRevenue?.toFixed(2) || "0.00"}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <p className="text-xs text-muted-foreground mb-1">Commission</p>
                          <p className="text-xl font-bold text-primary">AED {perf?.commissionEarned?.toFixed(2) || "0.00"}</p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <p className="text-xs text-muted-foreground mb-1">Appointments</p>
                          <p className="text-xl font-bold">{perf?.completedAppointments || 0} <span className="text-xs font-normal text-muted-foreground">/ {perf?.totalAppointments || 0}</span></p>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/30 border border-border">
                          <p className="text-xs text-muted-foreground mb-1">Target</p>
                          <p className="text-xl font-bold">{perf?.targetProgress || 0}%</p>
                        </div>
                      </div>

                      {perf?.targetProgress !== undefined && staff.targetMonthly != null && staff.targetMonthly > 0 && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Monthly Target Progress</span>
                            <span className="font-medium">{perf.targetProgress}% of AED {staff.targetMonthly}</span>
                          </div>
                          <Progress value={Math.min(perf.targetProgress, 100)} className="h-2" />
                        </div>
                      )}

                      <div>
                        <h3 className="text-lg font-serif font-medium mb-4 mt-8 flex items-center text-foreground">
                          <Scissors className="w-5 h-5 mr-2 text-primary" />
                          Top Services Performed
                        </h3>
                        {perf?.topServices && perf.topServices.length > 0 ? (
                          <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                            {perf.topServices.map((ts: any, i: number) => (
                              <div key={ts.serviceId} className="p-3 bg-card flex justify-between items-center text-sm">
                                <div className="flex items-center">
                                  <span className="w-6 text-muted-foreground font-mono text-xs">{i + 1}.</span>
                                  <span className="font-medium">{ts.serviceName}</span>
                                </div>
                                <div className="text-muted-foreground">
                                  {ts.count} times <span className="mx-2">•</span> AED {ts.revenue.toFixed(2)}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg text-center">
                            No service data available yet.
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </TabsContent>

                {/* ATTENDANCE TAB (which days staff works — for booking availability) */}
                <TabsContent value="attendance" className="m-0">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-serif font-medium flex items-center">
                        <CalendarIcon className="w-5 h-5 mr-2 text-primary" />
                        Weekly Attendance Schedule
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">Which days this staff member is available for bookings.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={openScheduleEdit}>Edit Schedule</Button>
                  </div>

                  {isLoadingSchedule ? (
                    <div className="space-y-2">
                      {[...Array(7)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                    </div>
                  ) : (
                    <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                      {schedule && schedule.length > 0 ? (
                        [...schedule].sort((a: any, b: any) => a.dayOfWeek - b.dayOfWeek).map((day: any) => (
                          <div key={day.id} className={`p-4 flex justify-between items-center text-sm ${!day.isWorking ? "bg-muted/30 opacity-60" : "bg-card"}`}>
                            <span className="font-medium w-28">{DAYS[day.dayOfWeek]}</span>
                            {day.isWorking ? (
                              <div className="flex items-center gap-3">
                                <Badge variant="secondary" className="bg-green-100 text-green-700 font-normal">Working</Badge>
                                <span className="text-muted-foreground text-xs">{day.startTime?.substring(0, 5)} – {day.endTime?.substring(0, 5)}</span>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground font-normal">Day Off</Badge>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="p-8 text-center text-muted-foreground">
                          Schedule not configured yet.
                          <Button variant="link" className="ml-2 p-0" onClick={openScheduleEdit}>Set it up</Button>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        </div>
      </div>

      {/* Edit Schedule Dialog */}
      <Dialog open={scheduleDialog} onOpenChange={setScheduleDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Attendance Schedule</DialogTitle>
            <DialogDescription>Toggle which days {staff.name} is available for bookings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {scheduleForm.map((day, i) => (
              <div key={i} className={`flex items-center justify-between p-3 border border-border rounded-lg ${!day.isWorking ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <Switch
                    checked={day.isWorking}
                    onCheckedChange={(v) => setScheduleForm((f) => f.map((d, j) => j === i ? { ...d, isWorking: v } : d))}
                  />
                  <Label className="font-medium">{DAYS[day.dayOfWeek]}</Label>
                </div>
                {day.isWorking && (
                  <div className="flex gap-2 items-center">
                    <input
                      type="time"
                      value={day.startTime}
                      onChange={(e) => setScheduleForm((f) => f.map((d, j) => j === i ? { ...d, startTime: e.target.value } : d))}
                      className="border border-border rounded px-2 py-1 text-sm bg-background"
                    />
                    <span className="text-muted-foreground text-sm">to</span>
                    <input
                      type="time"
                      value={day.endTime}
                      onChange={(e) => setScheduleForm((f) => f.map((d, j) => j === i ? { ...d, endTime: e.target.value } : d))}
                      className="border border-border rounded px-2 py-1 text-sm bg-background"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleDialog(false)}>Cancel</Button>
            <Button onClick={saveSchedule}>Save Schedule</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
