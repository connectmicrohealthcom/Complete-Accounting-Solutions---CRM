import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListPackages, getListPackagesQueryKey,
  useCreatePackage, useUpdatePackage,
  useListServices, getListServicesQueryKey,
  useListMembershipPlans, getListMembershipPlansQueryKey,
  useCreateMembershipPlan, useUpdateMembershipPlan, useDeleteMembershipPlan,
  useAssignMembership,
  useGetMembershipSales, getGetMembershipSalesQueryKey,
  useListGiftCardTypes, getListGiftCardTypesQueryKey,
  useCreateGiftCardType, useUpdateGiftCardType, useDeleteGiftCardType,
  useSellGiftCard,
  useListGiftCards, getListGiftCardsQueryKey,
  useGetGiftCardLiability, getGetGiftCardLiabilityQueryKey,
  useListClients, getListClientsQueryKey,
} from "@workspace/api-client-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Plus, CheckCircle2, Gift, Trash2, Edit2, CreditCard, Users,
  TrendingUp, AlertCircle, Wallet, BarChart2, ShieldCheck,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { format } from "date-fns";

// ─── Shared helpers ──────────────────────────────────────────────────────────

type PackageServiceItem = { serviceId: number; serviceName: string; quantity: number };

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-green-100 text-green-700 border-green-200",
    expired: "bg-red-100 text-red-700 border-red-200",
    redeemed: "bg-gray-100 text-gray-600 border-gray-200",
    cancelled: "bg-yellow-100 text-yellow-700 border-yellow-200",
    used: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? map.active}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try { return format(new Date(d), "dd MMM yyyy"); } catch { return d; }
}

function fmtAmount(n: number) {
  return `AED ${n.toLocaleString("en-AE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

// ─── PACKAGES TAB ───────────────────────────────────────────────────────────

type PackageForm = {
  name: string; description: string; price: string;
  validityDays: string; loyaltyPointsBonus: string; isActive: boolean;
};
type Package = {
  id: number; name: string; description?: string; price: number;
  validityDays: number; loyaltyPointsBonus?: number; isActive: boolean;
  services?: { serviceId: number; serviceName: string; quantity: number }[];
};

function PackagesTab() {
  const [pkgDialog, setPkgDialog] = useState<{ open: boolean; pkg?: Package }>({ open: false });
  const [includedServices, setIncludedServices] = useState<PackageServiceItem[]>([]);
  const [addSvcId, setAddSvcId] = useState<string>("");
  const queryClient = useQueryClient();

  const { data: packages, isLoading } = useListPackages({ query: { queryKey: getListPackagesQueryKey() } });
  const { data: services } = useListServices({}, { query: { queryKey: getListServicesQueryKey({}), enabled: pkgDialog.open } });
  const createPackage = useCreatePackage();
  const updatePackage = useUpdatePackage();

  const form = useForm<PackageForm>({
    defaultValues: { name: "", description: "", price: "", validityDays: "365", loyaltyPointsBonus: "0", isActive: true }
  });

  const openCreate = () => {
    form.reset({ name: "", description: "", price: "", validityDays: "365", loyaltyPointsBonus: "0", isActive: true });
    setIncludedServices([]); setAddSvcId(""); setPkgDialog({ open: true });
  };
  const openEdit = (pkg: Package) => {
    form.reset({ name: pkg.name, description: pkg.description || "", price: pkg.price.toString(), validityDays: pkg.validityDays.toString(), loyaltyPointsBonus: pkg.loyaltyPointsBonus?.toString() || "0", isActive: pkg.isActive });
    setIncludedServices(pkg.services?.map(s => ({ serviceId: s.serviceId, serviceName: s.serviceName, quantity: s.quantity })) || []);
    setAddSvcId(""); setPkgDialog({ open: true, pkg });
  };
  const addService = () => {
    if (!addSvcId) return;
    const svc = services?.find(s => s.id.toString() === addSvcId);
    if (!svc) return;
    const idx = includedServices.findIndex(s => s.serviceId === svc.id);
    if (idx >= 0) setIncludedServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: s.quantity + 1 } : s));
    else setIncludedServices(prev => [...prev, { serviceId: svc.id, serviceName: svc.name, quantity: 1 }]);
    setAddSvcId("");
  };
  const removeService = (idx: number) => setIncludedServices(prev => prev.filter((_, i) => i !== idx));
  const onSubmit = (data: PackageForm) => {
    const payload = { name: data.name, description: data.description || undefined, price: parseFloat(data.price), validityDays: parseInt(data.validityDays), loyaltyPointsBonus: parseInt(data.loyaltyPointsBonus) || 0, isActive: data.isActive, services: includedServices.map(s => ({ serviceId: s.serviceId, quantity: s.quantity })) };
    const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListPackagesQueryKey() }); setPkgDialog({ open: false }); };
    if (pkgDialog.pkg) updatePackage.mutate({ id: pkgDialog.pkg.id, data: payload }, { onSuccess: invalidate });
    else createPackage.mutate({ data: payload }, { onSuccess: invalidate });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{packages ? `${packages.length} package${packages.length !== 1 ? "s" : ""}` : "Manage service bundles."}</p>
        <Button size="sm" className="gap-2" onClick={openCreate}><Plus className="w-4 h-4" />New Package</Button>
      </div>

      {!isLoading && (!packages || packages.length === 0) && (
        <div className="py-16 text-center border-2 border-dashed border-border rounded-xl text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium text-foreground">No packages yet</p>
          <p className="text-sm mb-4">Create your first service bundle.</p>
          <Button onClick={openCreate}>Create Package</Button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {isLoading ? [...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-8 w-24" /></CardHeader><CardContent><div className="space-y-2">{[...Array(3)].map((_, j) => <Skeleton key={j} className="h-4 w-full" />)}</div></CardContent></Card>) : packages?.map((pkg) => (
          <Card key={pkg.id} className="flex flex-col relative overflow-hidden hover:border-primary/30 transition-colors">
            {!pkg.isActive && <div className="absolute inset-0 bg-background/60 z-10 flex items-center justify-center"><Badge variant="outline">Inactive</Badge></div>}
            <CardHeader className="pb-4 bg-gradient-to-br from-primary/5 to-transparent">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-xl font-serif">{pkg.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 min-h-[36px] line-clamp-2">{pkg.description}</p>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 ml-2" onClick={() => openEdit(pkg as Package)}><Edit2 className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold">{fmtAmount(Number(pkg.price))}</span>
                <span className="text-sm text-muted-foreground">/ {pkg.validityDays} days</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pt-4">
              {pkg.services && pkg.services.length > 0 && (
                <ul className="space-y-1.5">
                  {pkg.services.map((svc, i) => (
                    <li key={i} className="flex items-center text-sm">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mr-2 shrink-0" />
                      <span className="text-muted-foreground"><span className="font-medium text-foreground">{svc.quantity}×</span> {svc.serviceName}</span>
                    </li>
                  ))}
                </ul>
              )}
              {pkg.loyaltyPointsBonus && pkg.loyaltyPointsBonus > 0 && (
                <div className="mt-3 bg-primary/5 border border-primary/20 rounded-md px-3 py-2 flex items-center gap-2">
                  <Gift className="w-4 h-4 text-primary" />
                  <span className="text-sm text-primary font-medium">+{pkg.loyaltyPointsBonus} bonus points</span>
                </div>
              )}
            </CardContent>
            <CardFooter className="pt-3 border-t bg-muted/10">
              <Button variant="outline" className="w-full" onClick={() => openEdit(pkg as Package)}>Edit Package</Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={pkgDialog.open} onOpenChange={(o) => setPkgDialog({ open: o })}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{pkgDialog.pkg ? "Edit Package" : "Create Package"}</DialogTitle>
            <DialogDescription>{pkgDialog.pkg ? "Update package details." : "Build a new service package."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2"><Label>Package Name *</Label><Input placeholder="e.g. Gold Bundle" {...form.register("name", { required: true })} /></div>
            <div className="space-y-2"><Label>Description</Label><Input placeholder="Brief description..." {...form.register("description")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Price (AED) *</Label><Input type="number" min="0" step="0.01" {...form.register("price", { required: true })} /></div>
              <div className="space-y-2"><Label>Validity (days)</Label><Input type="number" min="1" {...form.register("validityDays")} /></div>
            </div>
            <div className="space-y-2"><Label>Loyalty Points Bonus</Label><Input type="number" min="0" {...form.register("loyaltyPointsBonus")} /></div>
            <div className="space-y-3 border border-border rounded-lg p-3">
              <Label className="text-sm font-semibold">Included Services</Label>
              <div className="flex gap-2">
                <Select value={addSvcId} onValueChange={setAddSvcId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Add a service..." /></SelectTrigger>
                  <SelectContent className="max-h-56">{services?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name} — AED {s.price}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addService} disabled={!addSvcId}><Plus className="w-4 h-4" /></Button>
              </div>
              {includedServices.length > 0 ? includedServices.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2">
                  <span className="flex-1 truncate">{item.serviceName}</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIncludedServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: Math.max(1, s.quantity - 1) } : s))}>−</Button>
                    <span className="w-5 text-center font-medium">{item.quantity}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIncludedServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: s.quantity + 1 } : s))}>+</Button>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeService(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              )) : <p className="text-xs text-muted-foreground text-center py-2">No services added.</p>}
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="pkg-active" className="rounded" {...form.register("isActive")} /><Label htmlFor="pkg-active">Active</Label></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPkgDialog({ open: false })}>Cancel</Button>
              <Button type="submit" disabled={createPackage.isPending || updatePackage.isPending}>{createPackage.isPending || updatePackage.isPending ? "Saving..." : pkgDialog.pkg ? "Save Changes" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MEMBERSHIPS TAB ─────────────────────────────────────────────────────────

type MembershipPlanForm = { name: string; description: string; price: string; validityDays: string; loyaltyPointsBonus: string; isActive: boolean; };
type MembershipPlan = { id: number; name: string; description?: string; price: number; validityDays: number; loyaltyPointsBonus: number; isActive: boolean; services: { serviceId: number; serviceName: string; quantity: number }[]; };

function MembershipsTab() {
  const [subTab, setSubTab] = useState<"plans" | "assign" | "sales">("plans");
  const [planDialog, setPlanDialog] = useState<{ open: boolean; plan?: MembershipPlan }>({ open: false });
  const [includedServices, setIncludedServices] = useState<PackageServiceItem[]>([]);
  const [addSvcId, setAddSvcId] = useState<string>("");
  const [assignDialog, setAssignDialog] = useState(false);
  const [assignClientId, setAssignClientId] = useState<string>("");
  const [assignPlanId, setAssignPlanId] = useState<string>("");
  const [assignStartDate, setAssignStartDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [assignPayment, setAssignPayment] = useState<string>("cash");
  const [salesFilter, setSalesFilter] = useState<string>("all");

  const queryClient = useQueryClient();

  const { data: plans, isLoading: plansLoading } = useListMembershipPlans({ query: { queryKey: getListMembershipPlansQueryKey() } });
  const { data: services } = useListServices({}, { query: { queryKey: getListServicesQueryKey({}), enabled: planDialog.open } });
  const { data: clients } = useListClients({}, { query: { queryKey: getListClientsQueryKey({}), enabled: assignDialog } });
  const { data: salesData, isLoading: salesLoading } = useGetMembershipSales({ query: { queryKey: getGetMembershipSalesQueryKey() } });

  const createPlan = useCreateMembershipPlan();
  const updatePlan = useUpdateMembershipPlan();
  const deletePlan = useDeleteMembershipPlan();
  const assignMembership = useAssignMembership();

  const planForm = useForm<MembershipPlanForm>({
    defaultValues: { name: "", description: "", price: "", validityDays: "365", loyaltyPointsBonus: "0", isActive: true }
  });

  const openCreatePlan = () => {
    planForm.reset({ name: "", description: "", price: "", validityDays: "365", loyaltyPointsBonus: "0", isActive: true });
    setIncludedServices([]); setAddSvcId(""); setPlanDialog({ open: true });
  };
  const openEditPlan = (plan: MembershipPlan) => {
    planForm.reset({ name: plan.name, description: plan.description || "", price: plan.price.toString(), validityDays: plan.validityDays.toString(), loyaltyPointsBonus: plan.loyaltyPointsBonus.toString(), isActive: plan.isActive });
    setIncludedServices(plan.services.map(s => ({ serviceId: s.serviceId, serviceName: s.serviceName, quantity: s.quantity })));
    setAddSvcId(""); setPlanDialog({ open: true, plan });
  };

  const addService = () => {
    if (!addSvcId) return;
    const svc = services?.find(s => s.id.toString() === addSvcId);
    if (!svc) return;
    const idx = includedServices.findIndex(s => s.serviceId === svc.id);
    if (idx >= 0) setIncludedServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: s.quantity + 1 } : s));
    else setIncludedServices(prev => [...prev, { serviceId: svc.id, serviceName: svc.name, quantity: 1 }]);
    setAddSvcId("");
  };

  const onSubmitPlan = (data: MembershipPlanForm) => {
    const payload = { name: data.name, description: data.description || undefined, price: parseFloat(data.price), validityDays: parseInt(data.validityDays), loyaltyPointsBonus: parseInt(data.loyaltyPointsBonus) || 0, isActive: data.isActive, services: includedServices.map(s => ({ serviceId: s.serviceId, quantity: s.quantity })) };
    const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListMembershipPlansQueryKey() }); setPlanDialog({ open: false }); };
    if (planDialog.plan) updatePlan.mutate({ id: planDialog.plan.id, data: payload }, { onSuccess: invalidate });
    else createPlan.mutate({ data: payload }, { onSuccess: invalidate });
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this membership plan?")) return;
    deletePlan.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMembershipPlansQueryKey() }) });
  };

  const handleAssign = () => {
    if (!assignClientId || !assignPlanId) return;
    assignMembership.mutate({ data: { clientId: parseInt(assignClientId), planId: parseInt(assignPlanId), startDate: assignStartDate, paymentMethod: assignPayment } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMembershipSalesQueryKey() });
        setAssignDialog(false); setAssignClientId(""); setAssignPlanId(""); setAssignPayment("cash");
      }
    });
  };

  const filteredSales = salesData?.filter(s => salesFilter === "all" || s.status === salesFilter) ?? [];

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg w-fit">
        {([["plans", "Plans", ShieldCheck], ["assign", "Assign", Users], ["sales", "Sales Report", BarChart2]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${subTab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Plans */}
      {subTab === "plans" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{plans ? `${plans.length} plan${plans.length !== 1 ? "s" : ""}` : "Define membership tiers."}</p>
            <Button size="sm" className="gap-2" onClick={openCreatePlan}><Plus className="w-4 h-4" />New Plan</Button>
          </div>

          {!plansLoading && (!plans || plans.length === 0) && (
            <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
              <ShieldCheck className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-lg font-medium">No membership plans yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create plans clients can subscribe to.</p>
              <Button onClick={openCreatePlan}>Create Plan</Button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {plansLoading ? [...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-8 w-24" /></CardHeader></Card>) : plans?.map((plan) => (
              <Card key={plan.id} className={`flex flex-col relative hover:border-primary/30 transition-colors ${!plan.isActive ? "opacity-60" : ""}`}>
                <CardHeader className="pb-3 bg-gradient-to-br from-primary/5 to-transparent">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg font-serif">{plan.name}</CardTitle>
                        {!plan.isActive && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{plan.description}</p>
                    </div>
                    <div className="flex gap-1 shrink-0 ml-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditPlan(plan as MembershipPlan)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(plan.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-2xl font-bold">{fmtAmount(plan.price)}</span>
                    <span className="text-sm text-muted-foreground">/ {plan.validityDays} days</span>
                  </div>
                </CardHeader>
                <CardContent className="pt-3 flex-1">
                  {plan.services && plan.services.length > 0 && (
                    <ul className="space-y-1">
                      {plan.services.map((s, i) => (
                        <li key={i} className="flex items-center text-sm">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mr-2 shrink-0" />
                          <span className="text-muted-foreground"><span className="font-medium text-foreground">{s.quantity}×</span> {s.serviceName}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {plan.loyaltyPointsBonus > 0 && (
                    <div className="mt-3 bg-primary/5 border border-primary/20 rounded-md px-3 py-2 flex items-center gap-2">
                      <Gift className="w-4 h-4 text-primary" />
                      <span className="text-sm text-primary font-medium">+{plan.loyaltyPointsBonus} bonus points</span>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="border-t bg-muted/10 pt-3">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setAssignPlanId(plan.id.toString()); setAssignDialog(true); setSubTab("assign"); }}>
                    Assign to Client
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Assign */}
      {subTab === "assign" && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="font-serif">Assign Membership</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Client *</Label>
              <Select value={assignClientId} onValueChange={setAssignClientId}>
                <SelectTrigger><SelectValue placeholder="Search client..." /></SelectTrigger>
                <SelectContent className="max-h-60">
                  {clients?.clients?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Membership Plan *</Label>
              <Select value={assignPlanId} onValueChange={setAssignPlanId}>
                <SelectTrigger><SelectValue placeholder="Select plan..." /></SelectTrigger>
                <SelectContent>
                  {plans?.filter(p => p.isActive).map(p => <SelectItem key={p.id} value={p.id.toString()}>{p.name} — {fmtAmount(p.price)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {assignPlanId && (() => {
              const plan = plans?.find(p => p.id.toString() === assignPlanId);
              if (!plan) return null;
              const start = new Date(assignStartDate);
              const expiry = new Date(start);
              expiry.setDate(expiry.getDate() + plan.validityDays);
              return (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Price</span><span className="font-semibold">{fmtAmount(plan.price)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Validity</span><span>{plan.validityDays} days</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Expiry</span><span>{fmtDate(expiry.toISOString().split("T")[0])}</span></div>
                  {plan.loyaltyPointsBonus > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Bonus Points</span><span className="text-primary font-medium">+{plan.loyaltyPointsBonus}</span></div>}
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date *</Label>
                <Input type="date" value={assignStartDate} onChange={e => setAssignStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={assignPayment} onValueChange={setAssignPayment}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["cash", "card", "bank_transfer"].map(m => <SelectItem key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button className="w-full" disabled={!assignClientId || !assignPlanId || assignMembership.isPending} onClick={handleAssign}>
              {assignMembership.isPending ? "Processing..." : "Assign Membership"}
            </Button>
            {assignMembership.isSuccess && (
              <p className="text-sm text-green-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Membership assigned successfully.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Sales Report */}
      {subTab === "sales" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground flex-1">{filteredSales.length} record{filteredSales.length !== 1 ? "s" : ""}</p>
            <Select value={salesFilter} onValueChange={setSalesFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {salesLoading ? (
            <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div>
          ) : filteredSales.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No membership sales yet</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Client</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Start</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSales.map((row) => (
                    <TableRow key={row.id} className="hover:bg-muted/20">
                      <TableCell className="font-medium">{row.clientName}</TableCell>
                      <TableCell>{row.planName}</TableCell>
                      <TableCell>{fmtAmount(row.amountPaid)}</TableCell>
                      <TableCell className="capitalize">{row.paymentMethod.replace("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(row.startDate)}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(row.expiryDate)}</TableCell>
                      <TableCell><StatusBadge status={row.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Plan Create/Edit Dialog */}
      <Dialog open={planDialog.open} onOpenChange={(o) => setPlanDialog({ open: o })}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{planDialog.plan ? "Edit Membership Plan" : "Create Membership Plan"}</DialogTitle>
            <DialogDescription>Define the plan details, included services, and validity.</DialogDescription>
          </DialogHeader>
          <form onSubmit={planForm.handleSubmit(onSubmitPlan)} className="space-y-4">
            <div className="space-y-2"><Label>Plan Name *</Label><Input placeholder="e.g. Silver Membership" {...planForm.register("name", { required: true })} /></div>
            <div className="space-y-2"><Label>Description</Label><Input placeholder="Brief description..." {...planForm.register("description")} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Price (AED) *</Label><Input type="number" min="0" step="0.01" {...planForm.register("price", { required: true })} /></div>
              <div className="space-y-2"><Label>Validity (days)</Label><Input type="number" min="1" {...planForm.register("validityDays")} /></div>
            </div>
            <div className="space-y-2"><Label>Loyalty Points Bonus</Label><Input type="number" min="0" placeholder="0" {...planForm.register("loyaltyPointsBonus")} /></div>
            <div className="space-y-3 border border-border rounded-lg p-3">
              <Label className="text-sm font-semibold">Included Services</Label>
              <div className="flex gap-2">
                <Select value={addSvcId} onValueChange={setAddSvcId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder="Add a service..." /></SelectTrigger>
                  <SelectContent className="max-h-56">{services?.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.name} — AED {s.price}</SelectItem>)}</SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addService} disabled={!addSvcId}><Plus className="w-4 h-4" /></Button>
              </div>
              {includedServices.length > 0 ? includedServices.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2">
                  <span className="flex-1 truncate">{item.serviceName}</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIncludedServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: Math.max(1, s.quantity - 1) } : s))}>−</Button>
                    <span className="w-5 text-center font-medium">{item.quantity}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIncludedServices(prev => prev.map((s, i) => i === idx ? { ...s, quantity: s.quantity + 1 } : s))}>+</Button>
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setIncludedServices(prev => prev.filter((_, i) => i !== idx))}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              )) : <p className="text-xs text-muted-foreground text-center py-2">No services added.</p>}
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="plan-active" className="rounded" {...planForm.register("isActive")} /><Label htmlFor="plan-active">Active (available for sale)</Label></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setPlanDialog({ open: false })}>Cancel</Button>
              <Button type="submit" disabled={createPlan.isPending || updatePlan.isPending}>{createPlan.isPending || updatePlan.isPending ? "Saving..." : planDialog.plan ? "Save Changes" : "Create Plan"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── GIFT CARDS TAB ──────────────────────────────────────────────────────────

type GiftCardTypeForm = { name: string; purchaseAmount: string; creditAmount: string; validityDays: string; isActive: boolean; };
type GiftCardType = { id: number; name: string; purchaseAmount: number; creditAmount: number; validityDays?: number | null; isActive: boolean; };

function GiftCardsTab() {
  const [subTab, setSubTab] = useState<"types" | "sell" | "cards" | "liability">("types");
  const [typeDialog, setTypeDialog] = useState<{ open: boolean; type?: GiftCardType }>({ open: false });
  const [sellClientId, setSellClientId] = useState<string>("");
  const [sellTypeId, setSellTypeId] = useState<string>("");
  const [sellPayment, setSellPayment] = useState<string>("cash");
  const [cardsFilter, setCardsFilter] = useState<string>("all");

  const queryClient = useQueryClient();

  const { data: types, isLoading: typesLoading } = useListGiftCardTypes({ query: { queryKey: getListGiftCardTypesQueryKey() } });
  const { data: cards, isLoading: cardsLoading } = useListGiftCards({ query: { queryKey: getListGiftCardsQueryKey() } });
  const { data: liability } = useGetGiftCardLiability({ query: { queryKey: getGetGiftCardLiabilityQueryKey() } });
  const { data: clients } = useListClients({}, { query: { queryKey: getListClientsQueryKey({}), enabled: subTab === "sell" } });

  const createType = useCreateGiftCardType();
  const updateType = useUpdateGiftCardType();
  const deleteType = useDeleteGiftCardType();
  const sellCard = useSellGiftCard();

  const typeForm = useForm<GiftCardTypeForm>({
    defaultValues: { name: "", purchaseAmount: "", creditAmount: "", validityDays: "", isActive: true }
  });

  const openCreateType = () => { typeForm.reset({ name: "", purchaseAmount: "", creditAmount: "", validityDays: "", isActive: true }); setTypeDialog({ open: true }); };
  const openEditType = (t: GiftCardType) => { typeForm.reset({ name: t.name, purchaseAmount: t.purchaseAmount.toString(), creditAmount: t.creditAmount.toString(), validityDays: t.validityDays?.toString() || "", isActive: t.isActive }); setTypeDialog({ open: true, type: t }); };

  const onSubmitType = (data: GiftCardTypeForm) => {
    const payload = { name: data.name, purchaseAmount: parseFloat(data.purchaseAmount), creditAmount: parseFloat(data.creditAmount), validityDays: data.validityDays ? parseInt(data.validityDays) : undefined, isActive: data.isActive };
    const invalidate = () => { queryClient.invalidateQueries({ queryKey: getListGiftCardTypesQueryKey() }); setTypeDialog({ open: false }); };
    if (typeDialog.type) updateType.mutate({ id: typeDialog.type.id, data: payload }, { onSuccess: invalidate });
    else createType.mutate({ data: payload }, { onSuccess: invalidate });
  };

  const handleDeleteType = (id: number) => {
    if (!confirm("Delete this gift card type?")) return;
    deleteType.mutate({ id }, { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListGiftCardTypesQueryKey() }) });
  };

  const handleSell = () => {
    if (!sellClientId || !sellTypeId) return;
    sellCard.mutate({ data: { clientId: parseInt(sellClientId), typeId: parseInt(sellTypeId), paymentMethod: sellPayment } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListGiftCardsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetGiftCardLiabilityQueryKey() });
        setSellClientId(""); setSellTypeId(""); setSellPayment("cash");
      }
    });
  };

  const filteredCards = cards?.filter(c => cardsFilter === "all" || c.status === cardsFilter) ?? [];

  return (
    <div className="space-y-6">
      {/* Sub-nav */}
      <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg w-fit flex-wrap">
        {([["types", "Card Types", CreditCard], ["sell", "Sell Card", Plus], ["cards", "Sales Report", BarChart2], ["liability", "Liability", TrendingUp]] as const).map(([key, label, Icon]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${subTab === key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* Card Types */}
      {subTab === "types" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{types ? `${types.length} type${types.length !== 1 ? "s" : ""}` : "Define gift card products."}</p>
            <Button size="sm" className="gap-2" onClick={openCreateType}><Plus className="w-4 h-4" />New Card Type</Button>
          </div>

          {!typesLoading && (!types || types.length === 0) && (
            <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
              <CreditCard className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-lg font-medium">No gift card types yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create a gift card product to start selling.</p>
              <Button onClick={openCreateType}>Create Card Type</Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {typesLoading ? [...Array(3)].map((_, i) => <Card key={i}><CardHeader><Skeleton className="h-6 w-32 mb-2" /><Skeleton className="h-10 w-40" /></CardHeader></Card>) : types?.map((t) => (
              <Card key={t.id} className={`relative overflow-hidden hover:border-primary/30 transition-colors ${!t.isActive ? "opacity-60" : ""}`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start relative z-10">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="font-serif text-xl">{t.name}</CardTitle>
                        {!t.isActive && <Badge variant="outline" className="text-xs">Inactive</Badge>}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Pay</p>
                          <p className="font-bold text-lg">{fmtAmount(t.purchaseAmount)}</p>
                        </div>
                        <div className="text-2xl text-muted-foreground">→</div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Get</p>
                          <p className="font-bold text-xl text-primary">{fmtAmount(t.creditAmount)}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1 z-10">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditType(t as GiftCardType)}><Edit2 className="w-3.5 h-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteType(t.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 pb-3">
                  {t.validityDays ? (
                    <p className="text-xs text-muted-foreground">Valid for {t.validityDays} days</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No expiry</p>
                  )}
                  <div className="mt-2 text-xs font-medium text-green-600 bg-green-50 border border-green-100 rounded px-2 py-1 inline-block">
                    {Math.round(((t.creditAmount - t.purchaseAmount) / t.purchaseAmount) * 100)}% bonus value
                  </div>
                </CardContent>
                <CardFooter className="border-t bg-muted/10 pt-3">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setSellTypeId(t.id.toString()); setSubTab("sell"); }}>
                    Sell This Card
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Sell */}
      {subTab === "sell" && (
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle className="font-serif flex items-center gap-2"><CreditCard className="w-5 h-5 text-primary" />Sell a Gift Card</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Select Client *</Label>
              <Select value={sellClientId} onValueChange={setSellClientId}>
                <SelectTrigger><SelectValue placeholder="Search client..." /></SelectTrigger>
                <SelectContent className="max-h-60">{clients?.clients?.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.name}{c.phone ? ` — ${c.phone}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Gift Card Type *</Label>
              <Select value={sellTypeId} onValueChange={setSellTypeId}>
                <SelectTrigger><SelectValue placeholder="Select card type..." /></SelectTrigger>
                <SelectContent>{types?.filter(t => t.isActive).map(t => <SelectItem key={t.id} value={t.id.toString()}>{t.name} — Pay {fmtAmount(t.purchaseAmount)}, Get {fmtAmount(t.creditAmount)}</SelectItem>)}</SelectContent>
              </Select>
            </div>

            {sellTypeId && (() => {
              const t = types?.find(t => t.id.toString() === sellTypeId);
              if (!t) return null;
              return (
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount to Collect</span><span className="font-bold text-lg">{fmtAmount(t.purchaseAmount)}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-muted-foreground">Wallet Credit</span><span className="font-semibold text-primary">{fmtAmount(t.creditAmount)}</span></div>
                  {t.validityDays && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Validity</span><span>{t.validityDays} days</span></div>}
                </div>
              );
            })()}

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <Select value={sellPayment} onValueChange={setSellPayment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["cash", "card", "bank_transfer"].map(m => <SelectItem key={m} value={m}>{m.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" disabled={!sellClientId || !sellTypeId || sellCard.isPending} onClick={handleSell}>
              {sellCard.isPending ? "Processing..." : "Sell & Credit Wallet"}
            </Button>
            {sellCard.isSuccess && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
                <p className="font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" />Gift card sold successfully!</p>
                <p className="mt-1 text-xs">Reference code: <span className="font-mono font-bold">{(sellCard.data as { referenceCode?: string })?.referenceCode}</span></p>
                <p className="text-xs">Wallet has been credited.</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Cards Report */}
      {subTab === "cards" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground flex-1">{filteredCards.length} record{filteredCards.length !== 1 ? "s" : ""}</p>
            <Select value={cardsFilter} onValueChange={setCardsFilter}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="redeemed">Redeemed</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {cardsLoading ? <div className="space-y-2">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}</div> : filteredCards.length === 0 ? (
            <div className="py-16 text-center border-2 border-dashed border-border rounded-xl">
              <BarChart2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No gift cards sold yet</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Reference</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Credited</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCards.map((c) => (
                    <TableRow key={c.id} className="hover:bg-muted/20">
                      <TableCell className="font-mono text-xs font-bold">{c.referenceCode}</TableCell>
                      <TableCell className="font-medium">{c.clientName}</TableCell>
                      <TableCell>{c.typeName}</TableCell>
                      <TableCell className="text-right">{fmtAmount(c.purchaseAmount)}</TableCell>
                      <TableCell className="text-right text-primary font-medium">{fmtAmount(c.creditAmount)}</TableCell>
                      <TableCell className="text-right">{fmtAmount(c.remainingBalance)}</TableCell>
                      <TableCell className="capitalize">{c.paymentMethod.replace("_", " ")}</TableCell>
                      <TableCell className="text-muted-foreground">{fmtDate(c.expiryDate)}</TableCell>
                      <TableCell><StatusBadge status={c.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Liability */}
      {subTab === "liability" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Outstanding Liability</p>
                    <p className="text-3xl font-bold mt-0.5">{fmtAmount(liability?.totalLiability ?? 0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">Unredeemed wallet balances</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Wallets</p>
                    <p className="text-3xl font-bold mt-0.5">{liability?.totalActiveWallets ?? 0}</p>
                    <p className="text-xs text-muted-foreground mt-1">Clients with a balance</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {liability?.breakdown && liability.breakdown.length > 0 ? (
            <Card>
              <CardHeader><CardTitle className="text-base font-semibold">Breakdown by Card Type</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead>Card Type</TableHead>
                      <TableHead className="text-right">Active Cards</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {liability.breakdown.map((row) => (
                      <TableRow key={row.typeName}>
                        <TableCell className="font-medium">{row.typeName}</TableCell>
                        <TableCell className="text-right">{row.count}</TableCell>
                        <TableCell className="text-right font-semibold text-rose-600">{fmtAmount(row.liability)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            <div className="py-12 text-center border-2 border-dashed border-border rounded-xl">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="font-medium">No outstanding liability</p>
              <p className="text-sm text-muted-foreground">All gift card balances have been redeemed.</p>
            </div>
          )}
        </div>
      )}

      {/* Type Create/Edit Dialog */}
      <Dialog open={typeDialog.open} onOpenChange={(o) => setTypeDialog({ open: o })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">{typeDialog.type ? "Edit Gift Card Type" : "Create Gift Card Type"}</DialogTitle>
            <DialogDescription>Set the purchase price and wallet credit amount.</DialogDescription>
          </DialogHeader>
          <form onSubmit={typeForm.handleSubmit(onSubmitType)} className="space-y-4">
            <div className="space-y-2"><Label>Card Name *</Label><Input placeholder='e.g. "Essence", "Aura"' {...typeForm.register("name", { required: true })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Purchase Amount (AED) *</Label>
                <Input type="number" min="0" step="0.01" placeholder="1000" {...typeForm.register("purchaseAmount", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label>Wallet Credit (AED) *</Label>
                <Input type="number" min="0" step="0.01" placeholder="1300" {...typeForm.register("creditAmount", { required: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Validity (days, optional)</Label>
              <Input type="number" min="1" placeholder="Leave blank for no expiry" {...typeForm.register("validityDays")} />
            </div>
            <div className="flex items-center gap-2"><input type="checkbox" id="type-active" className="rounded" {...typeForm.register("isActive")} /><Label htmlFor="type-active">Active</Label></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTypeDialog({ open: false })}>Cancel</Button>
              <Button type="submit" disabled={createType.isPending || updateType.isPending}>{createType.isPending || updateType.isPending ? "Saving..." : typeDialog.type ? "Save Changes" : "Create"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────

export default function Loyalty() {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Loyalty & Rewards</h1>
        <p className="text-muted-foreground mt-1">Manage packages, memberships, and gift cards for your clients.</p>
      </div>

      <Tabs defaultValue="packages">
        <TabsList className="mb-2">
          <TabsTrigger value="packages" className="gap-2"><Gift className="w-4 h-4" />Packages</TabsTrigger>
          <TabsTrigger value="memberships" className="gap-2"><ShieldCheck className="w-4 h-4" />Memberships</TabsTrigger>
          <TabsTrigger value="gift-cards" className="gap-2"><CreditCard className="w-4 h-4" />Gift Cards</TabsTrigger>
        </TabsList>

        <TabsContent value="packages" className="mt-4"><PackagesTab /></TabsContent>
        <TabsContent value="memberships" className="mt-4"><MembershipsTab /></TabsContent>
        <TabsContent value="gift-cards" className="mt-4"><GiftCardsTab /></TabsContent>
      </Tabs>
    </div>
  );
}
