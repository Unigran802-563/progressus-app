"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  CalendarClock,
  Crown,
  FolderKanban,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
  UserRound,
} from "lucide-react";

import NewProjectDialog from "@/components/projects/NewProjectDialog";
import AppShell from "@/components/layout/AppShell";
import { EmptyState, PageHeader } from "@/components/ui/progressus-ui";
import { createProject, listAccessibleProjects } from "@/lib/projects";
import { supabase } from "@/lib/supabase";
import type { AccessibleProject, CreateProjectData } from "@/types";

type ViewMode = "grid" | "list";
type ProjectFilter = "all" | "owned" | "shared";

const filterOptions: Array<{ id: ProjectFilter; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "owned", label: "Meus projetos" },
  { id: "shared", label: "Compartilhados comigo" },
];

function formatProjectDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

function getAccessLabel(project: AccessibleProject): string {
  if (project.myRole === "owner") return "Criado por você";
  if (project.myRole === "member") return "Participante";
  return "Visualizador";
}

function ProjectOwnershipBadge({ project }: { project: AccessibleProject }) {
  if (project.myRole === "owner") {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
        <Crown className="size-3" aria-hidden="true" />
        Criado por você
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-info/25 bg-info/10 px-2.5 py-1 text-[11px] font-semibold text-info">
      <Link2 className="size-3" aria-hidden="true" />
      Compartilhado
    </span>
  );
}

function OwnerLabel({ project }: { project: AccessibleProject }) {
  if (project.myRole === "owner") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] text-primary">
        <Crown className="size-3.5" aria-hidden="true" />
        Você é o proprietário
      </span>
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-info/15 text-[9px] font-bold text-info ring-1 ring-info/20">
        {project.owner.name.charAt(0).toUpperCase()}
      </span>
      <span className="truncate">Compartilhado por {project.owner.name}</span>
    </span>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<AccessibleProject[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>("all");
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");

  const loadProjects = useCallback(async () => {
    try {
      setIsProjectsLoading(true);
      setProjectError("");
      setProjects(await listAccessibleProjects());
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
      setIsPageLoading(false);
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

    return user?.email?.split("@")[0] || "Usuário";
  }, [user]);

  const userInitial = userName.charAt(0).toUpperCase() || "U";

  const ownProjects = useMemo(
    () => projects.filter((project) => project.myRole === "owner"),
    [projects],
  );
  const sharedProjects = useMemo(
    () => projects.filter((project) => project.myRole !== "owner"),
    [projects],
  );

  const visibleProjects = useMemo(() => {
    const sourceProjects =
      activeFilter === "owned"
        ? ownProjects
        : activeFilter === "shared"
          ? sharedProjects
          : projects;
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedQuery) {
      return sourceProjects;
    }

    return sourceProjects.filter((project) => {
      const searchableText = `${project.name} ${project.description ?? ""} ${project.owner.name}`;

      return searchableText.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    });
  }, [activeFilter, ownProjects, projects, searchQuery, sharedProjects]);

  const projectsSubtitle = isProjectsLoading
    ? "Carregando seus projetos..."
    : `${ownProjects.length} ${ownProjects.length === 1 ? "projeto próprio" : "projetos próprios"} e ${sharedProjects.length} ${sharedProjects.length === 1 ? "compartilhado" : "compartilhados com você"}.`;

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function handleCreateProject(data: CreateProjectData) {
    await createProject(data);
    await loadProjects();
    setIsNewProjectDialogOpen(false);
    showNotice("Projeto criado com sucesso.");
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (isPageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-6 animate-spin text-primary" aria-label="Carregando" />
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
          <PageHeader title="Projetos" subtitle={projectsSubtitle} />
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
          className="surface-panel flex flex-col gap-3 p-3 lg:flex-row lg:items-center"
          aria-label="Buscar e organizar projetos"
        >
          <div className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              type="search"
              placeholder="Buscar por nome, descrição ou proprietário"
              aria-label="Buscar projetos"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 lg:justify-end">
            <div
              className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-background p-1"
              aria-label="Categoria de projetos"
            >
              {filterOptions.map((filter) => {
                const count =
                  filter.id === "owned"
                    ? ownProjects.length
                    : filter.id === "shared"
                      ? sharedProjects.length
                      : projects.length;

                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => setActiveFilter(filter.id)}
                    className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      activeFilter === filter.id
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {filter.label} ({count})
                  </button>
                );
              })}
            </div>

            <div
              className="flex shrink-0 items-center gap-1 rounded-xl border border-border bg-background p-1"
              aria-label="Modo de visualização"
            >
              <button
                type="button"
                aria-label="Visualização em grade"
                aria-pressed={viewMode === "grid"}
                onClick={() => setViewMode("grid")}
                className={`grid size-8 place-items-center rounded-lg transition-colors ${
                  viewMode === "grid"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label="Visualização em lista"
                aria-pressed={viewMode === "list"}
                onClick={() => setViewMode("list")}
                className={`grid size-8 place-items-center rounded-lg transition-colors ${
                  viewMode === "list"
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </section>

        {!isProjectsLoading && !projectError && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Resumo de propriedade">
            <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/10 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <Crown className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Meus Projetos</p>
                <p className="text-xs text-muted-foreground">
                  {ownProjects.length} {ownProjects.length === 1 ? "projeto criado por você" : "projetos criados por você"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-info/20 bg-info/10 px-4 py-3">
              <span className="grid size-9 place-items-center rounded-xl bg-info/15 text-info">
                <UserRound className="size-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Compartilhados Comigo</p>
                <p className="text-xs text-muted-foreground">
                  {sharedProjects.length} {sharedProjects.length === 1 ? "projeto recebido por convite" : "projetos recebidos por convite"}
                </p>
              </div>
            </div>
          </div>
        )}

        {isProjectsLoading ? (
          <div className="surface-panel flex min-h-64 items-center justify-center">
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
        ) : visibleProjects.length === 0 ? (
          <div className="surface-panel">
            <EmptyState
              icon={<FolderKanban className="size-6" aria-hidden="true" />}
              title={
                searchQuery
                  ? "Nenhum projeto encontrado"
                  : activeFilter === "owned"
                    ? "Você ainda não criou projetos"
                    : activeFilter === "shared"
                      ? "Nenhum projeto foi compartilhado com você"
                      : "Você ainda não possui projetos"
              }
              description={
                searchQuery
                  ? "Tente buscar por outro nome, descrição ou proprietário."
                  : activeFilter === "shared"
                    ? "Os projetos que você aceitar por convite aparecerão nesta área."
                    : "Crie seu primeiro projeto para organizar tarefas, prazos e documentos acadêmicos."
              }
              action={
                !searchQuery && activeFilter !== "shared" ? (
                  <button
                    type="button"
                    onClick={() => setIsNewProjectDialogOpen(true)}
                    className="glow-accent inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Criar projeto
                  </button>
                ) : undefined
              }
            />
          </div>
        ) : viewMode === "grid" ? (
          <section
            className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3"
            aria-label="Lista de projetos"
          >
            {visibleProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="card-elevated flex min-h-56 flex-col gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      className={`size-2.5 shrink-0 rounded-full ${
                        project.myRole === "owner" ? "bg-primary" : "bg-info"
                      }`}
                    />
                    <h2 className="truncate font-display text-[15px] font-semibold text-foreground">
                      {project.name}
                    </h2>
                  </div>
                  <ProjectOwnershipBadge project={project} />
                </div>

                <p className="line-clamp-3 text-[13px] leading-6 text-muted-foreground">
                  {project.description || "Sem descrição cadastrada."}
                </p>

                <div className="mt-auto flex flex-col gap-3 border-t border-border pt-3">
                  <OwnerLabel project={project} />
                  <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{getAccessLabel(project)}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <CalendarClock className="size-3.5" aria-hidden="true" />
                      {formatProjectDate(project.createdAt)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <section className="surface-panel overflow-hidden" aria-label="Lista de projetos">
            <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto] gap-5 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid">
              <span>Projeto</span>
              <span>Propriedade</span>
              <span>Criado em</span>
            </div>

            <ul className="divide-y divide-border">
              {visibleProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50 lg:grid-cols-[minmax(0,1fr)_auto_auto] lg:gap-5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={`size-2.5 shrink-0 rounded-full ${
                          project.myRole === "owner" ? "bg-primary" : "bg-info"
                        }`}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {project.name}
                        </p>
                        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {project.description || "Sem descrição cadastrada."}
                        </p>
                      </div>
                    </div>
                    <div className="hidden lg:block">
                      <OwnerLabel project={project} />
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {formatProjectDate(project.createdAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
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
