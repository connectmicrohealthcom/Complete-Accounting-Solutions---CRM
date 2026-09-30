import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useListServices, getListServicesQueryKey,
  useListServiceCategories, getListServiceCategoriesQueryKey,
  useCreateService, useUpdateService, useDeleteService,
  useCreateServiceCategory
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit2, Trash2, Tag, Clock } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

type ServiceForm = {
  name: string;
  description?: string;
  categoryId: string;
  duration: string;
  price: string;
  isActive: boolean;
};

type CategoryForm = { name: string };

type Service = {
  id: number;
  name: string;
  description?: string;
  categoryId?: number;
  categoryName?: string;
  duration: number;
  price: number;
  isActive: boolean;
};

export default function Services() {
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | undefined>(undefined);
  const [serviceDialog, setServiceDialog] = useState<{ open: boolean; service?: Service }>({ open: false });
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: number; name?: string }>({ open: false });

  const queryClient = useQueryClient();

  const { data: categories, isLoading: isLoadingCategories } = useListServiceCategories({
    query: { queryKey: getListServiceCategoriesQueryKey() }
  });

  const { data: services, isLoading: isLoadingServices } = useListServices(
    { categoryId: selectedCategoryId },
    { query: { queryKey: getListServicesQueryKey({ categoryId: selectedCategoryId }) } }
  );

  const createService = useCreateService();
  const updateService = useUpdateService();
  const deleteService = useDeleteService();
  const createCategory = useCreateServiceCategory();

  const serviceForm = useForm<ServiceForm>({
    defaultValues: { name: "", description: "", categoryId: "", duration: "60", price: "", isActive: true }
  });

  const categoryForm = useForm<CategoryForm>({ defaultValues: { name: "" } });

  const openAddService = () => {
    serviceForm.reset({ name: "", description: "", categoryId: "", duration: "60", price: "", isActive: true });
    setServiceDialog({ open: true });
  };

  const openEditService = (s: Service) => {
    serviceForm.reset({
      name: s.name,
      description: s.description || "",
      categoryId: s.categoryId?.toString() || "",
      duration: s.duration.toString(),
      price: s.price.toString(),
      isActive: s.isActive,
    });
    setServiceDialog({ open: true, service: s });
  };

  const onSubmitService = (data: ServiceForm) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      categoryId: data.categoryId ? parseInt(data.categoryId) : undefined,
      duration: parseInt(data.duration),
      price: parseFloat(data.price),
      isActive: data.isActive,
    };
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
      setServiceDialog({ open: false });
    };
    if (serviceDialog.service) {
      updateService.mutate({ id: serviceDialog.service.id, data: payload }, { onSuccess: invalidate });
    } else {
      createService.mutate({ data: payload }, { onSuccess: invalidate });
    }
  };

  const onSubmitCategory = (data: CategoryForm) => {
    createCategory.mutate({ data: { name: data.name } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServiceCategoriesQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
        categoryForm.reset();
        setCategoryDialog(false);
      }
    });
  };

  const confirmDelete = () => {
    if (!deleteDialog.id) return;
    deleteService.mutate({ id: deleteDialog.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListServicesQueryKey() });
        setDeleteDialog({ open: false });
      }
    });
  };

  const isPending = createService.isPending || updateService.isPending;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Service Menu</h1>
          <p className="text-muted-foreground mt-1">
            {services ? `${services.length} services` : ''} across {categories?.length || 0} categories.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="shrink-0 gap-2" onClick={() => { categoryForm.reset(); setCategoryDialog(true); }}>
            <Plus className="w-4 h-4" />
            New Category
          </Button>
          <Button className="shrink-0 gap-2" onClick={openAddService}>
            <Plus className="w-4 h-4" />
            New Service
          </Button>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
        <Button
          variant={selectedCategoryId === undefined ? "default" : "outline"}
          onClick={() => setSelectedCategoryId(undefined)}
          className="rounded-full snap-start"
        >
          All Services
        </Button>
        {categories?.map((cat) => (
          <Button
            key={cat.id}
            variant={selectedCategoryId === cat.id ? "default" : "outline"}
            onClick={() => setSelectedCategoryId(cat.id)}
            className="rounded-full snap-start whitespace-nowrap"
          >
            {cat.name}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoadingServices ? (
          [...Array(6)].map((_, i) => (
            <Card key={i} className="shadow-sm border-border">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-1/2 mb-2" />
                <Skeleton className="h-4 w-full mb-6" />
                <div className="flex justify-between">
                  <Skeleton className="h-6 w-16" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </CardContent>
            </Card>
          ))
        ) : services?.map((service) => (
          <Card key={service.id} className="shadow-sm border-border flex flex-col hover:border-primary/30 transition-colors group">
            <CardHeader className="pb-2 flex-row items-start justify-between">
              <div className="flex-1 pr-2">
                <CardTitle className="text-base leading-tight">{service.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs font-normal">
                    {service.categoryName || 'Uncategorized'}
                  </Badge>
                  {!service.isActive && (
                    <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                      Inactive
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => openEditService(service as Service)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => setDeleteDialog({ open: true, id: service.id, name: service.name })}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-4 flex-1 flex flex-col">
              {service.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{service.description}</p>
              )}
              <div className="flex items-center justify-between mt-auto pt-3 border-t border-border">
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {service.duration} min
                </span>
                <span className="text-sm font-semibold text-foreground">
                  AED {service.price.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!isLoadingServices && (!services || services.length === 0)) && (
          <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
            <Tag className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-lg font-medium text-foreground">No services found</p>
            <p className="text-sm">Try adjusting your category filter or create a new service.</p>
          </div>
        )}
      </div>

      {/* Add / Edit Service Dialog */}
      <Dialog open={serviceDialog.open} onOpenChange={(o) => setServiceDialog({ open: o })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif">{serviceDialog.service ? "Edit Service" : "New Service"}</DialogTitle>
            <DialogDescription>
              {serviceDialog.service ? "Update service details below." : "Add a new service to the menu."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={serviceForm.handleSubmit(onSubmitService)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="svc-name">Service Name *</Label>
              <Input id="svc-name" placeholder="e.g. Balayage" {...serviceForm.register("name", { required: true })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-cat">Category</Label>
              <Select
                value={serviceForm.watch("categoryId")}
                onValueChange={(v) => serviceForm.setValue("categoryId", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="svc-dur">Duration (mins) *</Label>
                <Input id="svc-dur" type="number" min="5" step="5" {...serviceForm.register("duration", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="svc-price">Price (AED) *</Label>
                <Input id="svc-price" type="number" min="0" step="0.01" {...serviceForm.register("price", { required: true })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="svc-desc">Description</Label>
              <Input id="svc-desc" placeholder="Brief description..." {...serviceForm.register("description")} />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="svc-active"
                className="rounded"
                {...serviceForm.register("isActive")}
              />
              <Label htmlFor="svc-active">Active (visible in bookings)</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setServiceDialog({ open: false })}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : serviceDialog.service ? "Save Changes" : "Create Service"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-serif">New Category</DialogTitle>
            <DialogDescription>Create a new service category.</DialogDescription>
          </DialogHeader>
          <form onSubmit={categoryForm.handleSubmit(onSubmitCategory)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Category Name *</Label>
              <Input id="cat-name" placeholder="e.g. Hair Removal" {...categoryForm.register("name", { required: true })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCategoryDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createCategory.isPending}>
                {createCategory.isPending ? "Creating..." : "Create Category"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Service</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deleteDialog.name}</strong>? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
