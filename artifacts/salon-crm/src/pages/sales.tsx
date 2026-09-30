import { useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListSales, getListSalesQueryKey,
  useCreateSale,
  useListClients, getListClientsQueryKey,
  useListStaff, getListStaffQueryKey,
  useListServices, getListServicesQueryKey,
  useListProducts, getListProductsQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Receipt, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

type SaleItem = {
  type: "service" | "product";
  referenceId?: number;
  name: string;
  quantity: number;
  unitPrice: number;
};

type SaleForm = {
  clientId: string;
  staffId: string;
  paymentMethod: string;
  discount: string;
  tipAmount: string;
  tipStaffId: string;
  notes: string;
};

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
  loyalty_points: "Loyalty Points",
};

export default function Sales() {
  const [paymentMethod, setPaymentMethod] = useState<string>("");
  const [saleDialog, setSaleDialog] = useState(false);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [itemType, setItemType] = useState<"service" | "product">("service");
  const [itemId, setItemId] = useState<string>("");
  const { toast } = useToast();

  const queryClient = useQueryClient();

  const { data, isLoading } = useListSales(
    { paymentMethod: paymentMethod === "all" ? undefined : paymentMethod || undefined },
    { query: { queryKey: getListSalesQueryKey({ paymentMethod: paymentMethod === "all" ? undefined : paymentMethod || undefined }) } }
  );

  const { data: clients } = useListClients({ limit: 500 }, { query: { queryKey: getListClientsQueryKey({ limit: 500 }), enabled: saleDialog } });
  const { data: staff } = useListStaff({ query: { queryKey: getListStaffQueryKey(), enabled: saleDialog } });
  const { data: services } = useListServices({}, { query: { enabled: saleDialog, queryKey: getListServicesQueryKey({}) } });
  const { data: products } = useListProducts({}, { query: { enabled: saleDialog, queryKey: getListProductsQueryKey({}) } });

  const createSale = useCreateSale();

  const form = useForm<SaleForm>({
    defaultValues: { clientId: "", staffId: "", paymentMethod: "cash", discount: "0", tipAmount: "0", tipStaffId: "", notes: "" }
  });

  const openNew = () => {
    form.reset({ clientId: "", staffId: "", paymentMethod: "cash", discount: "0", tipAmount: "0", tipStaffId: "", notes: "" });
    setItems([]);
    setItemId("");
    setSaleDialog(true);
  };

  const addItem = () => {
    if (!itemId) return;
    if (itemType === "service") {
      const svc = services?.find((s: any) => s.id.toString() === itemId);
      if (!svc) return;
      setItems((prev) => {
        const existing = prev.findIndex((i) => i.type === "service" && i.referenceId === svc.id);
        if (existing >= 0) { const updated = [...prev]; updated[existing].quantity += 1; return updated; }
        return [...prev, { type: "service", referenceId: svc.id, name: svc.name, quantity: 1, unitPrice: svc.price }];
      });
    } else {
      const prod = products?.find((p: any) => p.id.toString() === itemId);
      if (!prod) return;
      setItems((prev) => {
        const existing = prev.findIndex((i) => i.type === "product" && i.referenceId === prod.id);
        if (existing >= 0) { const updated = [...prev]; updated[existing].quantity += 1; return updated; }
        return [...prev, { type: "product", referenceId: prod.id, name: prod.name, quantity: 1, unitPrice: Number(prod.price) }];
      });
    }
    setItemId("");
  };

  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
  const discount = parseFloat(form.watch("discount") || "0") || 0;
  const tipAmount = parseFloat(form.watch("tipAmount") || "0") || 0;
  const total = Math.max(0, subtotal - discount);

  const onSubmit = async (data: SaleForm) => {
    if (items.length === 0) return;
    createSale.mutate({
      data: {
        clientId: data.clientId ? parseInt(data.clientId) : undefined,
        staffId: parseInt(data.staffId),
        paymentMethod: data.paymentMethod as "cash" | "card" | "bank_transfer" | "loyalty_points",
        discount,
        notes: data.notes || undefined,
        items: items.map((i) => ({
          type: i.type,
          referenceId: i.referenceId,
          name: i.name,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.unitPrice * i.quantity,
        })),
      }
    }, {
      onSuccess: async (sale: any) => {
        if (tipAmount > 0 && data.tipStaffId) {
          await fetch(`${API_BASE_URL}/api/tips`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              saleId: sale.id,
              staffId: parseInt(data.tipStaffId),
              clientId: data.clientId ? parseInt(data.clientId) : null,
              amount: tipAmount,
              note: `Tip from sale #${sale.id}`,
            }),
          });
        }
        queryClient.invalidateQueries({ queryKey: getListSalesQueryKey() });
        toast({ title: "Sale completed" + (tipAmount > 0 ? ` — Tip: AED ${tipAmount.toFixed(2)}` : "") });
        setSaleDialog(false);
      }
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Sales & Transactions</h1>
          <p className="text-muted-foreground mt-1">Review receipts and daily revenue.</p>
        </div>
        <Button className="shrink-0 gap-2" onClick={openNew}>
          <Plus className="w-4 h-4" />
          New Sale
        </Button>
      </div>

      <Card className="shadow-sm border-border">
        <CardHeader className="pb-4 flex-row items-center justify-between">
          <CardTitle className="text-lg">Recent Transactions</CardTitle>
          <div className="w-[180px]">
            <Select value={paymentMethod} onValueChange={setPaymentMethod}>
              <SelectTrigger className="h-9"><SelectValue placeholder="Payment Method" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Methods</SelectItem>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="card">Card</SelectItem>
                <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                <SelectItem value="loyalty_points">Loyalty Points</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">ID / Date</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Client</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Staff</th>
                  <th className="h-10 px-2 text-left align-middle font-medium text-muted-foreground">Method</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Subtotal</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Discount</th>
                  <th className="h-10 px-2 text-right align-middle font-medium text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="border-b">
                      {[...Array(7)].map((_, j) => <td key={j} className="p-2"><Skeleton className="h-4 w-full" /></td>)}
                    </tr>
                  ))
                ) : (
                  data?.sales.map((sale: any) => (
                    <tr key={sale.id} className="border-b transition-colors hover:bg-muted/50 cursor-pointer">
                      <td className="p-2 align-middle">
                        <div className="font-medium">#{sale.id.toString().padStart(6, "0")}</div>
                        <div className="text-xs text-muted-foreground">{format(new Date(sale.createdAt), "MMM d, yyyy h:mm a")}</div>
                      </td>
                      <td className="p-2 align-middle font-medium">{sale.clientName || "Walk-in"}</td>
                      <td className="p-2 align-middle text-muted-foreground">{sale.staffName}</td>
                      <td className="p-2 align-middle">
                        <Badge variant="outline" className="capitalize text-xs font-normal">{METHOD_LABELS[sale.paymentMethod] || sale.paymentMethod}</Badge>
                      </td>
                      <td className="p-2 align-middle text-right text-muted-foreground">AED {Number(sale.subtotal).toFixed(2)}</td>
                      <td className="p-2 align-middle text-right text-muted-foreground">{Number(sale.discount) > 0 ? `-AED ${Number(sale.discount).toFixed(2)}` : "—"}</td>
                      <td className="p-2 align-middle text-right font-medium text-foreground">AED {Number(sale.total).toFixed(2)}</td>
                    </tr>
                  ))
                )}
                {!isLoading && (!data?.sales || data.sales.length === 0) && (
                  <tr>
                    <td colSpan={7} className="h-32 text-center text-muted-foreground">
                      <Receipt className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                      No transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* New Sale Dialog */}
      <Dialog open={saleDialog} onOpenChange={setSaleDialog}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-serif">New Sale</DialogTitle>
            <DialogDescription>Create a new transaction. Add services and/or products.</DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Client (optional)</Label>
                <Select value={form.watch("clientId")} onValueChange={(v) => form.setValue("clientId", v)}>
                  <SelectTrigger><SelectValue placeholder="Walk-in / select client" /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    {clients?.clients?.map((c: any) => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Staff Member *</Label>
                <Select value={form.watch("staffId")} onValueChange={(v) => form.setValue("staffId", v)}>
                  <SelectTrigger><SelectValue placeholder="Who served?" /></SelectTrigger>
                  <SelectContent>
                    {staff?.map((s: any) => (
                      <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Item Adder */}
            <div className="space-y-3 border border-border rounded-lg p-4">
              <h4 className="text-sm font-semibold">Add Items</h4>
              <div className="flex gap-2">
                <Select value={itemType} onValueChange={(v) => { setItemType(v as "service" | "product"); setItemId(""); }}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="service">Service</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={itemId} onValueChange={setItemId}>
                  <SelectTrigger className="flex-1"><SelectValue placeholder={`Select ${itemType}...`} /></SelectTrigger>
                  <SelectContent className="max-h-56">
                    {itemType === "service"
                      ? services?.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name} — AED {s.price}</SelectItem>)
                      : products?.map((p: any) => <SelectItem key={p.id} value={p.id.toString()}>{p.name} — AED {p.price}</SelectItem>)
                    }
                  </SelectContent>
                </Select>
                <Button type="button" variant="outline" onClick={addItem} disabled={!itemId}><Plus className="w-4 h-4" /></Button>
              </div>

              {items.length > 0 ? (
                <div className="space-y-2 mt-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm bg-muted/30 rounded-md p-2">
                      <Badge variant="outline" className="text-xs shrink-0">{item.type === "service" ? "Svc" : "Prod"}</Badge>
                      <span className="flex-1 truncate">{item.name}</span>
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))}>−</Button>
                        <span className="w-5 text-center font-medium">{item.quantity}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => setItems((prev) => prev.map((i, j) => j === idx ? { ...i, quantity: i.quantity + 1 } : i))}>+</Button>
                      </div>
                      <span className="font-medium w-20 text-right">AED {(item.unitPrice * item.quantity).toFixed(0)}</span>
                      <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground text-center py-3">No items added yet.</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Payment Method *</Label>
                <Select value={form.watch("paymentMethod")} onValueChange={(v) => form.setValue("paymentMethod", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="loyalty_points">Loyalty Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sale-discount">Discount (AED)</Label>
                <Input id="sale-discount" type="number" min="0" step="0.01" {...form.register("discount")} />
              </div>
            </div>

            {/* Tips Section */}
            <div className="border border-border rounded-lg p-4 space-y-3 bg-amber-50/40">
              <h4 className="text-sm font-semibold text-foreground">Tip (Optional)</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tip-amount">Tip Amount (AED)</Label>
                  <Input id="tip-amount" type="number" min="0" step="0.01" placeholder="0.00" {...form.register("tipAmount")} />
                </div>
                <div className="space-y-2">
                  <Label>Tip For Staff</Label>
                  <Select value={form.watch("tipStaffId")} onValueChange={(v) => form.setValue("tipStaffId", v)}>
                    <SelectTrigger><SelectValue placeholder="Select staff..." /></SelectTrigger>
                    <SelectContent>
                      {staff?.map((s: any) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sale-notes">Notes</Label>
              <Input id="sale-notes" placeholder="Any notes for this sale..." {...form.register("notes")} />
            </div>

            {/* Total Summary */}
            <div className="border border-border rounded-lg p-4 space-y-1.5 bg-muted/20">
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>AED {subtotal.toFixed(2)}</span></div>
              {discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span className="text-destructive">− AED {discount.toFixed(2)}</span></div>}
              {tipAmount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tip</span><span className="text-amber-600">+ AED {tipAmount.toFixed(2)}</span></div>}
              <div className="flex justify-between font-semibold pt-1.5 border-t border-border"><span>Total (excl. tip)</span><span>AED {total.toFixed(2)}</span></div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSaleDialog(false)}>Cancel</Button>
              <Button type="submit" disabled={createSale.isPending || items.length === 0 || !form.watch("staffId")}>
                {createSale.isPending ? "Processing..." : `Complete Sale — AED ${total.toFixed(2)}`}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
