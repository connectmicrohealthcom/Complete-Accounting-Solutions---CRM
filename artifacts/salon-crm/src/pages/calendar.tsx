import { useState, useRef } from "react";
import { format, addDays, subDays, isSameDay } from "date-fns";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListAppointments, getListAppointmentsQueryKey,
  useCreateAppointment, useUpdateAppointmentStatus,
  useListStaff, getListStaffQueryKey,
  useListServices, getListServicesQueryKey,
  useListClients, getListClientsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, ChevronRight, Plus, Clock, User, Scissors
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { AppointmentStatusUpdateStatus } from "@workspace/api-client-react";

type ApptForm = {
  clientId: string;
  staffId: string;
  serviceId: string;
  date: string;
  startTime: string;
  notes: string;
};

// Hours from 8 AM to 9 PM
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);
const SLOT_HEIGHT = 64; // px per hour
const GRID_START_HOUR = 8;

const STATUS_COLORS: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  in_progress: "#8B5CF6",
  completed: "#10B981",
  cancelled: "#EF4444",
  no_show: "#9CA3AF",
};

function formatHour(h: number) {
  if (h === 12) return "12 PM";
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}

export default function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [apptDialog, setApptDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState<any>(null);
  const [prefillTime, setPrefillTime] = useState<string>("");
  const [prefillStaff, setPrefillStaff] = useState<string>("");
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const dateStr = format(currentDate, "yyyy-MM-dd");

  const { data: appointments, isLoading } = useListAppointments(
    { date: dateStr },
    { query: { queryKey: getListAppointmentsQueryKey({ date: dateStr }) } }
  );

  const { data: staffList } = useListStaff({});
  const { data: clients } = useListClients({ limit: 500 }, { query: { queryKey: getListClientsQueryKey({ limit: 500 }), enabled: apptDialog } });
  const { data: services } = useListServices({}, { query: { queryKey: getListServicesQueryKey({}), enabled: apptDialog } });

  const createAppointment = useCreateAppointment();
  const updateStatus = useUpdateAppointmentStatus();

  // Only show active, non-admin staff
  const activeStaff = staffList?.filter(s => s.isActive && s.role !== "admin") ?? [];

  const form = useForm<ApptForm>({
    defaultValues: { clientId: "", staffId: "", serviceId: "", date: dateStr, startTime: "10:00", notes: "" }
  });

  const openNew = (staffId = "", time = "") => {
    form.reset({
      clientId: "", staffId, serviceId: "", date: dateStr,
      startTime: time || "10:00", notes: ""
    });
    setPrefillTime(time);
    setPrefillStaff(staffId);
    setApptDialog(true);
  };

  const onSubmit = (data: ApptForm) => {
    const svc = services?.find(s => s.id.toString() === data.serviceId);
    const duration = svc?.duration || 60;
    const [h, m] = data.startTime.split(":").map(Number);
    const endDate = new Date(0, 0, 0, h, m + duration);
    const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

    createAppointment.mutate({
      data: {
        clientId: parseInt(data.clientId),
        staffId: parseInt(data.staffId),
        serviceId: parseInt(data.serviceId) || 0,
        date: data.date,
        startTime: data.startTime,
        notes: data.notes || undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setApptDialog(false);
      }
    });
  };

  const handleSlotClick = (staffId: number, hour: number, minutes: number) => {
    const h = String(hour).padStart(2, "0");
    const m = String(minutes).padStart(2, "0");
    openNew(staffId.toString(), `${h}:${m}`);
  };

  const handleStatusChange = (id: number, status: AppointmentStatusUpdateStatus) => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setDetailDialog(null);
      }
    });
  };

  // Group appointments by staff
  const apptByStaff: Record<number, typeof appointments> = {};
  appointments?.forEach(apt => {
    if (!apptByStaff[apt.staffId]) apptByStaff[apt.staffId] = [];
    apptByStaff[apt.staffId]!.push(apt);
  });

  const isToday = isSameDay(currentDate, new Date());

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] animate-in fade-in duration-500">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 mb-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-serif font-semibold tracking-tight">Calendar</h1>
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => subDays(d, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              className="h-7 px-3 text-sm font-medium min-w-[160px]"
              onClick={() => setCurrentDate(new Date())}
            >
              {isToday ? "Today" : format(currentDate, "EEE, MMM d, yyyy")}
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentDate(d => addDays(d, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          {!isToday && (
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="text-sm text-muted-foreground hidden sm:block">
            {appointments?.length ?? 0} appointments
          </div>
          <Button className="gap-2" onClick={() => openNew()}>
            <Plus className="w-4 h-4" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 bg-card border border-border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-0">
        {/* Staff Header Row */}
        <div className="flex border-b border-border bg-muted/30 flex-shrink-0" style={{ overflowX: "hidden" }}>
          {/* Time gutter */}
          <div className="w-16 flex-shrink-0 border-r border-border" />
          {/* Staff columns */}
          <div className="flex-1 flex overflow-x-auto">
            {activeStaff.length === 0 ? (
              <div className="flex-1 p-4 text-sm text-muted-foreground text-center">No staff found</div>
            ) : (
              activeStaff.map(staff => (
                <div
                  key={staff.id}
                  className="flex-1 min-w-[140px] border-r border-border last:border-r-0 p-3 flex items-center gap-2"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: staff.color || "#8C7355" }}
                  >
                    {staff.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{staff.name.split(" ")[0]}</div>
                    <div className="text-[11px] text-muted-foreground capitalize truncate">
                      {staff.role}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overflow-x-auto" ref={scrollRef}>
          <div className="flex" style={{ minHeight: `${HOURS.length * SLOT_HEIGHT}px` }}>
            {/* Time gutter */}
            <div className="w-16 flex-shrink-0 border-r border-border bg-muted/10 relative">
              {HOURS.map(hour => (
                <div
                  key={hour}
                  className="absolute w-full flex items-start justify-end pr-2 pt-1"
                  style={{ top: `${(hour - GRID_START_HOUR) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                >
                  <span className="text-[11px] text-muted-foreground font-medium">{formatHour(hour)}</span>
                </div>
              ))}
            </div>

            {/* Staff appointment columns */}
            <div className="flex-1 flex">
              {activeStaff.map(staff => {
                const staffAppts = apptByStaff[staff.id] ?? [];

                return (
                  <div
                    key={staff.id}
                    className="flex-1 min-w-[140px] border-r border-border last:border-r-0 relative"
                    style={{ height: `${HOURS.length * SLOT_HEIGHT}px` }}
                  >
                    {/* Horizontal hour lines */}
                    {HOURS.map(hour => (
                      <div
                        key={hour}
                        className="absolute w-full border-b border-border/40"
                        style={{ top: `${(hour - GRID_START_HOUR) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}
                      />
                    ))}

                    {/* Half-hour dotted lines */}
                    {HOURS.map(hour => (
                      <div
                        key={`half-${hour}`}
                        className="absolute w-full border-b border-dashed border-border/20"
                        style={{ top: `${(hour - GRID_START_HOUR) * SLOT_HEIGHT + SLOT_HEIGHT / 2}px` }}
                      />
                    ))}

                    {/* Clickable slots */}
                    {HOURS.map(hour => (
                      <div key={`slot-${hour}`} className="flex flex-col absolute w-full" style={{ top: `${(hour - GRID_START_HOUR) * SLOT_HEIGHT}px`, height: `${SLOT_HEIGHT}px` }}>
                        <div
                          className="flex-1 cursor-pointer hover:bg-primary/5 transition-colors group"
                          onClick={() => handleSlotClick(staff.id, hour, 0)}
                        >
                          <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full">
                            <Plus className="w-3 h-3 text-primary/50" />
                          </div>
                        </div>
                        <div
                          className="flex-1 cursor-pointer hover:bg-primary/5 transition-colors group"
                          onClick={() => handleSlotClick(staff.id, hour, 30)}
                        >
                          <div className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-full">
                            <Plus className="w-3 h-3 text-primary/50" />
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Appointments */}
                    {staffAppts.map(apt => {
                      const [sh, sm] = apt.startTime.split(":").map(Number);
                      const [eh, em] = apt.endTime.split(":").map(Number);
                      const topPx = (sh - GRID_START_HOUR) * SLOT_HEIGHT + (sm / 60) * SLOT_HEIGHT;
                      const durationMins = (eh * 60 + em) - (sh * 60 + sm);
                      const heightPx = Math.max((durationMins / 60) * SLOT_HEIGHT, 28);
                      const statusColor = STATUS_COLORS[apt.status] || "#8C7355";

                      if (topPx < 0) return null;

                      return (
                        <div
                          key={apt.id}
                          className="absolute left-1 right-1 rounded-md p-2 text-xs overflow-hidden cursor-pointer hover:opacity-90 transition-all shadow-sm z-10"
                          style={{
                            top: `${topPx}px`,
                            height: `${heightPx}px`,
                            backgroundColor: `${statusColor}18`,
                            borderLeft: `3px solid ${statusColor}`,
                            borderTop: `1px solid ${statusColor}40`,
                            borderRight: `1px solid ${statusColor}40`,
                            borderBottom: `1px solid ${statusColor}40`,
                          }}
                          onClick={() => setDetailDialog(apt)}
                        >
                          <div className="font-semibold truncate leading-tight" style={{ color: statusColor }}>
                            {apt.clientName}
                          </div>
                          {heightPx >= 40 && (
                            <div className="text-muted-foreground truncate mt-0.5 text-[11px]">
                              {apt.serviceName || "—"}
                            </div>
                          )}
                          {heightPx >= 52 && (
                            <div className="text-muted-foreground text-[10px] mt-0.5">
                              {apt.startTime.substring(0, 5)} – {apt.endTime.substring(0, 5)}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Current time indicator */}
                    {isToday && (() => {
                      const now = new Date();
                      const nowPx = (now.getHours() - GRID_START_HOUR) * SLOT_HEIGHT + (now.getMinutes() / 60) * SLOT_HEIGHT;
                      if (nowPx < 0 || nowPx > HOURS.length * SLOT_HEIGHT) return null;
                      return (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none"
                          style={{ top: `${nowPx}px` }}
                        >
                          <div className="flex items-center">
                            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                            <div className="flex-1 h-px bg-red-400" />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })}

              {activeStaff.length === 0 && !isLoading && (
                <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
                  <div className="text-center">
                    <Scissors className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p>No active staff. Add staff members to get started.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Appointment Detail Dialog */}
      <Dialog open={!!detailDialog} onOpenChange={() => setDetailDialog(null)}>
        <DialogContent className="sm:max-w-sm">
          {detailDialog && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif">{detailDialog.clientName}</DialogTitle>
                <DialogDescription>
                  {format(new Date(detailDialog.date), "EEEE, MMMM d, yyyy")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="w-4 h-4" />
                  {detailDialog.startTime?.substring(0, 5)} – {detailDialog.endTime?.substring(0, 5)}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Scissors className="w-4 h-4" />
                  {detailDialog.serviceName || "No service"}
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" />
                  {detailDialog.staffName}
                </div>
                {detailDialog.totalPrice && (
                  <div className="font-medium text-foreground pt-1 border-t border-border">
                    AED {Number(detailDialog.totalPrice).toFixed(2)}
                  </div>
                )}
                {detailDialog.notes && (
                  <div className="bg-muted/50 rounded-md p-2 italic text-muted-foreground text-xs">
                    {detailDialog.notes}
                  </div>
                )}
                <div className="pt-2 border-t border-border">
                  <Label className="text-xs text-muted-foreground mb-2 block">Update Status</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["confirmed", "in_progress", "completed", "cancelled", "no_show"] as AppointmentStatusUpdateStatus[]).map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(detailDialog.id, s)}
                        className="text-xs px-2.5 py-1 rounded-full border transition-all hover:opacity-80"
                        style={{
                          backgroundColor: detailDialog.status === s ? `${STATUS_COLORS[s]}20` : "transparent",
                          borderColor: STATUS_COLORS[s] || "#ccc",
                          color: STATUS_COLORS[s] || "#666",
                          fontWeight: detailDialog.status === s ? 600 : 400
                        }}
                      >
                        {s.replace("_", " ")}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailDialog(null)}>Close</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Appointment Dialog */}
      <Dialog open={apptDialog} onOpenChange={setApptDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">New Appointment</DialogTitle>
            <DialogDescription>Book an appointment for {format(currentDate, "EEEE, MMMM d")}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Client *</Label>
              <Select value={form.watch("clientId")} onValueChange={(v) => form.setValue("clientId", v)}>
                <SelectTrigger><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {clients?.clients?.map(c => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name} {c.phone ? `· ${c.phone}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={form.watch("staffId")} onValueChange={(v) => form.setValue("staffId", v)}>
                <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                <SelectContent>
                  {activeStaff.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color || "#8C7355" }} />
                        {s.name} — {s.specialization || s.role}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={form.watch("serviceId")} onValueChange={(v) => form.setValue("serviceId", v)}>
                <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {services?.map(s => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name} — AED {s.price} ({s.duration}m)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input type="date" {...form.register("date", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input type="time" step="900" {...form.register("startTime", { required: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Any special requests..." {...form.register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApptDialog(false)}>Cancel</Button>
              <Button
                type="submit"
                disabled={createAppointment.isPending || !form.watch("clientId") || !form.watch("staffId")}
              >
                {createAppointment.isPending ? "Booking..." : "Book Appointment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
