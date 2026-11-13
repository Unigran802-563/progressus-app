"use client";
import ProjectTasksPanel from "@/components/projects/ProjectTasksPanel";
import ProjectFilesPanel from "@/components/projects/ProjectFilesPanel";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import {
  Archive,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  FileText,
  FolderKanban,
  Loader2,
  MessageSquare,
  PencilLine,
  ShieldCheck,
  Target,
  TriangleAlert,
  Trash2,
  UserMinus,
  UserPlus,
  UsersRound,
} from "lucide-react";

import EditProjectDialog from "@/components/projects/EditProjectDialog";
import NewProjectDialog from "@/components/projects/NewProjectDialog";
import ProjectConfirmationDialog from "@/components/projects/ProjectConfirmationDialog";
import ShareProjectDialog from "@/components/projects/ShareProjectDialog";
import AppShell from "@/components/layout/AppShell";
import { EmptyState, Panel } from "@/components/ui/progressus-ui";
import {
  archiveProject,
  createProject,
  getProject,
  getProjectMember,
  listProjectParticipants,
  moveProjectToTrash,
  removeProjectParticipant,
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

type ProjectTaskSummary = {
  total: number;
  open: number;
  completed: number;
};

type ProjectTab = "overview" | "tasks" | "members" | "files" | "activity";

type ProjectConfirmation =
  | { action: "archive" | "trash" }
  | { action: "remove-member"; participant: ProjectParticipant };

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
  const [taskSummary, setTaskSummary] = useState<ProjectTaskSummary>({
    total: 0,
    open: 0,
    completed: 0,
  });
  const [activeTab, setActiveTab] = useState<ProjectTab>("overview");
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [isParticipantsLoading, setIsParticipantsLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isShareDialogOpen, setIsShareDialogOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<ProjectConfirmation | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [confirmationError, setConfirmationError] = useState("");
  const confirmationPendingRef = useRef(false);
  const [notice, setNotice] = useState("");

  const loadProject = useCallback(
    async (currentUserId: string) => {
      try {
        setPageError("");

        const [projectData, memberData, participantsData, tasksResult, statusesResult] = await Promise.all([
          getProject(projectId),
          getProjectMember(projectId, currentUserId),
          listProjectParticipants(projectId),
          supabase
            .from("tarefa")
            .select("id_tarefa, id_status")
            .eq("id_projeto", projectId),
          supabase
            .from("status")
            .select("id_status, nome")
            .eq("id_projeto", projectId),
        ]);

        if (tasksResult.error) throw new Error(tasksResult.error.message);
        if (statusesResult.error) throw new Error(statusesResult.error.message);

        if (!projectData) {
          setProject(null);
          setPageError("Este projeto não existe ou você não tem acesso a ele.");
          return;
        }

        setProject(projectData);
        setProjectRole(memberData?.role ?? null);
        setParticipants(participantsData);

        const completedStatusIds = new Set(
          ((statusesResult.data ?? []) as Array<{ id_status: string; nome: string }>)
            .filter((item) => item.nome.toLocaleLowerCase("pt-BR").includes("concl"))
            .map((item) => item.id_status),
        );
        const taskRows = (tasksResult.data ?? []) as Array<{ id_status: string | null }>;
        const completed = taskRows.filter(
          (task) => task.id_status && completedStatusIds.has(task.id_status),
        ).length;
        setTaskSummary({
          total: taskRows.length,
          completed,
          open: taskRows.length - completed,
        });
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

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    function refreshProjectSummary() {
      void loadProject(userId);
    }

    window.addEventListener("progressus:tasks-changed", refreshProjectSummary);
    window.addEventListener("progressus:project-access-checked", refreshProjectSummary);
    return () => {
      window.removeEventListener("progressus:tasks-changed", refreshProjectSummary);
      window.removeEventListener("progressus:project-access-checked", refreshProjectSummary);
    };
  }, [loadProject, user]);

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

  function openConfirmation(nextConfirmation: ProjectConfirmation) {
    if (confirmationPendingRef.current) return;
    setConfirmationError("");
    setConfirmation(nextConfirmation);
  }

  function closeConfirmation() {
    if (confirmationPendingRef.current) return;
    setConfirmation(null);
    setConfirmationError("");
  }

  async function handleArchiveProject() {
    if (!project || !isOwner || confirmation?.action !== "archive" || confirmationPendingRef.current) return;

    confirmationPendingRef.current = true;
    setIsConfirming(true);
    setConfirmationError("");
    try {
      await archiveProject(project.id);
      setConfirmation(null);
      router.replace("/projects");
    } catch (error) {
      setConfirmationError(
        error instanceof Error
          ? error.message
          : "Não foi possível arquivar o projeto.",
      );
    } finally {
      confirmationPendingRef.current = false;
      setIsConfirming(false);
    }
  }

  async function handleMoveProjectToTrash() {
    if (!project || !isOwner || confirmation?.action !== "trash" || confirmationPendingRef.current) return;

    confirmationPendingRef.current = true;
    setIsConfirming(true);
    setConfirmationError("");
    try {
      await moveProjectToTrash(project.id);
      setConfirmation(null);
      router.replace("/projects");
    } catch (error) {
      setConfirmationError(error instanceof Error ? error.message : "Não foi possível mover o projeto para a lixeira.");
    } finally {
      confirmationPendingRef.current = false;
      setIsConfirming(false);
    }
  }

  async function handleRemoveProjectParticipant() {
    if (!project || !user || !isOwner || confirmation?.action !== "remove-member" || confirmationPendingRef.current) return;

    const participant = participants.find((item) => item.userId === confirmation.participant.userId);
    if (!participant || participant.role === "owner" || participant.userId === user.id) {
      setConfirmationError("Este participante não pode ser removido do projeto.");
      return;
    }

    confirmationPendingRef.current = true;
    setIsConfirming(true);
    setConfirmationError("");
    try {
      await removeProjectParticipant(project.id, participant.userId);
      setParticipants((current) => current.filter((item) => item.userId !== participant.userId));
      await loadProject(user.id);
      setConfirmation(null);
      showNotice(`${participant.name} foi removido do projeto. Tarefas e mensagens foram preservadas.`);
    } catch (error) {
      setConfirmationError(error instanceof Error ? error.message : "Não foi possível remover o participante. Tente novamente.");
    } finally {
      confirmationPendingRef.current = false;
      setIsConfirming(false);
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
                  <Link
                    href={`/chat?projectId=${project.id}`}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-3.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    <MessageSquare className="size-4" aria-hidden="true" />
                    Chat
                  </Link>

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
                        onClick={() => openConfirmation({ action: "archive" })}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3.5 text-sm font-medium text-warning transition-colors hover:bg-warning/15"
                      >
                        <Archive className="size-4" aria-hidden="true" />
                        Arquivar
                      </button>
                      <button
                        type="button"
                        onClick={() => openConfirmation({ action: "trash" })}
                        className="inline-flex h-10 items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 text-sm font-medium text-danger transition-colors hover:bg-danger/15"
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Progresso
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">
                    {taskSummary.total > 0
                      ? Math.round((taskSummary.completed / taskSummary.total) * 100)
                      : 0}%
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-accent">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{
                        width: `${taskSummary.total > 0 ? (taskSummary.completed / taskSummary.total) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Tarefas
                  </p>
                  <p className="mt-2 text-2xl font-bold text-foreground">{taskSummary.total}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{taskSummary.open} abertas</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Equipe
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-2xl font-bold text-foreground">
                    <UsersRound className="size-5 text-primary" aria-hidden="true" />
                    {participants.length}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">participantes</p>
                </div>

                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Criado em</p>
                  <p className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                    <CalendarClock className="size-4 text-primary" aria-hidden="true" />
                    {formatProjectDate(project.createdAt)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">{getRoleLabel(projectRole)}</p>
                </div>
              </div>
            </section>

            <div className="surface-panel overflow-hidden">
              <div className="flex gap-1 overflow-x-auto border-b border-border px-3 pt-2">
                {([
                  ["overview", "Visão geral"],
                  ["tasks", "Tarefas"],
                  ["members", "Membros"],
                  ["files", "Arquivos"],
                  ["activity", "Atividade"],
                ] as Array<[ProjectTab, string]>).map(([tab, label]) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {activeTab === "overview" && (
                <div className="grid gap-4 p-5 lg:grid-cols-[1.25fr_0.75fr]">
                  <Panel title="Resumo das tarefas" bodyClassName="p-0">
                    <div className="divide-y divide-border">
                      <button type="button" onClick={() => setActiveTab("tasks")} className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-muted/40">
                        <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-primary"><Target className="size-4" aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-foreground">Organização das tarefas</span><span className="mt-1 block text-xs text-muted-foreground">{taskSummary.total} cadastradas · {taskSummary.completed} concluídas</span></span>
                        <span className="text-xs font-medium text-primary">Abrir</span>
                      </button>
                      <div className="grid grid-cols-3 gap-3 p-4">
                        <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Total</p><p className="mt-1 text-xl font-bold text-foreground">{taskSummary.total}</p></div>
                        <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Abertas</p><p className="mt-1 text-xl font-bold text-foreground">{taskSummary.open}</p></div>
                        <div className="rounded-xl bg-muted/40 p-3"><p className="text-xs text-muted-foreground">Concluídas</p><p className="mt-1 text-xl font-bold text-success">{taskSummary.completed}</p></div>
                      </div>
                    </div>
                  </Panel>

                  <div className="grid gap-4">
                    <Panel title="Marcos do projeto">
                      <div className="space-y-3">
                        {[
                          ["Projeto criado", true],
                          ["Tarefas organizadas", taskSummary.total > 0],
                          ["Primeira entrega concluída", taskSummary.completed > 0],
                        ].map(([label, done], index) => (
                          <div key={String(label)} className="flex items-center gap-3">
                            <span className={`grid size-7 place-items-center rounded-full text-xs font-semibold ${done ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                              {done ? <CheckCircle2 className="size-4" aria-hidden="true" /> : index + 1}
                            </span>
                            <span className={`text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                          </div>
                        ))}
                      </div>
                    </Panel>

                    <Panel title="Compartilhamento">
                      <p className="text-sm leading-6 text-muted-foreground">{isOwner ? "Convide participantes para colaborar neste projeto." : "Você participa deste projeto com acesso compartilhado."}</p>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">{participants.length} participantes</span>
                        {isOwner && !project.archivedAt && <button type="button" onClick={() => setIsShareDialogOpen(true)} className="rounded-lg border border-border px-3 py-2 text-xs font-medium text-foreground hover:bg-muted">Gerenciar</button>}
                      </div>
                    </Panel>
                  </div>
                </div>
              )}

              {activeTab === "tasks" && (
                <ProjectTasksPanel
                  projectId={project.id}
                  disabled={Boolean(project.archivedAt)}
                  listOnly
                />
              )}

              {activeTab === "members" && (
                <Panel title={`Participantes (${participants.length})`} bodyClassName="p-0">
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
                        className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:flex-nowrap"
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

                        {isOwner && participant.role !== "owner" && participant.userId !== user?.id && (
                          <button
                            type="button"
                            onClick={() => openConfirmation({ action: "remove-member", participant })}
                            disabled={isConfirming}
                            aria-label={`Remover ${participant.name} do projeto`}
                            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 px-2.5 py-2 text-xs font-medium text-danger transition-colors hover:bg-danger/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:cursor-not-allowed disabled:opacity-50 sm:ml-0"
                          >
                            <UserMinus className="size-3.5" aria-hidden="true" />
                            Remover
                          </button>
                        )}
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
              )}

              {activeTab === "files" && <Panel title="Arquivos" bodyClassName="p-0">
                <ProjectFilesPanel projectId={project.id} disabled={Boolean(project.archivedAt)} />
              </Panel>}

              {activeTab === "activity" && <EmptyState icon={<CalendarClock className="size-5" aria-hidden="true" />} title="Nenhuma atividade registrada" description="As alterações e atividades do projeto aparecerão aqui." />}
            </div>
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

      {project && (
        <ProjectConfirmationDialog
          open={confirmation !== null}
          title={confirmation?.action === "remove-member" ? "Remover membro?" : confirmation?.action === "trash" ? "Mover projeto para a lixeira?" : "Arquivar projeto?"}
          variant={confirmation?.action === "archive" ? "warning" : "danger"}
          icon={confirmation?.action === "remove-member" ? <UserMinus className="size-5" aria-hidden="true" /> : confirmation?.action === "trash" ? <Trash2 className="size-5" aria-hidden="true" /> : <Archive className="size-5" aria-hidden="true" />}
          description={confirmation?.action === "remove-member" ? (
            <>
              <p>
                <strong className="text-foreground">{confirmation.participant.name}</strong>{" "}
                perderá o acesso ao projeto{" "}
                <strong className="text-foreground">{project.name}</strong>{" "}
                e ao chat, arquivos e tarefas deste projeto.
              </p>
              <p>
                As tarefas e mensagens serão preservadas. Nas tarefas atribuídas a esse membro,
                o responsável aparecerá como <strong className="text-foreground">Usuário excluído</strong>.
              </p>
              <p>A conta do membro e suas outras conversas não serão apagadas.</p>
            </>
          ) : confirmation?.action === "trash" ? (
            <p>
              O projeto <strong className="text-foreground">{project.name}</strong>{" "}
              será movido para a lixeira e poderá ser restaurado depois.
              Seus dados não serão apagados permanentemente.
            </p>
          ) : (
            <p>
              O projeto <strong className="text-foreground">{project.name}</strong>{" "}
              sairá da lista ativa. Seus dados não serão apagados.
            </p>
          )}
          confirmLabel={confirmation?.action === "remove-member" ? "Remover membro" : confirmation?.action === "trash" ? "Mover para a lixeira" : "Arquivar projeto"}
          pendingLabel={confirmation?.action === "remove-member" ? "Removendo..." : confirmation?.action === "trash" ? "Movendo..." : "Arquivando..."}
          pending={isConfirming}
          error={confirmationError}
          onClose={closeConfirmation}
          onConfirm={() => {
            if (confirmation?.action === "remove-member") void handleRemoveProjectParticipant();
            else if (confirmation?.action === "trash") void handleMoveProjectToTrash();
            else if (confirmation?.action === "archive") void handleArchiveProject();
          }}
        />
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
