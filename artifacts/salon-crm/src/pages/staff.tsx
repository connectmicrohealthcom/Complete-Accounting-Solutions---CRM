import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  useListStaff, getListStaffQueryKey,
  useCreateStaff, useUpdateStaff, useDeleteStaff,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Mail, Phone, Edit2, Trash2, ExternalLink, BarChart2 } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  manager: "Manager",
  receptionist: "Receptionist",
  stylist: "Stylist",
  therapist: "Therapist",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-purple-100 text-purple-700",
  manager: "bg-blue-100 text-blue-700",
  receptionist: "bg-green-100 text-green-700",
  stylist: "bg-amber-100 text-amber-700",
  therapist: "bg-rose-100 text-rose-700",
};

type StaffMember = {
  id: number;
  name: string;
  email: string;
  phone?: string;
  role: string;
  specialization?: string;
  color?: string;
  commissionRate?: number;
  targetMonthly?: number;
  isActive: boolean;
};

type StaffForm = {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: string;
  specialization: string;
  color: string;
  commissionRate: string;
  targetMonthly: string;
  isActive: boolean;
};

export default function Staff() {
  const [staffDialog, setStaffDialog] = useState<{ open: boolean; staff?: StaffMember }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: number; name?: string }>({ open: false });

  const queryClient = useQueryClient();

  const { data: staffList, isLoading } = useListStaff({
    query: { queryKey: getListStaffQueryKey() }
  });

  const createStaff = useCreateStaff();
  const updateStaff = useUpdateStaff();
  const deleteStaff = useDeleteStaff();

  const form = useForm<StaffForm>({
    defaultValues: { name: "", email: "", password: "", phone: "", role: "stylist", specialization: "", color: "#8C7355", commissionRate: "0", targetMonthly: "0", isActive: true }
  });

  const openAdd = () => {
    form.reset({ name: "", email: "", password: "", phone: "", role: "stylist", specialization: "", color: "#8C7355", commissionRate: "0", targetMonthly: "0", isActive: true });
    setStaffDialog({ open: true });
  };

  const openEdit = (s: StaffMember) => {
    form.reset({
      name: s.name, email: s.email, password: "", phone: s.phone || "",
      role: s.role, specialization: s.specialization || "",
      color: s.color || "#8C7355",
      commissionRate: s.commissionRate?.toString() || "0",
      targetMonthly: s.targetMonthly?.toString() || "0",
      isActive: s.isActive,
    });
    setStaffDialog({ open: true, staff: s });
  };

  const onSubmit = (data: StaffForm) => {
    const payload: any = {
      name: data.name,
      email: data.email,
      phone: data.phone || undefined,
      role: data.role as any,
      specialization: data.specialization || undefined,
      color: data.color || undefined,
      commissionRate: parseFloat(data.commissionRate) || 0,
      targetMonthly: parseFloat(data.targetMonthly) || 0,
      isActive: data.isActive,
    };
    if (data.password) payload.password = data.password;

    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
      setStaffDialog({ open: false });
    };

    if (staffDialog.staff) {
      updateStaff.mutate({ id: staffDialog.staff.id, data: payload }, { onSuccess: invalidate });
    } else {
      payload.password = data.password;
      createStaff.mutate({ data: payload }, { onSuccess: invalidate });
    }
  };

  const confirmDelete = () => {
    if (!deleteDialog.id) return;
    deleteStaff.mutate({ id: deleteDialog.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListStaffQueryKey() });
        setDeleteDialog({ open: false });
      }
    });
  };

  const isPending = createStaff.isPending || updateStaff.isPending;
  const isEditing = !!staffDialog.staff;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Staff Directory</h1>
          <p className="text-muted-foreground mt-1">
            {staffList ? `${staffList.length} team member${staffList.length !== 1 ? "s" : ""}` : "Manage team members, roles, and performance."}
          </p>
        </div>
        <Button className="shrink-0 gap-2" onClick={openAdd}>
          <Plus className="w-4 h-4" />
          New Staff Member
        </Button>
      </div>

      {/* Role permission legend */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(ROLE_LABELS).map(([role, label]) => (
          <Badge key={role} variant="outline" className={`text-xs font-normal ${ROLE_COLORS[role]}`}>
            {label}
          </Badge>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(8)].map((_, i) => (
            <Card key={i} className="shadow-sm border-border">
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Skeleton className="w-20 h-20 rounded-full mb-4" />
                <Skeleton className="h-5 w-32 mb-2" />
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-full rounded-md" />
              </CardContent>
            </Card>
          ))
        ) : staffList?.map((staff) => (
          <Card key={staff.id} className="shadow-sm border-border overflow-hidden hover:border-primary/30 transition-colors group relative">
            {/* Action buttons — visible on hover */}
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <Button
                variant="secondary" size="icon" className="h-7 w-7 bg-card shadow-sm"
                onClick={() => openEdit(staff as StaffMember)}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="secondary" size="icon" className="h-7 w-7 bg-card shadow-sm text-destructive"
                onClick={() => setDeleteDialog({ open: true, id: staff.id, name: staff.name })}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>

            <div className="h-14 w-full" style={{ backgroundColor: `${staff.color || "#8C7355"}20` }} />
            <CardContent className="p-5 pt-0 flex flex-col items-center text-center relative -mt-7">
              <div
                className="w-14 h-14 rounded-full bg-card border-4 border-card flex items-center justify-center text-xl font-serif font-bold mb-2 shadow-sm"
                style={{ color: staff.color || "#8C7355", backgroundColor: `${staff.color || "#8C7355"}15` }}
              >
                {staff.name.charAt(0)}
              </div>

              <h3 className="text-base font-semibold leading-tight">{staff.name}</h3>
              <Badge className={`text-[10px] mt-1 mb-2 font-normal ${ROLE_COLORS[staff.role] || ""}`} variant="secondary">
                {ROLE_LABELS[staff.role] || staff.role}
              </Badge>

              {staff.specialization && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{staff.specialization}</p>
              )}

              <div className="w-full space-y-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5 truncate">
                  <Mail className="w-3 h-3 shrink-0" />
                  <span className="truncate">{staff.email}</span>
                </div>
                {staff.phone && (
                  <div className="flex items-center gap-1.5">
                    <Phone className="w-3 h-3 shrink-0" />
                    <span>{staff.phone}</span>
                  </div>
                )}
              </div>

              {(staff.commissionRate || staff.targetMonthly) ? (
                <div className="w-full mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-muted-foreground">Commission</div>
                    <div className="font-semibold">{staff.commissionRate || 0}%</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Target</div>
                    <div className="font-semibold">AED {Number(staff.targetMonthly || 0).toLocaleString()}</div>
                  </div>
                </div>
              ) : null}

              {!staff.isActive && (
                <Badge variant="outline" className="mt-2 text-xs text-muted-foreground">Inactive</Badge>
              )}

              <div className="mt-3 w-full flex gap-2">
                <Link href={`/staff/${staff.id}`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8">
                    <ExternalLink className="w-3 h-3" />
                    Profile
                  </Button>
                </Link>
                <Link href={`/staff/${staff.id}/financials`} className="flex-1">
                  <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs h-8 text-primary border-primary/30 hover:bg-primary/5">
                    <BarChart2 className="w-3 h-3" />
                    Financials
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add / Edit Staff Dialog */}
      <Dialog open={staffDialog.open} onOpenChange={(o) => setStaffDialog({ open: o })}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">{isEditing ? "Edit Staff Member" : "New Staff Member"}</DialogTitle>
            <DialogDescription>
              {isEditing ? `Update details for ${staffDialog.staff?.name}.` : "Add a new member to your team."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="s-name">Full Name *</Label>
                <Input id="s-name" placeholder="Sara Ahmed" {...form.register("name", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-role">Role *</Label>
                <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Administrator</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                    <SelectItem value="stylist">Stylist</SelectItem>
                    <SelectItem value="therapist">Therapist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-phone">Phone</Label>
                <Input id="s-phone" placeholder="+971 50 000 0000" {...form.register("phone")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-email">Email * (Login)</Label>
                <Input id="s-email" type="email" placeholder="sara@layalialzahra.com" {...form.register("email", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="s-pw">{isEditing ? "New Password (leave blank to keep)" : "Password *"}</Label>
                <Input id="s-pw" type="password" {...form.register("password", { required: !isEditing })} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Specializations</Label>
              <Input placeholder="Hair coloring, Extensions (comma separated)" {...form.register("specialization")} />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Calendar Color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-10 h-9 p-1 cursor-pointer" {...form.register("color")} />
                  <Input type="text" className="flex-1 font-mono text-sm" {...form.register("color")} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Commission %</Label>
                <Input type="number" min="0" max="100" {...form.register("commissionRate")} />
              </div>
              <div className="space-y-2">
                <Label>Monthly Target AED</Label>
                <Input type="number" min="0" {...form.register("targetMonthly")} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input type="checkbox" id="s-active" className="rounded" {...form.register("isActive")} />
              <Label htmlFor="s-active">Active (can log in and be assigned appointments)</Label>
            </div>

            {/* Permission summary */}
            <div className="bg-muted/40 rounded-md p-3 text-xs text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground mb-1">Permission levels by role:</div>
              <div><span className="font-medium text-purple-600">Admin</span> — Full access: staff, settings, reports, all data</div>
              <div><span className="font-medium text-blue-600">Manager</span> — All except creating new admins; can see all reports</div>
              <div><span className="font-medium text-green-600">Receptionist</span> — Bookings, clients, sales. No staff or reports</div>
              <div><span className="font-medium text-amber-600">Stylist / Therapist</span> — Own calendar and clients only</div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setStaffDialog({ open: false })}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : isEditing ? "Save Changes" : "Add Staff Member"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Staff Member</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{deleteDialog.name}</strong>? Their appointment history will be preserved but they will lose system access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
