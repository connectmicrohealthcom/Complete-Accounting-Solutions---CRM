import { useListClients, getListClientsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Link } from "wouter";
import { Search, Plus, UserCircle, Users } from "lucide-react";
import { format } from "date-fns";
import ClientGroups from "./client-groups";

export default function Clients() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useListClients({ search, limit: 100 }, {
    query: { queryKey: getListClientsQueryKey({ search, limit: 100 }) }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">
            {data ? `${data.total} clients` : "Manage client profiles, history, and loyalty."}
          </p>
        </div>
        <Link href="/clients/new">
          <Button className="shrink-0 gap-2">
            <Plus className="w-4 h-4" />
            New Client
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="all">
        <TabsList className="mb-4">
          <TabsTrigger value="all" className="gap-2">
            <UserCircle className="w-4 h-4" />
            All Clients
          </TabsTrigger>
          <TabsTrigger value="groups" className="gap-2">
            <Users className="w-4 h-4" />
            Client Groups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <Card className="shadow-sm border-border">
            <CardHeader className="pb-4">
              <div className="flex flex-wrap gap-4 items-center justify-between">
                <CardTitle className="text-lg">Client Directory</CardTitle>
                <div className="relative w-full max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search by name, email or phone..."
                    className="pl-8 bg-muted/50"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative w-full overflow-auto">
                <table className="w-full caption-bottom text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground w-10"></th>
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Name</th>
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Contact</th>
                      <th className="h-10 px-3 text-left align-middle font-medium text-muted-foreground">Last Visit</th>
                      <th className="h-10 px-3 text-right align-middle font-medium text-muted-foreground">Total Spent</th>
                      <th className="h-10 px-3 text-center align-middle font-medium text-muted-foreground">Visits</th>
                      <th className="h-10 px-3 text-center align-middle font-medium text-muted-foreground">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading ? (
                      [...Array(8)].map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td className="px-3 py-3"><Skeleton className="h-8 w-8 rounded-full" /></td>
                          <td className="px-3 py-3"><Skeleton className="h-4 w-32" /></td>
                          <td className="px-3 py-3"><Skeleton className="h-4 w-36" /></td>
                          <td className="px-3 py-3"><Skeleton className="h-4 w-24" /></td>
                          <td className="px-3 py-3"><Skeleton className="h-4 w-20" /></td>
                          <td className="px-3 py-3"><Skeleton className="h-4 w-10 mx-auto" /></td>
                          <td className="px-3 py-3"><Skeleton className="h-6 w-16 mx-auto rounded-full" /></td>
                        </tr>
                      ))
                    ) : (
                      data?.clients.map((client) => (
                        <Link key={client.id} href={`/clients/${client.id}`} asChild>
                          <tr className="border-b border-border transition-colors hover:bg-muted/40 cursor-pointer">
                            <td className="px-3 py-3 align-middle">
                              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">
                                {client.name.charAt(0)}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-middle">
                              <div className="font-medium">{client.name}</div>
                              {client.tags && client.tags.length > 0 && (
                                <div className="flex gap-1 mt-1 flex-wrap">
                                  {client.tags.map((tag: string) => (
                                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{tag}</span>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-3 align-middle text-muted-foreground">
                              <div className="text-xs">{client.email || "—"}</div>
                              <div className="text-xs">{client.phone || "—"}</div>
                            </td>
                            <td className="px-3 py-3 align-middle text-sm text-muted-foreground">
                              {client.lastVisit ? format(new Date(client.lastVisit), "MMM d, yyyy") : "Never"}
                            </td>
                            <td className="px-3 py-3 align-middle text-right font-medium">
                              AED {Number(client.totalSpent).toFixed(2)}
                            </td>
                            <td className="px-3 py-3 align-middle text-center text-sm text-muted-foreground">
                              {client.visitCount}
                            </td>
                            <td className="px-3 py-3 align-middle text-center">
                              <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                                {client.loyaltyPoints || 0} pts
                              </Badge>
                            </td>
                          </tr>
                        </Link>
                      ))
                    )}
                    {!isLoading && (!data?.clients || data.clients.length === 0) && (
                      <tr>
                        <td colSpan={7} className="h-24 text-center text-muted-foreground text-sm">
                          No clients found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups">
          <ClientGroups />
        </TabsContent>
      </Tabs>
    </div>
  );
}
