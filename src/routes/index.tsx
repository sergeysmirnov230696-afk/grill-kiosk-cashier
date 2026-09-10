import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, ShoppingCart, Settings2, LogIn } from "lucide-react";
import { useSession } from "@/lib/use-session";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "POS-система для куры гриль и донеров" },
      {
        name: "description",
        content:
          "Касса для продавца и панель управления точкой быстрого питания: товары, склад, смены и отчёты в тенге.",
      },
      { property: "og:title", content: "POS-система для куры гриль и донеров" },
      {
        property: "og:description",
        content: "Продажи, расчёт сдачи, склад, смены и отчёты — всё в одном приложении.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { session, loading } = useSession();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-12">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Flame className="size-6" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">POS-система</p>
            <h1 className="text-2xl font-bold">Гриль &amp; Донер</h1>
          </div>
        </div>

        <h2 className="mt-10 max-w-2xl text-4xl leading-tight font-bold sm:text-5xl">
          Касса и управление точкой быстрого питания
        </h2>
        <p className="mt-4 max-w-xl text-muted-foreground">
          Продажи с расчётом сдачи, смены и Z-отчёты, товары и цены, склад, сотрудники и отчётность.
          Все суммы в тенге.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            to="/pos"
            className="tile-press group rounded-2xl border border-border bg-card p-6 hover:border-primary"
          >
            <ShoppingCart className="size-7 text-primary" />
            <h3 className="mt-4 text-xl font-semibold">Касса</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Экран продавца: чек, оплата, сдача, смена
            </p>
          </Link>
          <Link
            to="/admin"
            className="tile-press group rounded-2xl border border-border bg-card p-6 hover:border-primary"
          >
            <Settings2 className="size-7 text-accent" />
            <h3 className="mt-4 text-xl font-semibold">Управление</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Товары, цены, склад, сотрудники, отчёты
            </p>
          </Link>
        </div>

        {!loading && !session && (
          <div className="mt-10">
            <Button asChild size="lg">
              <Link to="/auth">
                <LogIn className="size-4" /> Войти в систему
              </Link>
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
