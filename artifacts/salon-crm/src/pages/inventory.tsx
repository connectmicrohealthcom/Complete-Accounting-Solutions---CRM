import { useState } from "react";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProducts, getListProductsQueryKey,
  useCreateProduct, useUpdateProduct, useDeleteProduct
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, Package as PackageIcon, AlertTriangle, Edit2, Trash2, Download } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from "@/components/ui/alert-dialog";

type ProductForm = {
  name: string;
  description: string;
  brand: string;
  sku: string;
  stockQuantity: string;
  lowStockThreshold: string;
  costPrice: string;
  price: string;
};

type Product = {
  id: number;
  name: string;
  description?: string | null;
  brand?: string | null;
  sku?: string | null;
  stockQuantity: number;
  lowStockThreshold: number;
  costPrice?: number | null;
  price: number;
};

function exportInventoryCSV(products: Product[]) {
  const rows = [
    ["ID", "Product", "Brand", "SKU", "Stock", "Low Stock Threshold", "Cost Price", "Selling Price"],
    ...products.map(p => [p.id, p.name, p.brand ?? "", p.sku ?? "", p.stockQuantity, p.lowStockThreshold, Number(p.costPrice ?? 0).toFixed(2), Number(p.price).toFixed(2)])
  ];
  const csv = rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = `inventory-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
}

export default function Inventory() {
  const [search, setSearch] = useState("");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [productDialog, setProductDialog] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: number; name?: string }>({ open: false });

  const queryClient = useQueryClient();

  const { data: products, isLoading } = useListProducts(
    { search, lowStock: showLowStockOnly ? true : undefined },
    { query: { queryKey: getListProductsQueryKey({ search, lowStock: showLowStockOnly ? true : undefined }) } }
  );

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const form = useForm<ProductForm>({
    defaultValues: { name: "", description: "", brand: "", sku: "", stockQuantity: "0", lowStockThreshold: "5", costPrice: "", price: "" }
  });

  const openAdd = () => {
    form.reset({ name: "", description: "", brand: "", sku: "", stockQuantity: "0", lowStockThreshold: "5", costPrice: "", price: "" });
    setProductDialog({ open: true });
  };

  const openEdit = (p: Product) => {
    form.reset({
      name: p.name,
      description: p.description || "",
      brand: p.brand || "",
      sku: p.sku || "",
      stockQuantity: p.stockQuantity.toString(),
      lowStockThreshold: p.lowStockThreshold.toString(),
      costPrice: p.costPrice?.toString() || "",
      price: p.price.toString(),
    });
    setProductDialog({ open: true, product: p });
  };

  const onSubmit = (data: ProductForm) => {
    const payload = {
      name: data.name,
      description: data.description || undefined,
      brand: data.brand || undefined,
      sku: data.sku || undefined,
      stockQuantity: parseInt(data.stockQuantity),
      lowStockThreshold: parseInt(data.lowStockThreshold),
      costPrice: data.costPrice ? parseFloat(data.costPrice) : undefined,
      price: parseFloat(data.price),
    };
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
      setProductDialog({ open: false });
    };
    if (productDialog.product) {
      updateProduct.mutate({ id: productDialog.product.id, data: payload }, { onSuccess: invalidate });
    } else {
      createProduct.mutate({ data: payload }, { onSuccess: invalidate });
    }
  };

  const confirmDelete = () => {
    if (!deleteDialog.id) return;
    deleteProduct.mutate({ id: deleteDialog.id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey() });
        setDeleteDialog({ open: false });
      }
    });
  };

  const isPending = createProduct.isPending || updateProduct.isPending;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Inventory</h1>
          <p className="text-muted-foreground mt-1">
            {products ? `${products.length} product${products.length !== 1 ? "s" : ""}` : "Manage retail products and professional stock."}
          </p>
        </div>
        <div className="flex gap-2 shrink-0"><Button variant="outline" className="gap-2" onClick={() => exportInventoryCSV(products ?? [])}><Download className="w-4 h-4" />CSV</Button><Button className="gap-2" onClick={openAdd}>
          <Plus className="w-4 h-4" />
          Add Product
        </Button></div>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <CardTitle className="text-lg">Product Catalog</CardTitle>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                variant={showLowStockOnly ? "destructive" : "outline"}
                size="sm"
                onClick={() => setShowLowStockOnly(!showLowStockOnly)}
                className="whitespace-nowrap"
              >
                <AlertTriangle className="w-3.5 h-3.5 mr-2" />
                Low Stock
              </Button>
              <div className="relative flex-1 sm:w-[250px]">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search products..."
                  className="pl-8 h-9 bg-muted/50"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Product</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Brand</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">SKU</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Stock</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Cost</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Price</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {isLoading ? (
                  [...Array(6)].map((_, i) => (
                    <tr key={i} className="border-b">
                      <td className="p-2"><Skeleton className="h-4 w-40 mb-1" /><Skeleton className="h-3 w-24" /></td>
                      <td className="p-2"><Skeleton className="h-4 w-24" /></td>
                      <td className="p-2"><Skeleton className="h-4 w-20" /></td>
                      <td className="p-2"><Skeleton className="h-6 w-16 ml-auto rounded-full" /></td>
                      <td className="p-2"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="p-2"><Skeleton className="h-4 w-16 ml-auto" /></td>
                      <td className="p-2"><Skeleton className="h-8 w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : (
                  products?.map((product) => {
                    const isLow = product.stockQuantity <= product.lowStockThreshold;
                    return (
                      <tr key={product.id} className="border-b transition-colors hover:bg-muted/50 group">
                        <td className="p-2 align-middle">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-1">{product.description}</div>
                        </td>
                        <td className="p-2 align-middle text-muted-foreground">{product.brand || "—"}</td>
                        <td className="p-2 align-middle text-xs font-mono text-muted-foreground">{product.sku || "—"}</td>
                        <td className="p-2 align-middle text-right">
                          <Badge
                            variant={isLow ? "destructive" : "secondary"}
                            className="font-mono text-xs"
                          >
                            {isLow && <AlertTriangle className="w-3 h-3 mr-1 inline" />}
                            {product.stockQuantity}
                          </Badge>
                        </td>
                        <td className="p-2 align-middle text-right text-muted-foreground text-sm">
                          {product.costPrice ? `AED ${Number(product.costPrice).toFixed(2)}` : "—"}
                        </td>
                        <td className="p-2 align-middle text-right font-medium text-foreground">
                          AED {Number(product.price).toFixed(2)}
                        </td>
                        <td className="p-2 align-middle text-right">
                          <div className="flex gap-1 justify-end">
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => openEdit(product as Product)}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive"
                              onClick={() => setDeleteDialog({ open: true, id: product.id, name: product.name })}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
                {(!isLoading && (!products || products.length === 0)) && (
                  <tr>
                    <td colSpan={7} className="h-32 text-center text-muted-foreground">
                      <PackageIcon className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                      No products found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add / Edit Product Dialog */}
      <Dialog open={productDialog.open} onOpenChange={(o) => setProductDialog({ open: o })}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif">{productDialog.product ? "Edit Product" : "Add Product"}</DialogTitle>
            <DialogDescription>
              {productDialog.product ? "Update product details." : "Add a new product to inventory."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prod-name">Product Name *</Label>
              <Input id="prod-name" placeholder="e.g. Argan Oil Shampoo" {...form.register("name", { required: true })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-brand">Brand</Label>
                <Input id="prod-brand" placeholder="e.g. Moroccanoil" {...form.register("brand")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-sku">SKU</Label>
                <Input id="prod-sku" placeholder="e.g. MO-SH-001" {...form.register("sku")} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prod-desc">Description</Label>
              <Input id="prod-desc" placeholder="Brief description..." {...form.register("description")} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-stock">Stock Quantity *</Label>
                <Input id="prod-stock" type="number" min="0" {...form.register("stockQuantity", { required: true })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-low">Low Stock Alert At</Label>
                <Input id="prod-low" type="number" min="0" {...form.register("lowStockThreshold")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prod-cost">Cost Price (AED)</Label>
                <Input id="prod-cost" type="number" min="0" step="0.01" {...form.register("costPrice")} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prod-price">Selling Price (AED) *</Label>
                <Input id="prod-price" type="number" min="0" step="0.01" {...form.register("price", { required: true })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setProductDialog({ open: false })}>Cancel</Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : productDialog.product ? "Save Changes" : "Add Product"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(o) => setDeleteDialog({ open: o })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Delete <strong>{deleteDialog.name}</strong> from inventory? This cannot be undone.
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
