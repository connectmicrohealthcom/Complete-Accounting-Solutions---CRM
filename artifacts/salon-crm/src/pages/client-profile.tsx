import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetClient, getGetClientQueryKey,
  useGetClientHistory, getGetClientHistoryQueryKey,
  useGetClientLoyalty, getGetClientLoyaltyQueryKey,
  useUpdateClient,
  useCreateAppointment, getListAppointmentsQueryKey,
  useListStaff, getListStaffQueryKey,
  useListServices, getListServicesQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  ChevronLeft, Mail, Phone, Calendar, Edit2, History, Award, CreditCard, Plus, User
} from "lucide-react";
import { format } from "date-fns";

type EditForm = {
  name: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  gender: string;
  notes: string;
};

type ApptForm = {
  staffId: string;
  serviceId: string;
  date: string;
  startTime: string;
  notes: string;
};

const STATUS_COLORS: Record<string, string> = {
  pending: "text-yellow-700 bg-yellow-50 border-yellow-200",
  confirmed: "text-blue-700 bg-blue-50 border-blue-200",
  in_progress: "text-purple-700 bg-purple-50 border-purple-200",
  completed: "text-green-700 bg-green-50 border-green-200",
  cancelled: "text-red-700 bg-red-50 border-red-200",
  no_show: "text-gray-600 bg-gray-50 border-gray-200",
};

export default function ClientProfile() {
  const [, params] = useRoute("/clients/:id");
  const clientId = params?.id ? parseInt(params.id) : 0;
  const [editDialog, setEditDialog] = useState(false);
  const [apptDialog, setApptDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: client, isLoading: isLoadingClient } = useGetClient(clientId, {
    query: { queryKey: getGetClientQueryKey(clientId), enabled: !!clientId }
  });
  const { data: history, isLoading: isLoadingHistory } = useGetClientHistory(clientId, {
    query: { queryKey: getGetClientHistoryQueryKey(clientId), enabled: !!clientId }
  });
  const { data: loyalty, isLoading: isLoadingLoyalty } = useGetClientLoyalty(clientId, {
    query: { queryKey: getGetClientLoyaltyQueryKey(clientId), enabled: !!clientId }
  });
  const { data: staff } = useListStaff({ query: { queryKey: getListStaffQueryKey(), enabled: apptDialog } });
  const { data: services } = useListServices({}, { query: { queryKey: getListServicesQueryKey({}), enabled: apptDialog } });

  const updateClient = useUpdateClient();
  const createAppointment = useCreateAppointment();

  const editForm = useForm<EditForm>();
  const apptForm = useForm<ApptForm>({
    defaultValues: { staffId: "", serviceId: "", date: format(new Date(), "yyyy-MM-dd"), startTime: "10:00", notes: "" }
  });

  const openEdit = () => {
    if (!client) return;
    editForm.reset({
      name: client.name,
      email: client.email || "",
      phone: client.phone || "",
      dateOfBirth: client.dateOfBirth || "",
      gender: client.gender || "",
      notes: client.notes || "",
    });
    setEditDialog(true);
  };

  const onEditSubmit = (data: EditForm) => {
    updateClient.mutate({ id: clientId, data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientQueryKey(clientId) });
        setEditDialog(false);
      }
    });
  };

  const onApptSubmit = (data: ApptForm) => {
    const svc = services?.find(s => s.id.toString() === data.serviceId);
    const duration = svc?.duration || 60;
    const [h, m] = data.startTime.split(":").map(Number);
    const endDate = new Date(0, 0, 0, h, m + duration);
    const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;

    createAppointment.mutate({
      data: {
        clientId,
        staffId: parseInt(data.staffId),
        serviceId: parseInt(data.serviceId) || 0,
        date: data.date,
        startTime: data.startTime,
        notes: data.notes || undefined,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetClientHistoryQueryKey(clientId) });
        queryClient.invalidateQueries({ queryKey: getListAppointmentsQueryKey() });
        setApptDialog(false);
      }
    });
  };

  if (isLoadingClient) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <div className="lg:col-span-2"><Skeleton className="h-64" /></div>
        </div>
      </div>
    );
  }

  if (!client) {
    return <div className="text-center py-12 text-muted-foreground">Client not found.</div>;
  }

  const initials = client.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="outline" size="icon"><ChevronLeft className="w-4 h-4" /></Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-serif font-bold text-sm">
              {initials}
            </div>
            <div>
              <h1 className="text-2xl font-serif font-semibold tracking-tight text-foreground">{client.name}</h1>
              <p className="text-sm text-muted-foreground">
                Client since {format(new Date(client.createdAt), "MMM yyyy")}
                {(client.visitCount ?? 0) > 0 && ` · ${client.visitCount} visit${client.visitCount !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => { apptForm.reset({ staffId: "", serviceId: "", date: format(new Date(), "yyyy-MM-dd"), startTime: "10:00", notes: "" }); setApptDialog(true); }}>
            <Plus className="w-4 h-4" />
            Book Appointment
          </Button>
          <Button variant="outline" className="gap-2" onClick={openEdit}>
            <Edit2 className="w-4 h-4" />
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-4">
          {/* Contact Info */}
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Contact Info
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {client.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{client.email}</span>
                </div>
              )}
              {client.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4 shrink-0" />
                  <span>{client.phone}</span>
                </div>
              )}
              {client.dateOfBirth && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="w-4 h-4 shrink-0" />
                  <span>DOB: {client.dateOfBirth}</span>
                </div>
              )}
              {client.gender && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4 shrink-0" />
                  <span className="capitalize">{client.gender}</span>
                </div>
              )}

              <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Total Spent</p>
                  <p className="font-semibold text-foreground">AED {Number(client.totalSpent || 0).toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Visits</p>
                  <p className="font-semibold text-foreground">{client.visitCount || 0}</p>
                </div>
              </div>

              {client.notes && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Notes</p>
                  <p className="text-muted-foreground bg-muted/50 p-2.5 rounded-md text-xs italic">{client.notes}</p>
                </div>
              )}

              {client.tags && client.tags.length > 0 && (
                <div className="pt-3 border-t border-border flex flex-wrap gap-1.5">
                  {client.tags.map((tag: string) => (
                    <Badge key={tag} variant="secondary" className="text-xs font-normal">{tag}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Loyalty */}
          <Card className="shadow-sm border-border bg-gradient-to-br from-card to-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <Award className="w-4 h-4" />
                Loyalty Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingLoyalty ? <Skeleton className="h-8 w-24" /> : (
                <div className="space-y-3">
                  <div>
                    <div className="text-3xl font-bold tracking-tight text-foreground">
                      {loyalty?.points || client.loyaltyPoints || 0}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">Available Points</p>
                  </div>

                  {loyalty?.activePackages && loyalty.activePackages.length > 0 && (
                    <div className="pt-3 border-t border-border/50">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Active Packages</p>
                      <div className="space-y-2">
                        {loyalty.activePackages.map((pkg: any) => (
                          <div key={pkg.packageId} className="bg-card/80 p-2 rounded-md text-xs border border-border">
                            <div className="font-medium text-primary mb-1">{pkg.packageName}</div>
                            {pkg.remainingServices?.map((svc: any) => (
                              <div key={svc.serviceId} className="flex justify-between text-muted-foreground">
                                <span>{svc.serviceName}</span>
                                <span className="font-semibold text-foreground">{svc.remaining}×</span>
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Tabs */}
        <div className="lg:col-span-2">
          <Card className="shadow-sm border-border h-full">
            <Tabs defaultValue="appointments">
              <CardHeader className="border-b border-border pb-0 px-6 pt-5">
                <TabsList className="bg-transparent h-10 p-0 gap-6">
                  {[
                    { value: "appointments", label: "Appointments" },
                    { value: "sales", label: "Sales History" },
                  ].map(tab => (
                    <TabsTrigger
                      key={tab.value}
                      value={tab.value}
                      className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none px-0 pb-3 text-sm"
                    >
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </CardHeader>

              <CardContent className="p-0">
                <TabsContent value="appointments" className="m-0">
                  <div className="divide-y divide-border">
                    {isLoadingHistory ? (
                      <div className="p-6 space-y-3">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                      </div>
                    ) : history?.appointments?.length ? (
                      history.appointments.map((apt: any) => (
                        <div key={apt.id} className="px-6 py-4 hover:bg-muted/30 transition-colors flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="font-medium text-sm truncate">{apt.serviceName || "—"}</div>
                            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(apt.date), "MMM d, yyyy")} at {apt.startTime?.substring(0, 5)}
                              <span>· {apt.staffName}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className={`capitalize text-xs shrink-0 ${STATUS_COLORS[apt.status] || ""}`}>
                            {apt.status?.replace("_", " ")}
                          </Badge>
                        </div>
                      ))
                    ) : (
                      <div className="py-16 text-center text-muted-foreground">
                        <History className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm">No appointment history yet.</p>
                        <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => setApptDialog(true)}>
                          <Plus className="w-3.5 h-3.5" /> Book first appointment
                        </Button>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="sales" className="m-0">
                  <div className="divide-y divide-border">
                    {isLoadingHistory ? (
                      <div className="p-6 space-y-3">
                        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                      </div>
                    ) : history?.sales?.length ? (
                      history.sales.map((sale: any) => (
                        <div key={sale.id} className="px-6 py-4 hover:bg-muted/30 transition-colors">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-medium text-sm flex items-center gap-2">
                                Receipt #{sale.id.toString().padStart(5, "0")}
                                <Badge variant="secondary" className="text-[10px] font-normal uppercase">
                                  {sale.paymentMethod?.replace("_", " ")}
                                </Badge>
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(sale.createdAt), "MMM d, yyyy h:mm a")}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-semibold text-sm">AED {Number(sale.total).toFixed(2)}</div>
                              {Number(sale.discount) > 0 && (
                                <div className="text-xs text-green-600">−AED {Number(sale.discount).toFixed(2)} disc.</div>
                              )}
                            </div>
                          </div>
                          {sale.items?.length > 0 && (
                            <div className="bg-muted/30 p-2 rounded-md space-y-1">
                              {sale.items.map((item: any) => (
                                <div key={item.id} className="text-xs flex justify-between text-muted-foreground">
                                  <span>{item.quantity}× {item.name}</span>
                                  <span>AED {Number(item.totalPrice).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="py-16 text-center text-muted-foreground">
                        <CreditCard className="w-8 h-8 mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-sm">No sales history yet.</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>
      </div>

      {/* Edit Client Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">Edit Client Profile</DialogTitle>
            <DialogDescription>Update details for {client.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Full Name *</Label>
                <Input {...editForm.register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input placeholder="+971..." {...editForm.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" {...editForm.register("email")} />
              </div>
              <div className="space-y-2">
                <Label>Date of Birth</Label>
                <Input type="date" {...editForm.register("dateOfBirth")} />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={editForm.watch("gender")} onValueChange={(v) => editForm.setValue("gender", v)}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="male">Male</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Notes & Preferences</Label>
                <Input placeholder="Allergies, preferences, VIP status..." {...editForm.register("notes")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={updateClient.isPending}>
                {updateClient.isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Quick Book Appointment Dialog */}
      <Dialog open={apptDialog} onOpenChange={setApptDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">Book Appointment</DialogTitle>
            <DialogDescription>Schedule a new appointment for {client.name}.</DialogDescription>
          </DialogHeader>
          <form onSubmit={apptForm.handleSubmit(onApptSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label>Staff Member *</Label>
              <Select value={apptForm.watch("staffId")} onValueChange={(v) => apptForm.setValue("staffId", v)}>
                <SelectTrigger><SelectValue placeholder="Assign to..." /></SelectTrigger>
                <SelectContent>
                  {staff?.filter((s: any) => s.role !== "admin" && s.isActive).map((s: any) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.name} — {s.specialization || s.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Service</Label>
              <Select value={apptForm.watch("serviceId")} onValueChange={(v) => apptForm.setValue("serviceId", v)}>
                <SelectTrigger><SelectValue placeholder="Select service..." /></SelectTrigger>
                <SelectContent className="max-h-56">
                  {services?.map((s: any) => (
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
                <Input type="date" {...apptForm.register("date", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input type="time" step="900" {...apptForm.register("startTime", { required: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input placeholder="Special requests..." {...apptForm.register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setApptDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createAppointment.isPending || !apptForm.watch("staffId")}>
                {createAppointment.isPending ? "Booking..." : "Book Appointment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
