import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Users, Plus, Download, ChevronRight, Trash2, Edit2, X,
  UserCircle, Star, Clock, Zap, Cake, CreditCard, Gift
} from "lucide-react";
import { format } from "date-fns";

const AUTO_GROUP_ICONS: Record<string, React.ElementType> = {
  "no-sale-30": Clock, "no-sale-60": Clock, "no-sale-90": Clock,
  "new-this-month": Plus, "recent-7": Zap, "vip": Star,
  "high-spenders": Star, "hair-clients": UserCircle, "nail-clients": UserCircle,
  "members": CreditCard, "gift-card": Gift, "birthday-month": Cake,
};

const AUTO_GROUP_COLORS: Record<string, string> = {
  "no-sale-30": "bg-orange-100 text-orange-700",
  "no-sale-60": "bg-orange-100 text-orange-800",
  "no-sale-90": "bg-red-100 text-red-700",
  "new-this-month": "bg-green-100 text-green-700",
  "recent-7": "bg-blue-100 text-blue-700",
  "vip": "bg-purple-100 text-purple-700",
  "high-spenders": "bg-amber-100 text-amber-700",
  "hair-clients": "bg-pink-100 text-pink-700",
  "nail-clients": "bg-pink-100 text-pink-600",
  "members": "bg-indigo-100 text-indigo-700",
  "gift-card": "bg-emerald-100 text-emerald-700",
  "birthday-month": "bg-rose-100 text-rose-700",
};

// ─── Rule Builder Types ───────────────────────────────────────────────────────

type Rule = { field: string; operator: string; value: string };

const RULE_FIELDS = [
  { value: "last_visit_days",    label: "Last visit (days ago)" },
  { value: "total_spend",        label: "Total spend (AED)" },
  { value: "avg_spend_per_visit",label: "Avg spend per visit (AED)" },
  { value: "visit_count",        label: "Number of visits" },
  { value: "client_since",       label: "Client since (date)" },
  { value: "has_wallet",         label: "Has wallet balance" },
  { value: "birthday_month",     label: "Birthday month (1–12)" },
];

const OPERATOR_MAP: Record<string, { value: string; label: string }[]> = {
  last_visit_days:     [{ value: "gt", label: "more than" }, { value: "lt", label: "less than" }],
  total_spend:         [{ value: "gt", label: "greater than" }, { value: "lt", label: "less than" }],
  avg_spend_per_visit: [{ value: "gt", label: "greater than" }, { value: "lt", label: "less than" }],
  visit_count:         [{ value: "gt", label: "more than" }, { value: "lt", label: "less than" }],
  client_since:        [{ value: "after", label: "after" }, { value: "before", label: "before" }],
  has_wallet:          [{ value: "yes", label: "yes" }, { value: "no", label: "no" }],
  birthday_month:      [{ value: "eq", label: "equals" }],
};

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(members: any[], groupName: string) {
  const headers = ["Name", "Phone", "Email", "Last Visit", "Total Spent (AED)", "Visits"];
  const rows = members.map((m) => [
    m.name, m.phone || "", m.email || "",
    m.lastVisit ? format(new Date(m.lastVisit), "yyyy-MM-dd") : "Never",
    Number(m.totalSpent).toFixed(2), m.visitCount,
  ]);
  const csv = [headers, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `${groupName.replace(/\s+/g, "-").toLowerCase()}-${format(new Date(), "yyyy-MM-dd")}.csv`;
  a.click(); URL.revokeObjectURL(url);
}

// ─── Group Members Modal ──────────────────────────────────────────────────────

function GroupMembersModal({ group, onClose }: { group: any; onClose: () => void }) {
  const endpoint = group.type === "auto"
    ? `/api/clients/groups/auto/${group.id}/members`
    : `/api/clients/groups/custom/${group.id}/members`;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["group-members", group.type, group.id],
    queryFn: () => fetch(endpoint).then((r) => r.json()),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-serif flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {group.label ?? group.name}
            <Badge variant="secondary" className="ml-1">{members.length} clients</Badge>
          </DialogTitle>
          <DialogDescription>{group.description ?? "Custom client group"}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end mb-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportCSV(members, group.label ?? group.name)}>
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto border border-border rounded-lg">
          {isLoading ? (
            <div className="p-4 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
          ) : members.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No clients in this group.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Name</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Phone</th>
                  <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Last Visit</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Total Spent</th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold text-muted-foreground uppercase">Visits</th>
                  <th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m: any) => (
                  <tr key={m.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                          {m.name.charAt(0)}
                        </div>
                        {m.name}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.phone || "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {m.lastVisit ? format(new Date(m.lastVisit), "d MMM yyyy") : "Never"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">AED {Number(m.totalSpent).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-center text-muted-foreground">{m.visitCount}</td>
                    <td className="px-4 py-2.5 text-right">
                      <Link href={`/clients/${m.id}`} onClick={onClose}>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                          <ChevronRight className="w-3.5 h-3.5" />
                        </Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Custom Group Builder ─────────────────────────────────────────────────────

function GroupBuilderDialog({ group, onClose }: { group?: any; onClose: () => void }) {
  const [name, setName] = useState(group?.name ?? "");
  const [logic, setLogic] = useState<"AND" | "OR">(group?.logic ?? "AND");
  const [rules, setRules] = useState<Rule[]>(
    group?.rules?.length ? group.rules : [{ field: "last_visit_days", operator: "gt", value: "30" }]
  );
  const { toast } = useToast();
  const qc = useQueryClient();

  const addRule = () => setRules([...rules, { field: "last_visit_days", operator: "gt", value: "30" }]);
  const removeRule = (i: number) => setRules(rules.filter((_, j) => j !== i));
  const setRule = (i: number, key: keyof Rule, val: string) =>
    setRules(rules.map((r, j) => j === i ? { ...r, [key]: val } : r));

  const save = async () => {
    if (!name.trim()) { toast({ title: "Group name is required", variant: "destructive" }); return; }
    const method = group ? "PUT" : "POST";
    const url = group ? `/api/clients/groups/custom/${group.id}` : "/api/clients/groups/custom";
    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, logic, rules }),
    });
    if (r.ok) {
      toast({ title: group ? "Group updated" : "Group created" });
      qc.invalidateQueries({ queryKey: ["custom-groups"] });
      onClose();
    } else {
      toast({ title: "Failed to save group", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-serif">{group ? "Edit Group" : "Create Custom Group"}</DialogTitle>
          <DialogDescription>Define conditions to automatically group matching clients.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>Group Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lapsed VIPs" />
          </div>

          <div className="flex items-center gap-3">
            <Label className="shrink-0">Clients with</Label>
            <Select value={logic} onValueChange={(v) => setLogic(v as "AND" | "OR")}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="AND">ALL of</SelectItem>
                <SelectItem value="OR">ANY of</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">these conditions:</span>
          </div>

          <div className="space-y-2">
            {rules.map((rule, i) => {
              const operators = OPERATOR_MAP[rule.field] ?? [{ value: "gt", label: "greater than" }];
              const showValueInput = !["has_membership", "has_wallet"].includes(rule.field) || rule.operator === "eq";
              return (
                <div key={i} className="flex items-center gap-2 p-3 border border-border rounded-lg bg-muted/20">
                  <Select value={rule.field} onValueChange={(v) => setRule(i, "field", v)}>
                    <SelectTrigger className="flex-1 min-w-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_FIELDS.map((f) => (
                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={rule.operator} onValueChange={(v) => setRule(i, "operator", v)}>
                    <SelectTrigger className="w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {operators.map((op) => (
                        <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {showValueInput && rule.field !== "has_wallet" && (
                    <Input
                      className="w-28"
                      value={rule.value}
                      onChange={(e) => setRule(i, "value", e.target.value)}
                      placeholder="value"
                      type={rule.field === "client_since" ? "date" : "text"}
                    />
                  )}

                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => removeRule(i)}>
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              );
            })}
            <Button variant="outline" size="sm" className="gap-1.5 w-full" onClick={addRule}>
              <Plus className="w-3.5 h-3.5" />
              Add condition
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save}>Save Group</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientGroups() {
  const [viewGroup, setViewGroup] = useState<any | null>(null);
  const [editGroup, setEditGroup] = useState<any | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: autoGroups = [], isLoading: loadingAuto } = useQuery({
    queryKey: ["auto-groups"],
    queryFn: () => fetch("/api/clients/groups/auto").then((r) => r.json()),
  });

  const { data: customGroups = [], isLoading: loadingCustom } = useQuery({
    queryKey: ["custom-groups"],
    queryFn: () => fetch("/api/clients/groups/custom").then((r) => r.json()),
  });

  const deleteGroup = async (id: number) => {
    await fetch(`/api/clients/groups/custom/${id}`, { method: "DELETE" });
    toast({ title: "Group deleted" });
    qc.invalidateQueries({ queryKey: ["custom-groups"] });
  };

  return (
    <div className="space-y-6">
      {/* Auto Groups */}
      <Card className="shadow-sm border-border">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Standard Groups</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Auto-updated from live client data</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {loadingAuto ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <Skeleton className="w-9 h-9 rounded-full" />
                  <div className="flex-1"><Skeleton className="h-4 w-48 mb-1" /><Skeleton className="h-3 w-64" /></div>
                  <Skeleton className="h-6 w-12 rounded-full" />
                </div>
              ))
            ) : (
              autoGroups.map((group: any) => {
                const Icon = AUTO_GROUP_ICONS[group.id] ?? Users;
                const colorClass = AUTO_GROUP_COLORS[group.id] ?? "bg-muted text-muted-foreground";
                return (
                  <div
                    key={group.id}
                    className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => setViewGroup(group)}
                  >
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorClass}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{group.label}</div>
                      <div className="text-xs text-muted-foreground truncate">{group.description}</div>
                    </div>
                    <Badge variant="secondary" className="font-mono shrink-0">{group.count}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      {/* Custom Groups */}
      <Card className="shadow-sm border-border">
        <CardHeader className="border-b border-border pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Custom Segments</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Rule-based groups you define</p>
            </div>
            <Button size="sm" className="gap-1.5" onClick={() => setShowBuilder(true)}>
              <Plus className="w-4 h-4" />
              New Segment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingCustom ? (
            <div className="p-4 space-y-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : customGroups.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <Users className="w-10 h-10 text-muted-foreground mx-auto opacity-40" />
              <p className="text-sm text-muted-foreground">No custom segments yet.</p>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowBuilder(true)}>
                <Plus className="w-3.5 h-3.5" />
                Create your first segment
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {customGroups.map((group: any) => (
                <div
                  key={group.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Filter className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setViewGroup({ ...group, type: "custom" })}>
                    <div className="font-medium text-sm">{group.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {group.rules?.length ?? 0} condition{group.rules?.length !== 1 ? "s" : ""} · {group.logic} logic
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditGroup(group)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => deleteGroup(group.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8"
                      onClick={() => setViewGroup({ ...group, type: "custom" })}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {viewGroup && <GroupMembersModal group={viewGroup} onClose={() => setViewGroup(null)} />}
      {(showBuilder || editGroup) && (
        <GroupBuilderDialog
          group={editGroup}
          onClose={() => { setShowBuilder(false); setEditGroup(null); }}
        />
      )}
    </div>
  );
}

// needed for clients.tsx import
function Filter(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
