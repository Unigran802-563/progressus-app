"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  CalendarClock,
  FolderKanban,
  LayoutGrid,
  List,
  Loader2,
  Plus,
  Search,
  TriangleAlert,
} from "lucide-react";

import NewProjectDialog from "@/components/projects/NewProjectDialog";
import AppShell from "@/components/layout/AppShell";
import { EmptyState, PageHeader } from "@/components/ui/progressus-ui";
import { createProject, listProjects } from "@/lib/projects";
import { supabase } from "@/lib/supabase";
import type { CreateProjectData, Project } from "@/types";

type ViewMode = "grid" | "list";

function formatProjectDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isProjectsLoading, setIsProjectsLoading] = useState(true);
  const [projectError, setProjectError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
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

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("pt-BR");

    if (!normalizedQuery) {
      return projects;
    }

    return projects.filter((project) => {
      const searchableText = `${project.name} ${project.description ?? ""}`;

      return searchableText.toLocaleLowerCase("pt-BR").includes(normalizedQuery);
    });
  }, [projects, searchQuery]);

  const projectsSubtitle = isProjectsLoading
    ? "Carregando seus projetos..."
    : `${projects.length} ${projects.length === 1 ? "projeto" : "projetos"} no seu espaço de trabalho.`;

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
              placeholder="Buscar por nome ou descrição"
              aria-label="Buscar projetos"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
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
        </section>

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
        ) : filteredProjects.length === 0 ? (
          <div className="surface-panel">
            <EmptyState
              icon={<FolderKanban className="size-6" aria-hidden="true" />}
              title={
                projects.length === 0
                  ? "Você ainda não possui projetos"
                  : "Nenhum projeto encontrado"
              }
              description={
                projects.length === 0
                  ? "Crie seu primeiro projeto para organizar tarefas, prazos e documentos acadêmicos."
                  : "Tente buscar por outro nome ou trecho da descrição."
              }
              action={
                projects.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setIsNewProjectDialogOpen(true)}
                    className="glow-accent inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
                  >
                    <Plus className="size-4" aria-hidden="true" />
                    Criar primeiro projeto
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
            {filteredProjects.map((project) => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="card-elevated flex min-h-52 flex-col gap-4 p-5 transition-all hover:-translate-y-0.5 hover:border-primary/30"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-full bg-primary" />
                    <h2 className="truncate font-display text-[15px] font-semibold text-foreground">
                      {project.name}
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    Projeto
                  </span>
                </div>

                <p className="line-clamp-3 text-[13px] leading-6 text-muted-foreground">
                  {project.description || "Sem descrição cadastrada."}
                </p>

                <div className="mt-auto flex items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
                  <CalendarClock className="size-3.5" aria-hidden="true" />
                  Criado em {formatProjectDate(project.createdAt)}
                </div>
              </Link>
            ))}
          </section>
        ) : (
          <section className="surface-panel overflow-hidden" aria-label="Lista de projetos">
            <div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-border px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:grid">
              <span>Projeto</span>
              <span>Criado em</span>
            </div>

            <ul className="divide-y divide-border">
              {filteredProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                  >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="size-2.5 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {project.name}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {project.description || "Sem descrição cadastrada."}
                      </p>
                    </div>
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
