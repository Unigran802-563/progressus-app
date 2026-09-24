"use client";
import ProjectTasksPanel from "@/components/projects/ProjectTasksPanel";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  FileText,
  FolderKanban,
  Loader2,
  PencilLine,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";

import EditProjectDialog from "@/components/projects/EditProjectDialog";
import NewProjectDialog from "@/components/projects/NewProjectDialog";
import ShareProjectDialog from "@/components/projects/ShareProjectDialog";
import AppShell from "@/components/layout/AppShell";
import { EmptyState, Panel } from "@/components/ui/progressus-ui";
import {
  archiveProject,
  createProject,
  getProject,
  getProjectMember,
  listProjectParticipants,
  updateProject,
} from "@/lib/projects";
import { supabase } from "@/lib/supabase";
import type {
  CreateProjectData,
  Project,
  ProjectParticipant,
  ProjectRole,
  UpdateProjectData,
} from "@/types";

function formatProjectDate(date: string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}

function getRoleLabel(role: ProjectRole | null): string {
  if (role === "owner") return "Proprietário";
  if (role === "member") return "Participante";
  if (role === "viewer") return "Visualizador";
  return "Participante";
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const projectId = params.id;

  const [user, setUser] = useState<User | null>(null);
  const [project, setProject] = useState<Project | null>(null);
  const [projectRole, setProjectRole] = useState<ProjectRole | null>(null);
  const [participants, setParticipants] = useState<ProjectParticipant[]>([]);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [notice, setNotice] = useState("");

  const loadProject = useCallback(
    async (currentUserId: string) => {
      try {
        setPageError("");

        const [projectData, memberData, participantsData] = await Promise.all([
          getProject(projectId),
          getProjectMember(projectId, currentUserId),
          listProjectParticipants(projectId),
        ]);

        if (!projectData) {
          setProject(null);
          setPageError("Este projeto não existe ou você não tem acesso a ele.");
          return;
        }

        setProject(projectData);
        setProjectRole(memberData?.role ?? null);
        setParticipants(participantsData);
      } catch (error) {
        setPageError(
          error instanceof Error
            ? error.message
            : "Não foi possível carregar o projeto.",
        );
      } finally {
        setIsPageLoading(false);
        setIsParticipantsLoading(false);
      }
    },
    [projectId],
  );

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
      void loadProject(data.session.user.id);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [loadProject, router]);

  const userName = useMemo(() => {
    const metadataName = user?.user_metadata?.nome || user?.user_metadata?.name;

    if (metadataName) {
      return String(metadataName);
    }

    return user?.email?.split("@")[0] || "Usuário";
  }, [user]);

  const userInitial = userName.charAt(0).toUpperCase() || "U";
  const isOwner = projectRole === "owner";

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function handleSaveProject(data: UpdateProjectData) {
    if (!project) return;

    const updatedProject = await updateProject(project.id, data);
    setProject(updatedProject);
    setIsEditDialogOpen(false);
    showNotice("Projeto atualizado com sucesso.");
  }

  async function handleArchiveProject() {
    if (!project) return;

    try {
      setIsArchiving(true);
      await archiveProject(project.id);
      router.replace("/projects");
    } catch (error) {
      showNotice(
        error instanceof Error
          ? error.message
          : "Não foi possível arquivar o projeto.",
      );
      setIsArchiveDialogOpen(false);
    } finally {
      setIsArchiving(false);
    }
  }

  async function handleCreateProject(data: CreateProjectData) {
    const createdProject = await createProject(data);
    setIsNewProjectDialogOpen(false);
    router.push(`/projects/${createdProject.id}`);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (isPageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background">
        <Loader2
          className="size-6 animate-spin text-primary"
          aria-label="Carregando"
        />
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
        <Link
          href="/projects"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Projetos
        </Link>

        {pageError || !project ? (
          <div className="surface-panel">
            <EmptyState
              icon={<TriangleAlert className="size-6" aria-hidden="true" />}
              title="Projeto indisponível"
              description={
                pageError || "Não foi possível localizar este projeto."
              }
              action={
                <Link
                  href="/projects"
                  className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  Voltar para projetos
                </Link>
              }
            />
          </div>
        ) : (
          <>
            <section className="card-elevated flex flex-col gap-5 p-5 lg:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                    <FolderKanban className="size-5" aria-hidden="true" />
                  </span>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
                        {project.name}
                      </h1>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
                          project.archivedAt
                            ? "border-warning/25 bg-warning/10 text-warning"
                            : "border-success/25 bg-success/10 text-success"
                        }`}
                      >
                        {project.archivedAt ? "Arquivado" : "Ativo"}
                      </span>
                    </div>

                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      {project.description ||
                        "Este projeto ainda não possui uma descrição."}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  

                  {isOwner && !project.archivedAt && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsShareDialogOpen(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <UserPlus className="size-4" aria-hidden="true" />
                        Compartilhar
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsEditDialogOpen(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                      >
                        <PencilLine className="size-4" aria-hidden="true" />
                        Editar
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsArchiveDialogOpen(true)}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 text-sm font-medium text-warning transition-colors hover:bg-warning/15"
                      >
                        <Archive className="size-4" aria-hidden="true" />
                        Arquivar
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Criado em
                  </p>

                  <p className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarClock
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    {formatProjectDate(project.createdAt)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Seu acesso
                  </p>

                  <p className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <ShieldCheck
                      className="size-4 text-primary"
                      aria-hidden="true"
                    />
                    {getRoleLabel(projectRole)}
                  </p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Situação
                  </p>

                  <p className="mt-2 text-sm font-medium text-foreground">
                    {project.archivedAt
                      ? "Projeto arquivado"
                      : "Projeto em andamento"}
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4">
              <Panel title="Tarefas" bodyClassName="p-0">
                <ProjectTasksPanel
                  projectId={project.id}
                  disabled={Boolean(project.archivedAt)}
                />
              </Panel>

              <Panel
                title={`Participantes (${participants.length})`}
                bodyClassName="p-0"
              >
                {isParticipantsLoading ? (
                  <div className="flex min-h-36 items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2
                      className="size-4 animate-spin text-primary"
                      aria-hidden="true"
                    />
                    Carregando participantes...
                  </div>
                ) : participants.length > 0 ? (
                  <ul className="divide-y divide-border">
                    {participants.map((participant) => (
                      <li
                        key={participant.userId}
                        className="flex items-center gap-3 px-5 py-3.5"
                      >
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/25">
                          {participant.name.charAt(0).toUpperCase()}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {participant.name}

                            {participant.userId === user?.id && (
                              <span className="ml-1 text-xs font-normal text-muted-foreground">
                                (você)
                              </span>
                            )}
                          </p>

                          <p className="truncate text-[11px] text-muted-foreground">
                            {participant.email}
                          </p>
                        </div>

                        <span
                          className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold ${
                            participant.role === "owner"
                              ? "bg-primary/15 text-primary"
                              : participant.role === "member"
                                ? "bg-info/15 text-info"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {getRoleLabel(participant.role)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={<UserPlus className="size-5" aria-hidden="true" />}
                    title="Nenhum participante encontrado"
                    description="Use o botão Compartilhar para convidar alguém."
                  />
                )}
              </Panel>

              <Panel title="Arquivos" bodyClassName="p-0">
                <EmptyState
                  icon={<FileText className="size-5" aria-hidden="true" />}
                  title="Nenhum arquivo enviado"
                  description="O envio de documentos será integrado ao projeto posteriormente."
                />
              </Panel>
            </section>
          </>
        )}
      </div>

      <EditProjectDialog
        open={isEditDialogOpen}
        project={project}
        onClose={() => setIsEditDialogOpen(false)}
        onSave={handleSaveProject}
      />

      <ShareProjectDialog
        open={isShareDialogOpen}
        project={project}
        onClose={() => setIsShareDialogOpen(false)}
      />

      <NewProjectDialog
        open={isNewProjectDialogOpen}
        onClose={() => setIsNewProjectDialogOpen(false)}
        onCreate={handleCreateProject}
      />

      {isArchiveDialogOpen && project && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="presentation"
        >
          <button
            type="button"
            aria-label="Cancelar arquivamento"
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
            onClick={
              isArchiving ? undefined : () => setIsArchiveDialogOpen(false)
            }
          />

          <section
            className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-2xl shadow-black/50 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="archive-project-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/10 text-warning">
                  <Archive className="size-5" aria-hidden="true" />
                </span>

                <div>
                  <h2
                    id="archive-project-title"
                    className="font-display text-lg font-semibold text-foreground"
                  >
                    Arquivar projeto?
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-muted-foreground">
                    O projeto{" "}
                    <strong className="text-foreground">{project.name}</strong>{" "}
                    sairá da lista ativa. Seus dados não serão apagados.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsArchiveDialogOpen(false)}
                disabled={isArchiving}
                className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setIsArchiveDialogOpen(false)}
                disabled={isArchiving}
                className="h-10 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void handleArchiveProject()}
                disabled={isArchiving}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-warning px-4 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isArchiving && (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                )}

                {isArchiving ? "Arquivando..." : "Arquivar projeto"}
              </button>
            </div>
          </section>
        </div>
      )}

      {notice && (
        <div
          className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-2xl shadow-black/30"
          role="status"
        >
          {notice}
        </div>
      )}
    </AppShell>
  );
}
