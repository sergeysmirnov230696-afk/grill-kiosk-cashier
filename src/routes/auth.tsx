import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Flame, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход в POS-систему" },
      { name: "description", content: "Вход для сотрудников точки быстрого питания." },
      { property: "og:title", content: "Вход в POS-систему" },
      { property: "og:description", content: "Вход для сотрудников точки быстрого питания." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/pos", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error("Не удалось войти: " + error.message);
      return;
    }
    navigate({ to: "/pos", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setBusy(false);
    if (error) {
      toast.error("Не удалось зарегистрироваться: " + error.message);
      return;
    }
    if (data.session) {
      navigate({ to: "/pos", replace: true });
    } else {
      setSent(true);
      toast.success("Проверьте почту и подтвердите адрес");
    }
  }

  async function signInGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Не удалось войти через Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/pos", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Flame className="size-5" />
          </span>
          <span className="text-lg font-bold">Гриль &amp; Донер POS</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6">
          {sent ? (
            <p className="text-sm text-muted-foreground">
              Мы отправили письмо на {email}. Подтвердите адрес и вернитесь на эту страницу, чтобы
              войти.
            </p>
          ) : (
            <Tabs defaultValue="signin">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Вход</TabsTrigger>
                <TabsTrigger value="signup">Регистрация</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={signIn} className="mt-4 space-y-4">
                  <Fields
                    email={email}
                    password={password}
                    setEmail={setEmail}
                    setPassword={setPassword}
                  />
                  <Button type="submit" className="w-full" size="lg" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />} Войти
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={signUp} className="mt-4 space-y-4">
                  <Fields
                    email={email}
                    password={password}
                    setEmail={setEmail}
                    setPassword={setPassword}
                  />
                  <Button type="submit" className="w-full" size="lg" disabled={busy}>
                    {busy && <Loader2 className="size-4 animate-spin" />} Создать аккаунт
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> или <span className="h-px flex-1 bg-border" />
          </div>
          <Button variant="secondary" className="w-full" size="lg" onClick={signInGoogle} disabled={busy}>
            Продолжить с Google
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Кассиры выбирают себя по PIN-коду уже внутри кассы.
        </p>
      </div>
    </main>
  );
}

function Fields({
  email,
  password,
  setEmail,
  setPassword,
}: {
  email: string;
  password: string;
  setEmail: (v: string) => void;
  setPassword: (v: string) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="email">E-mail</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Пароль</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          minLength={6}
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
    </>
  );
}
