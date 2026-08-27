"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  CalendarClock,
  CheckCircle2,
  CircleDashed,
  Clock3,
  FolderKanban,
  ListChecks,
  Loader2,
  Plus,
  Timer,
  TriangleAlert,
} from "lucide-react";

import NewProjectDialog from "@/components/projects/NewProjectDialog";
import AppShell from "@/components/layout/AppShell";
import { EmptyState, PageHeader, Panel } from "@/components/ui/progressus-ui";
import { createProject, listProjects } from "@/lib/projects";
import { supabase } from "@/lib/supabase";
import type { CreateProjectData, Project } from "@/types";

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

function formatProjectDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const loadProjects = useCallback(async () => {
    try {
      setIsProjectsLoading(true);
      setProjectError("");
      setProjects(await listProjects());
    } catch (error) {
      setProjectError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os projetos.",
      );
    } finally {
      setIsProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace("/auth/login");
        return;
      }

      if (!isMounted) {
        return;
      }

      setUser(data.session.user);
      setIsLoading(false);
      void loadProjects();
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [loadProjects, router]);

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

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function handleCreateProject(data: CreateProjectData) {
    const project = await createProject(data);

    setProjects((currentProjects) => [project, ...currentProjects]);
    setIsNewProjectDialogOpen(false);
    showNotice("Projeto criado com sucesso.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

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
      onOpenNewProject={() => setIsNewProjectDialogOpen(true)}
    >
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title={`Olá, ${firstName}`}
            subtitle="Acompanhe seus projetos, tarefas e entregas em um só lugar."
          />
          <button
            type="button"
            onClick={() => setIsNewProjectDialogOpen(true)}
            className="glow-accent inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
          >
            <Plus className="size-4" aria-hidden="true" />
            Novo projeto
          </button>
        </div>

        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Indicadores de tarefas"
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
                  <span className="text-xs text-muted-foreground">Sem dados</span>
                </div>
                <p className="mt-4 font-display text-3xl font-bold text-foreground">0</p>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-[11px] text-muted-foreground/70">
                  Nenhuma atividade registrada
                </p>
              </article>
            );
          })}
        </section>

        <section className="flex flex-col gap-4" aria-labelledby="projects-title">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
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

            {projects.length > 0 && !isProjectsLoading && (
              <button
                type="button"
                onClick={() => setIsNewProjectDialogOpen(true)}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-muted"
              >
                <Plus className="size-4" aria-hidden="true" />
                Criar projeto
              </button>
            )}
          </div>

          {isProjectsLoading ? (
            <div className="surface-panel flex min-h-52 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
                Carregando projetos...
              </div>
            </div>
          ) : projectError ? (
            <div className="surface-panel">
              <EmptyState
                icon={<TriangleAlert className="size-6" aria-hidden="true" />}
                title="Não foi possível carregar os projetos"
                description={projectError}
                action={
                  <button
                    type="button"
                    onClick={() => void loadProjects()}
                    className="inline-flex h-10 items-center rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    Tentar novamente
                  </button>
                }
              />
            </div>
          ) : projects.length === 0 ? (
            <div className="surface-panel">
              <EmptyState
                icon={<FolderKanban className="size-6" aria-hidden="true" />}
                title="Você ainda não possui projetos"
                description="Crie seu primeiro projeto para organizar tarefas, prazos e documentos acadêmicos."
                action={
                  <button
                    type="button"
                    onClick={() => setIsNewProjectDialogOpen(true)}
                    className="glow-accent inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Criar primeiro projeto
                  </button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <article
                  key={project.id}
                  className="card-elevated flex min-h-48 flex-col p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
                      <FolderKanban className="size-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Projeto
                    </span>
                  </div>

                  <h3 className="mt-5 line-clamp-2 font-display text-base font-semibold text-foreground">
                    {project.name}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {project.description || "Sem descrição cadastrada."}
                  </p>

                  <div className="mt-auto flex items-center gap-2 pt-5 text-xs text-muted-foreground">
                    <CalendarClock className="size-3.5" aria-hidden="true" />
                    Criado em {formatProjectDate(project.createdAt)}
                  </div>
                </article>
              ))}
            </div>
          )}
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

      <NewProjectDialog
        open={isNewProjectDialogOpen}
        onClose={() => setIsNewProjectDialogOpen(false)}
        onCreate={handleCreateProject}
      />

      {notice && (
        <div
          className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-success/30 bg-surface px-4 py-3 text-sm text-foreground shadow-2xl shadow-black/30"
          role="status"
        >
          {notice}
        </div>
      )}
    </AppShell>
  );
}
