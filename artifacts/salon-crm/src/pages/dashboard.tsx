import { useQuery } from "@tanstack/react-query";
import { 
  useGetDashboardSummary, getGetDashboardSummaryQueryKey,
  useGetRevenueChart, getGetRevenueChartQueryKey,
  useGetTopServices, getGetTopServicesQueryKey,
  useGetUpcomingAppointments, getGetUpcomingAppointmentsQueryKey
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { ArrowUpRight, ArrowDownRight, Users, Calendar, DollarSign, AlertTriangle, Clock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";

export default function Dashboard() {
  const [chartPeriod, setChartPeriod] = useState<"week" | "month" | "year">("week");

  const { data: summary, isLoading: isLoadingSummary } = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey() }
  });

  const { data: chartData, isLoading: isLoadingChart } = useGetRevenueChart({ period: chartPeriod }, {
    query: { queryKey: getGetRevenueChartQueryKey({ period: chartPeriod }) }
  });

  const { data: topServices, isLoading: isLoadingTopServices } = useGetTopServices({
    query: { queryKey: getGetTopServicesQueryKey() }
  });

  const { data: upcoming, isLoading: isLoadingUpcoming } = useGetUpcomingAppointments({
    query: { queryKey: getGetUpcomingAppointmentsQueryKey() }
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening at your salon today.</p>
        </div>
        <div className="text-sm font-medium text-muted-foreground">
          {format(new Date(), "EEEE, MMMM do, yyyy")}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Today's Revenue"
          value={isLoadingSummary ? null : `AED ${summary?.todayRevenue.toFixed(2)}`}
          icon={<DollarSign className="w-4 h-4 text-primary" />}
          trend="+12% from yesterday"
          trendUp={true}
        />
        <MetricCard
          title="Appointments Today"
          value={isLoadingSummary ? null : summary?.todayAppointments}
          icon={<Calendar className="w-4 h-4 text-primary" />}
          description={`${summary?.completedToday || 0} completed, ${summary?.pendingAppointments || 0} pending`}
        />
        <MetricCard
          title="New Clients"
          value={isLoadingSummary ? null : summary?.newClients}
          icon={<Users className="w-4 h-4 text-primary" />}
          description={`Out of ${summary?.totalClients || 0} total clients`}
        />
        <MetricCard
          title="Low Stock Alerts"
          value={isLoadingSummary ? null : summary?.lowStockCount}
          icon={<AlertTriangle className="w-4 h-4 text-destructive" />}
          description="Products below threshold"
          alert={summary?.lowStockCount ? summary.lowStockCount > 0 : false}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart */}
        <Card className="lg:col-span-2 shadow-sm border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="space-y-1">
              <CardTitle className="text-lg">Revenue Overview</CardTitle>
              <CardDescription>Financial performance over time</CardDescription>
            </div>
            <Select value={chartPeriod} onValueChange={(v: "week" | "month" | "year") => setChartPeriod(v)}>
              <SelectTrigger className="w-[120px] h-8">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="week">This Week</SelectItem>
                <SelectItem value="month">This Month</SelectItem>
                <SelectItem value="year">This Year</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoadingChart ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="w-full h-full rounded-md" />
              </div>
            ) : (
              <div className="h-[300px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="label" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(value) => `AED ${value}`}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: "hsl(var(--card))", 
                        borderColor: "hsl(var(--border))",
                        borderRadius: "var(--radius)",
                        boxShadow: "var(--shadow-sm)"
                      }}
                      formatter={(value: number) => [`AED ${value.toFixed(2)}`, 'Revenue']}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="revenue" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#colorRevenue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card className="shadow-sm border-border">
          <CardHeader>
            <CardTitle className="text-lg">Top Services</CardTitle>
            <CardDescription>Most popular services by revenue</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingTopServices ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="w-full h-12 rounded-md" />
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {topServices?.map((service, index) => (
                  <div key={service.serviceId} className="flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        {index + 1}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{service.serviceName}</p>
                        <p className="text-xs text-muted-foreground">{service.count} bookings</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">AED {service.revenue}</p>
                    </div>
                  </div>
                ))}
                {(!topServices || topServices.length === 0) && (
                  <div className="text-center py-6 text-sm text-muted-foreground">
                    No data available
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Appointments */}
      <Card className="shadow-sm border-border">
        <CardHeader>
          <CardTitle className="text-lg">Upcoming Appointments</CardTitle>
          <CardDescription>Next appointments for today</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUpcoming ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="w-full h-16 rounded-md" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcoming?.map((apt) => (
                <div key={apt.id} className="flex items-start gap-4 p-4 rounded-lg border border-border bg-card hover:border-primary/30 transition-colors">
                  <div className="flex flex-col items-center justify-center w-12 h-12 rounded-md bg-muted text-foreground flex-shrink-0">
                    <Clock className="w-4 h-4 mb-1 text-muted-foreground" />
                    <span className="text-xs font-semibold">{apt.startTime.substring(0, 5)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{apt.clientName}</p>
                    <p className="text-xs text-muted-foreground truncate">{apt.serviceName}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full bg-secondary/10 text-secondary">
                        <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                        {apt.staffName}
                      </div>
                      <Badge variant="outline" className="text-[10px] uppercase font-semibold h-5">
                        {apt.status.replace('_', ' ')}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
              {(!upcoming || upcoming.length === 0) && (
                <div className="col-span-full text-center py-8 text-sm text-muted-foreground">
                  No upcoming appointments today
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({ title, value, description, trend, trendUp, icon, alert }: { 
  title: string, 
  value: string | number | null | undefined, 
  description?: string,
  trend?: string,
  trendUp?: boolean,
  icon: React.ReactNode,
  alert?: boolean
}) {
  return (
    <Card className={`shadow-sm border-border ${alert ? 'border-destructive/50 bg-destructive/5' : ''}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-y-0 pb-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
            {icon}
          </div>
        </div>
        <div>
          {value === null || value === undefined ? (
            <Skeleton className="h-8 w-24 mt-1 mb-2" />
          ) : (
            <div className={`text-2xl font-bold tracking-tight ${alert ? 'text-destructive' : ''}`}>{value}</div>
          )}
          
          {(trend || description) && (
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              {trend && (
                <span className={`flex items-center mr-2 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
                  {trendUp ? <ArrowUpRight className="w-3 h-3 mr-1" /> : <ArrowDownRight className="w-3 h-3 mr-1" />}
                  {trend}
                </span>
              )}
              {description}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
