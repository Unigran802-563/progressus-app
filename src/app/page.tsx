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
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import AppShell from "@/components/layout/AppShell";
import { EmptyState, PageHeader, Panel } from "@/components/ui/progressus-ui";
import { createProject, listAccessibleProjects } from "@/lib/projects";
import { listarMinhasTarefas, obterMetricasTarefas, type MinhaTarefa, type TaskMetrics } from "@/lib/tasks";
import { supabase } from "@/lib/supabase";
import type { AccessibleProject, CreateProjectData, Project } from "@/types";

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

function formatActivityDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

function isCompleted(status: string | null | undefined): boolean {
  return Boolean(status?.toLocaleLowerCase("pt-BR").includes("concl"));
}

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [taskMetrics, setTaskMetrics] = useState<TaskMetrics>({
    abertas: 0,
    emProgresso: 0,
    concluidas: 0,
    atrasadas: 0,
  });
  const [isMetricsLoading, setIsMetricsLoading] = useState(true);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isNewTaskDialogOpen, setIsNewTaskDialogOpen] = useState(false);
  const [accessibleProjects, setAccessibleProjects] = useState<AccessibleProject[]>([]);
  const [dashboardTasks, setDashboardTasks] = useState<MinhaTarefa[]>([]);
  const [projectDeadlines, setProjectDeadlines] = useState<Record<string, string | null>>({});
  const [isDashboardDataLoading, setIsDashboardDataLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const loadProjects = useCallback(async () => {
    try {
      setIsProjectsLoading(true);
      setProjectError("");
      const accessible = await listAccessibleProjects();
      setAccessibleProjects(accessible);
      const activeProjects = accessible.filter((project) => !project.archivedAt);
      setProjects(activeProjects.map(({ myRole: _myRole, owner: _owner, ...project }) => project));
      if (activeProjects.length > 0) {
        const { data: deadlineRows, error: deadlineError } = await supabase
          .from("projeto")
          .select("id_projeto, prazo")
          .in("id_projeto", activeProjects.map((project) => project.id));
        if (deadlineError) throw deadlineError;
        setProjectDeadlines(Object.fromEntries((deadlineRows ?? []).map((row) => [row.id_projeto, row.prazo])));
      } else {
        setProjectDeadlines({});
      }
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

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    try {
      setIsDashboardDataLoading(true);
      setDashboardTasks(await listarMinhasTarefas(user.id, { includeCreated: true }));
    } catch (error) {
      console.error("Não foi possível carregar as atividades do Dashboard.", error);
      setDashboardTasks([]);
    } finally {
      setIsDashboardDataLoading(false);
    }
  }, [user]);

  const loadTaskMetrics = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) setIsMetricsLoading(true);
      setTaskMetrics(await obterMetricasTarefas());
    } catch (error) {
      console.error("Não foi possível carregar as métricas de tarefas.", error);
    } finally {
      setIsMetricsLoading(false);
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
      void loadTaskMetrics();
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [loadProjects, loadTaskMetrics, router]);

  useEffect(() => {
    void loadDashboardData();
  }, [loadDashboardData]);

  useEffect(() => {
    function refreshMetrics() {
      void loadTaskMetrics();
    }

    window.addEventListener("progressus:tasks-changed", refreshMetrics);
    window.addEventListener("progressus:tasks-changed", loadDashboardData);
    return () => {
      window.removeEventListener("progressus:tasks-changed", refreshMetrics);
      window.removeEventListener("progressus:tasks-changed", loadDashboardData);
    };
  }, [loadDashboardData, loadTaskMetrics]);

  useEffect(() => {
    function refreshAccess(event: Event) {
      const accessible = (event as CustomEvent<{ projects: Project[] }>).detail?.projects;
      if (!accessible) return;
      setProjects(accessible.filter((project) => !project.archivedAt));
      void loadTaskMetrics(false);
    }
    window.addEventListener("progressus:project-access-checked", refreshAccess);
    return () => window.removeEventListener("progressus:project-access-checked", refreshAccess);
  }, [loadTaskMetrics]);

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
    void loadProjects();
    setIsNewProjectDialogOpen(false);
    showNotice("Projeto criado com sucesso.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const recentActivities = [
    ...projects.map((project) => ({
      id: `project-${project.id}`,
      title: project.name,
      description: "Projeto disponível para acompanhamento",
      date: project.createdAt,
      href: `/projects/${project.id}`,
      icon: FolderKanban,
    })),
    ...dashboardTasks.map((task) => ({
      id: `task-${task.id_tarefa}`,
      title: task.nome,
      description: `${task.projeto_nome} · ${task.status_nome}`,
      date: task.created_at,
      href: `/projects/${task.id_projeto}/tasks`,
      icon: ListChecks,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5);

  const upcomingDeliveries = [
    ...projects
      .filter((project) => projectDeadlines[project.id] && new Date(projectDeadlines[project.id] as string) >= new Date())
      .map((project) => ({
        id: `project-${project.id}`,
        title: project.name,
        description: "Prazo do projeto",
        date: projectDeadlines[project.id] as string,
        href: `/projects/${project.id}`,
      })),
    ...dashboardTasks
      .filter((task) => task.prazo && !isCompleted(task.status_nome) && new Date(task.prazo) >= new Date())
      .map((task) => ({
        id: `task-${task.id_tarefa}`,
        title: task.nome,
        description: `${task.projeto_nome} · ${task.status_nome}`,
        date: task.prazo as string,
        href: `/projects/${task.id_projeto}/tasks`,
      })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);

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
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <PageHeader
            title={`Olá, ${firstName}`}
            subtitle="Acompanhe seus projetos, tarefas e entregas em um só lugar."
          />
          <button
            type="button"
            onClick={() => setIsNewTaskDialogOpen(true)}
            className="glow-accent inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
          >
            <Plus className="size-4" aria-hidden="true" />
            Nova tarefa
          </button>
        </div>

        <section
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          aria-label="Indicadores de tarefas"
        >
          {metrics.map((metric) => {
            const Icon = metric.icon;

            return (
              <button
                key={metric.label}
                type="button"
                onClick={() => router.push("/tasks")}
                aria-label={`Abrir Minhas tarefas: ${metric.label}`}
                className="card-elevated w-full p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/40"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`grid size-9 place-items-center rounded-xl ${metric.tone}`}
                  >
                    <Icon className="size-[18px]" aria-hidden="true" />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {isMetricsLoading ? "Carregando" : "Dados reais"}
                  </span>
                </div>
                <p className="mt-4 font-display text-3xl font-bold text-foreground">
                  {isMetricsLoading
                    ? "—"
                    : metric.label === "Tarefas abertas"
                      ? taskMetrics.abertas
                      : metric.label === "Em progresso"
                        ? taskMetrics.emProgresso
                        : metric.label === "Concluídas"
                          ? taskMetrics.concluidas
                          : taskMetrics.atrasadas}
                </p>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-2 text-[11px] text-muted-foreground/70">Clique para abrir Minhas tarefas</p>
              </button>
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
                <button
                  type="button"
                  onClick={() => router.push(`/projects/${project.id}`)}
                  key={project.id}
                  className="card-elevated flex min-h-48 flex-col p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30"
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
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
          <Panel title="Atividade recente" bodyClassName="p-0">
            {isDashboardDataLoading ? (
              <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" />Carregando atividades...</div>
            ) : recentActivities.length === 0 ? (
              <EmptyState icon={<ListChecks className="size-6" aria-hidden="true" />} title="Nenhuma atividade registrada" description="As atualizações dos seus projetos e tarefas aparecerão aqui." />
            ) : (
              <div className="divide-y divide-border">
                {recentActivities.map((activity) => {
                  const Icon = activity.icon;
                  return <button key={activity.id} type="button" onClick={() => router.push(activity.href)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40">
                    <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="size-4" aria-hidden="true" /></span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{activity.title}</span><span className="block truncate text-xs text-muted-foreground">{activity.description}</span></span>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{formatActivityDate(activity.date)}</span>
                  </button>;
                })}
              </div>
            )}
          </Panel>

          <Panel title="Próximas entregas" bodyClassName="p-0">
            {isDashboardDataLoading ? (
              <div className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" />Carregando prazos...</div>
            ) : upcomingDeliveries.length === 0 ? (
              <EmptyState icon={<CalendarClock className="size-6" aria-hidden="true" />} title="Nenhuma entrega próxima" description="Cadastre um prazo em um projeto ou tarefa para exibi-lo aqui." />
            ) : (
              <div className="divide-y divide-border">
                {upcomingDeliveries.map((delivery) => <button key={delivery.id} type="button" onClick={() => router.push(delivery.href)} className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-muted/40">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning"><CalendarClock className="size-4" aria-hidden="true" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{delivery.title}</span><span className="block truncate text-xs text-muted-foreground">{delivery.description}</span></span>
                  <span className="shrink-0 text-right text-[11px] text-muted-foreground">{formatActivityDate(delivery.date)}</span>
                </button>)}
              </div>
            )}
          </Panel>
        </section>
      </div>

      <NewProjectDialog
        open={isNewProjectDialogOpen}
        onClose={() => setIsNewProjectDialogOpen(false)}
        onCreate={handleCreateProject}
      />

      <CreateTaskDialog
        open={isNewTaskDialogOpen}
        projects={accessibleProjects}
        userId={user?.id ?? ""}
        onClose={() => setIsNewTaskDialogOpen(false)}
        onCreated={(task) => { setIsNewTaskDialogOpen(false); router.push(`/projects/${task.id_projeto}/tasks`); }}
        onRequestCreateProject={() => { setIsNewTaskDialogOpen(false); setIsNewProjectDialogOpen(true); }}
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
