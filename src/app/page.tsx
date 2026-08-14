"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FolderKanban,
  ListChecks,
  Plus,
  Timer,
  TriangleAlert,
} from "lucide-react";

import AppShell from "@/components/layout/AppShell";
import { EmptyState, PageHeader, Panel } from "@/components/ui/progressus-ui";
import { supabase } from "@/lib/supabase";

const metrics = [
  {
    label: "Tarefas abertas",
    icon: CircleDashed,
    tone: "text-info bg-info/15",
  },
  { label: "Em progresso", icon: Timer, tone: "text-progress bg-progress/15" },
  {
    label: "Concluídas",
    icon: CheckCircle2,
    tone: "text-success bg-success/15",
  },
  { label: "Atrasadas", icon: TriangleAlert, tone: "text-danger bg-danger/15" },
] as const;

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace("/auth/login");
        return;
      }

      setUser(data.session.user);
      setIsLoading(false);
    }

    checkSession();
  }, [router]);

  const userName = useMemo(() => {
    const metadataName = user?.user_metadata?.nome || user?.user_metadata?.name;

    if (metadataName) {
      return String(metadataName);
    }

    if (user?.email) {
      return user.email.split("@")[0];
    }

    return "Usuário";
  }, [user]);

  const firstName = userName.split(" ")[0] || "Usuário";
  const userInitial = userName.charAt(0).toUpperCase() || "U";

  function showUnavailableFeature() {
    setNotice(
      "A criação de projetos será adicionada na próxima etapa do Progressus.",
    );
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (isLoading)
    if (isLoading) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <div
        className="relative flex flex-col items-center gap-6"
        role="status"
        aria-live="polite"
      >
        <div className="relative grid size-16 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_20px_45px_-20px_oklch(0.6056_0.2189_292.72_/_0.9)]">
          <span className="absolute -inset-2 rounded-[1.25rem] border border-primary/35 animate-ping [animation-duration:2.2s]" />
          <img
            src="/brand/progressus-logo.png"
            alt="Logo Progressus"
            className="size-full object-contain p-1.5"
          />
        </div>

        <span className="grid size-10 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
          <Clock3
            className="size-5 animate-[spin_1.3s_linear_infinite]"
            aria-hidden="true"
          />
        </span>

        <span className="sr-only">Carregando Progressus</span>
      </div>
    </main>
  );
}


  return (
    <AppShell
      userName={userName}
      userInitial={userInitial}
      onLogout={handleLogout}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <PageHeader
          title={`Olá, ${firstName}`}
          subtitle="Seu workspace está pronto. Crie um projeto para começar a organizar suas atividades."
        />

        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Indicadores do projeto"
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <article key={metric.label} className="card-elevated p-5">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`grid size-9 place-items-center rounded-xl ${metric.tone}`}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Sem dados
                  </span>
                </div>
                <p className="mt-4 font-display text-3xl font-bold text-foreground">
                  0
                </p>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-[11px] text-muted-foreground/70">
                  Nenhuma atividade registrada
                </p>
              </article>
            );
          })}
        </section>

        <section
          className="flex flex-col gap-4"
          aria-labelledby="projects-title"
        >
          <div>
            <h2
              id="projects-title"
              className="font-display text-lg font-semibold text-foreground"
            >
              Meus projetos
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Acompanhe suas entregas, tarefas e progresso em um só lugar.
            </p>
          </div>

          <div className="surface-panel">
            <EmptyState
              icon={<FolderKanban className="size-6" aria-hidden="true" />}
              title="Você ainda não possui projetos"
              description="Crie seu primeiro projeto para organizar tarefas, prazos e documentos acadêmicos."
              action={
                <button
                  type="button"
                  onClick={showUnavailableFeature}
                  className="glow-accent inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  Criar primeiro projeto
                </button>
              }
            />
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
          <Panel title="Atividade recente" bodyClassName="p-0">
            <EmptyState
              icon={<ListChecks className="size-6" aria-hidden="true" />}
              title="Nenhuma atividade registrada"
              description="As atualizações dos seus projetos e tarefas aparecerão aqui."
            />
          </Panel>

          <Panel title="Próximas entregas" bodyClassName="p-0">
            <EmptyState
              icon={<CalendarClock className="size-6" aria-hidden="true" />}
              title="Nenhuma entrega próxima"
              description="Os prazos dos seus projetos serão exibidos neste painel."
            />
          </Panel>
        </section>
      </div>

      {notice && (
        <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-2xl shadow-black/30">
          {notice}
        </div>
      )}
    </AppShell>
  );
}
