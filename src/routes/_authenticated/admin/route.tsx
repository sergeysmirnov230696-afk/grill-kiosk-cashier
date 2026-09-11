import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { BarChart3, Boxes, LogOut, Package, Settings, ShoppingCart, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

const NAV = [
  { to: "/admin", label: "Отчёты", icon: BarChart3 },
  { to: "/admin/products", label: "Товары", icon: Package },
  { to: "/admin/stock", label: "Склад", icon: Boxes },
  { to: "/admin/orders", label: "Чеки и смены", icon: ShoppingCart },
  { to: "/admin/employees", label: "Сотрудники", icon: Users },
  { to: "/admin/settings", label: "Настройки", icon: Settings },
] as const;

function AdminLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <Link to="/" className="mr-2 font-bold">
          Гриль &amp; Донер
        </Link>
        <nav className="flex flex-wrap gap-1">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              activeOptions={{ exact: n.to === "/admin" }}
              activeProps={{ className: "bg-primary text-primary-foreground" }}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted"
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/pos">Касса</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={signOut}>
            <LogOut className="size-4" />
          </Button>
        </div>
      </header>
      <main className="p-4">
        <Outlet />
      </main>
    </div>
  );
}
