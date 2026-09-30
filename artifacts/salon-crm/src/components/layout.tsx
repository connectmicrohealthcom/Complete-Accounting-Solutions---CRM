import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useGetMe, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  Scissors,
  UserCircle,
  CreditCard,
  Package,
  HeartHandshake,
  Settings,
  LogOut,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Calendar,
  ClipboardList,
  UserPlus,
  BarChart2,
  ShoppingCart,
  Warehouse,
  Gift,
  DollarSign,
  Banknote,
  ReceiptText,
  PieChart,
  type LucideIcon,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────

type SubItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;           // direct-navigate (no sub-panel)
  matchPaths: string[];    // paths that make this group "active"
  sub?: SubItem[];
};

// ─── Navigation Definition ─────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
    matchPaths: ["/dashboard", "/"],
  },
  {
    id: "appointments",
    label: "Appointments",
    icon: CalendarDays,
    matchPaths: ["/calendar", "/appointments"],
    sub: [
      { href: "/calendar", label: "Calendar", icon: Calendar },
      { href: "/appointments?tab=list", label: "Appointment List", icon: ClipboardList },
      { href: "/appointments?tab=summary", label: "Summary & Analytics", icon: BarChart2 },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    matchPaths: ["/clients"],
    sub: [
      { href: "/clients", label: "All Clients", icon: Users },
      { href: "/clients/new", label: "New Client", icon: UserPlus },
    ],
  },
  {
    id: "services",
    label: "Services",
    icon: Sparkles,
    matchPaths: ["/services"],
    sub: [
      { href: "/services", label: "Service Catalog", icon: Scissors },
    ],
  },
  {
    id: "staff",
    label: "Staff",
    icon: UserCircle,
    matchPaths: ["/staff", "/payroll", "/tips"],
    sub: [
      { href: "/staff",    label: "Staff Directory",  icon: UserCircle   },
      { href: "/payroll",  label: "Payroll Overview",  icon: Banknote     },
      { href: "/tips",     label: "Tips Dashboard",    icon: DollarSign   },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: CreditCard,
    matchPaths: ["/sales", "/inventory"],
    sub: [
      { href: "/sales", label: "POS & Sales", icon: ShoppingCart },
      { href: "/inventory", label: "Inventory", icon: Warehouse },
    ],
  },
  {
    id: "loyalty",
    label: "Loyalty",
    icon: HeartHandshake,
    matchPaths: ["/loyalty"],
    sub: [
      { href: "/loyalty", label: "Packages & Loyalty", icon: Gift },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    icon: PieChart,
    matchPaths: ["/finance"],
    sub: [
      { href: "/finance/payments", label: "Payment Summary", icon: CreditCard },
      { href: "/finance/expenses", label: "Expense Tracker", icon: ReceiptText },
      { href: "/finance/reports",  label: "Financial Reports", icon: BarChart2 },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart2,
    matchPaths: ["/reports", "/analytics"],
    sub: [
      { href: "/dashboard", label: "Analytics Overview", icon: BarChart2 },
      { href: "/staff", label: "Staff Performance", icon: UserCircle, soon: true },
      { href: "/loyalty", label: "Loyalty Reports", icon: HeartHandshake, soon: true },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: Settings,
    href: "/settings",
    matchPaths: ["/settings"],
  },
];

// Flat nav for expanded mode (current behaviour — all items visible)
const FLAT_NAV = [
  { href: "/dashboard",    label: "Dashboard",    icon: LayoutDashboard  },
  { href: "/calendar",     label: "Calendar",     icon: Calendar         },
  { href: "/appointments", label: "Appointments", icon: ClipboardList    },
  { href: "/clients",      label: "Clients",      icon: Users            },
  { href: "/services",     label: "Services",     icon: Sparkles         },
  { href: "/staff",        label: "Staff",        icon: UserCircle       },
  { href: "/payroll",      label: "Payroll",      icon: Banknote         },
  { href: "/tips",         label: "Tips",         icon: DollarSign       },
  { href: "/sales",        label: "Sales & POS",  icon: CreditCard       },
  { href: "/inventory",    label: "Inventory",    icon: Package          },
  { href: "/loyalty",           label: "Loyalty",          icon: HeartHandshake   },
  { href: "/finance/payments",  label: "Payments",         icon: CreditCard       },
  { href: "/finance/expenses",  label: "Expenses",         icon: ReceiptText      },
  { href: "/finance/reports",   label: "Fin. Reports",     icon: PieChart         },
  { href: "/settings",          label: "Settings",         icon: Settings         },
];

const STORAGE_KEY = "layal-sidebar-collapsed";

// ─── Secondary Panel ────────────────────────────────────────────────────────

function SecondaryPanel({
  group,
  onClose,
}: {
  group: NavGroup;
  onClose: () => void;
}) {
  const [location] = useLocation();
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Slight delay so the click that opened the panel doesn't immediately close it
    const timer = setTimeout(() => document.addEventListener("mousedown", handler), 50);
    return () => { clearTimeout(timer); document.removeEventListener("mousedown", handler); };
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="fixed top-0 left-16 h-screen w-52 bg-card border-r border-border shadow-xl z-40
                 animate-in slide-in-from-left-2 fade-in duration-200"
    >
      {/* Panel header */}
      <div className="px-4 py-5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <group.icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">{group.label}</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sub-items */}
      <nav className="p-2 space-y-0.5">
        {group.sub?.map((item) => {
          const isActive = location.startsWith(item.href) && !item.soon;
          return (
            <div key={item.href}>
              {item.soon ? (
                <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-muted-foreground/50 cursor-default select-none">
                  <item.icon className="w-4 h-4 shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <span className="text-[10px] font-medium bg-muted px-1.5 py-0.5 rounded text-muted-foreground">Soon</span>
                </div>
              ) : (
                <Link href={item.href} onClick={onClose}>
                  <div className={cn(
                    "flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}>
                    <item.icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                </Link>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}

// ─── Main Layout ────────────────────────────────────────────────────────────

export function Layout({ children }: { children: React.ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe();
  const logout = useLogout();

  // Sidebar collapsed state — persisted in sessionStorage
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return sessionStorage.getItem(STORAGE_KEY) === "true"; } catch { return false; }
  });

  // On mobile, default to collapsed
  const [isMobile, setIsMobile] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Which group's secondary panel is open (collapsed mode)
  const [openPanel, setOpenPanel] = useState<string | null>(null);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) setCollapsed(true);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try { sessionStorage.setItem(STORAGE_KEY, String(next)); } catch {}
      if (!next) setOpenPanel(null); // close panel when expanding
      return next;
    });
  }, []);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => setLocation("/login") });
  };

  const handleGroupClick = (group: NavGroup) => {
    if (group.href) {
      // Direct navigation
      setOpenPanel(null);
      if (isMobile) setMobileOpen(false);
      setLocation(group.href);
    } else {
      // Toggle secondary panel
      setOpenPanel(prev => prev === group.id ? null : group.id);
    }
  };

  const isGroupActive = (group: NavGroup) =>
    group.matchPaths.some(p => location.startsWith(p));

  const userInitials = user?.name
    ?.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

  // ── Collapsed sidebar (icon-only) ──────────────────────────────────────

  const collapsedSidebar = (
    <aside
      className={cn(
        "w-16 border-r border-border bg-card flex flex-col h-screen flex-shrink-0",
        "transition-all duration-250 ease-in-out z-30",
        isMobile && "fixed top-0 left-0",
        isMobile && !mobileOpen && "-translate-x-full"
      )}
    >
      {/* Logo mark */}
      <div className="h-14 flex items-center justify-center border-b border-border flex-shrink-0">
        <div className="w-8 h-8 bg-primary rounded flex items-center justify-center">
          <span className="text-primary-foreground font-serif font-bold text-lg leading-none">L</span>
        </div>
      </div>

      {/* Nav icons */}
      <nav className="flex-1 flex flex-col items-center py-3 gap-1 overflow-y-auto">
        {NAV_GROUPS.map((group) => {
          const isActive = isGroupActive(group);
          const isPanelOpen = openPanel === group.id;
          return (
            <button
              key={group.id}
              onClick={() => handleGroupClick(group)}
              title={group.label}
              className={cn(
                "relative w-10 h-10 flex items-center justify-center rounded-lg transition-all duration-150 group",
                isActive || isPanelOpen
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <group.icon className="w-5 h-5" />

              {/* Tooltip on hover (only if panel not open) */}
              {!isPanelOpen && (
                <div className="pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2
                                bg-popover border border-border text-popover-foreground text-xs font-medium
                                px-2.5 py-1.5 rounded-md shadow-md whitespace-nowrap
                                opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50">
                  {group.label}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-border" />
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* User avatar + toggle */}
      <div className="flex flex-col items-center gap-2 pb-3 pt-2 border-t border-border flex-shrink-0">
        <button
          title={user?.name || "User"}
          className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold hover:bg-primary/20 transition-colors"
        >
          {userInitials}
        </button>
        <button
          onClick={handleLogout}
          title="Sign out"
          className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors rounded-md hover:bg-muted"
        >
          <LogOut className="w-4 h-4" />
        </button>
        {!isMobile && (
          <button
            onClick={toggleCollapsed}
            title="Expand sidebar"
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-muted"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Secondary panel */}
      {openPanel && (() => {
        const group = NAV_GROUPS.find(g => g.id === openPanel);
        if (!group || !group.sub?.length) return null;
        return (
          <SecondaryPanel
            group={group}
            onClose={() => setOpenPanel(null)}
          />
        );
      })()}
    </aside>
  );

  // ── Expanded sidebar ────────────────────────────────────────────────────

  const expandedSidebar = (
    <aside
      className={cn(
        "w-64 border-r border-border bg-card flex flex-col h-screen flex-shrink-0",
        "transition-all duration-250 ease-in-out z-30",
        isMobile && "fixed top-0 left-0",
        isMobile && !mobileOpen && "-translate-x-full"
      )}
    >
      {/* Logo + brand */}
      <div className="h-14 px-5 flex items-center gap-3 border-b border-border flex-shrink-0">
        <div className="w-7 h-7 bg-primary rounded flex items-center justify-center flex-shrink-0">
          <span className="text-primary-foreground font-serif font-bold text-base leading-none">L</span>
        </div>
        <h1 className="font-serif font-semibold text-base tracking-wide text-foreground truncate">
          Layal Al Zahra
        </h1>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        {FLAT_NAV.map((item) => {
          const isActive = item.href === "/dashboard"
            ? location === "/dashboard" || location === "/"
            : location === item.href || location.startsWith(item.href + "/");
          return (
            <Link key={item.href} href={item.href}>
              <div
                onClick={() => isMobile && setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className={cn("w-4 h-4 shrink-0", isActive ? "opacity-100" : "opacity-70")} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      {/* User + controls */}
      <div className="px-3 pb-3 pt-2 border-t border-border flex-shrink-0 space-y-1">
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold flex-shrink-0">
            {userInitials}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">{user?.name}</span>
            <span className="text-[10px] text-muted-foreground capitalize">{user?.role}</span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-muted-foreground hover:text-foreground text-xs h-8"
          onClick={handleLogout}
          disabled={logout.isPending}
        >
          <LogOut className="w-3.5 h-3.5 mr-2" />
          Sign Out
        </Button>
        {!isMobile && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground text-xs h-8"
            onClick={toggleCollapsed}
          >
            <ChevronLeft className="w-3.5 h-3.5 mr-2" />
            Collapse sidebar
          </Button>
        )}
      </div>
    </aside>
  );

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-screen bg-background overflow-hidden">

      {/* Mobile overlay backdrop */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 animate-in fade-in duration-200"
          onClick={() => { setMobileOpen(false); setOpenPanel(null); }}
        />
      )}

      {/* Sidebar */}
      {collapsed ? collapsedSidebar : expandedSidebar}

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden min-w-0">
        {/* Mobile top bar */}
        {isMobile && (
          <div className="h-14 flex items-center px-4 border-b border-border bg-card flex-shrink-0 gap-3">
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-primary rounded flex items-center justify-center">
                <span className="text-primary-foreground font-serif font-bold text-sm leading-none">L</span>
              </div>
              <span className="font-serif font-semibold text-sm text-foreground">Layal Al Zahra</span>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-background/50">
          <div className="p-6 md:p-8 max-w-[1600px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
