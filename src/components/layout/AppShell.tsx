"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  ClipboardPlus,
  ChevronDown,
  FolderKanban,
  FolderPlus,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import NewProjectDialog from "@/components/projects/NewProjectDialog";
import CreateTaskDialog from "@/components/tasks/CreateTaskDialog";
import { createProject, listAccessibleProjects } from "@/lib/projects";
import { searchGlobal, type GlobalSearchResult } from "@/lib/global-search";
import type { AccessibleProject, CreateProjectData } from "@/types";
import { useProjectAccessSync } from "@/hooks/useProjectAccessSync";

type AppShellProps = {
  children: ReactNode;
  userName: string;
  userInitial: string;
  onLogout: () => Promise<void> | void;
  onOpenNewTask?: () => void;
  createLabel?: string;
};

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/", available: true },
  {
  label: "Projetos",
  icon: FolderKanban,
  href: "/projects",
  available: true,
},
  {
    label: "Minhas tarefas",
    icon: ListChecks,
    href: "/tasks",
    available: true,
  },
  {
    label: "Calendário",
    icon: CalendarDays,
    href: "/calendar",
    available: true,
  },
  { label: "Chat", icon: MessageSquare, href: "/chat", available: true },
  { label: "IA", icon: Sparkles, href: "/ai", available: true },
  {
    label: "Notificações",
    icon: Bell,
    href: "/notifications",
    available: true,
  },
  {
    label: "Configurações",
    icon: Settings,
    href: "/settings",
    available: true,
  },
] as const;

function UserAvatar({
  initial,
  className = "",
}: {
  initial: string;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/25 ${className}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export default function AppShell({
  children,
  userName,
  userInitial,
  onLogout,
  onOpenNewTask,
  createLabel = "Novo projeto",
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  useProjectAccessSync();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = useState(false);
  const [isGlobalProjectOpen, setIsGlobalProjectOpen] = useState(false);
  const [isGlobalTaskOpen, setIsGlobalTaskOpen] = useState(false);
  const [globalUserId, setGlobalUserId] = useState("");
  const [globalProjects, setGlobalProjects] = useState<AccessibleProject[]>([]);
  const [globalProjectsLoading, setGlobalProjectsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const readCount = () => setUnreadNotifications(Number(window.localStorage.getItem("progressus:unread-notifications") || 0));
    readCount();
    window.addEventListener("progressus:notifications-changed", readCount);
    return () => window.removeEventListener("progressus:notifications-changed", readCount);
  }, []);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;

    void supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user.id;
      if (!userId || !active || pathname.startsWith("/chat")) return;
      channel = supabase.channel(`progressus-notifications-${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagem" }, async (payload) => {
          const message = payload.new as { id_mensagem?: string; id_chat?: string; id_usuario?: string; conteudo?: string | null; data_hora?: string };
          if (!message.id_mensagem || !message.id_chat || message.id_usuario === userId) return;
          const key = `progressus:chat-notifications:${userId}`;
          const current = JSON.parse(window.localStorage.getItem(key) || "[]") as Array<Record<string, unknown>>;
          if (current.some((item) => item.id === message.id_mensagem)) return;
          const { data: chat } = await supabase.from("chat").select("tipo, id_projeto").eq("id_chat", message.id_chat).maybeSingle();
          if (!active || !chat) return;
          const { data: senderRows } = chat?.tipo === "grupo" && chat.id_projeto
            ? await supabase.rpc("list_project_members", { p_project_id: chat.id_projeto })
            : await supabase.rpc("get_private_chat_user_names", { p_user_ids: [message.id_usuario] });
          const sender = (senderRows as Array<{ id_usuario?: string; nome?: string }> | null)?.find((item) => item.id_usuario === message.id_usuario);
          const senderName = sender?.nome?.trim() || "Novo participante";
          let title = `Nova mensagem de ${senderName}`;
          let href = `/chat?chatId=${message.id_chat}`;
          if (chat?.tipo === "grupo" && chat.id_projeto) {
            const { data: project } = await supabase.from("projeto").select("nome").eq("id_projeto", chat.id_projeto).maybeSingle();
            title = `Nova mensagem de ${senderName}`;
            href = `/chat?projectId=${chat.id_projeto}`;
            if (project?.nome) title += ` em ${project.nome}`;
          }
          const item = { id: message.id_mensagem, title, description: message.conteudo?.trim() || "Você recebeu uma nova mensagem.", href, kind: "chat", createdAt: message.data_hora || new Date().toISOString() };
          window.localStorage.setItem(key, JSON.stringify([item, ...current].slice(0, 100)));
          const unread = Number(window.localStorage.getItem("progressus:unread-notifications") || 0) + 1;
          window.localStorage.setItem("progressus:unread-notifications", String(unread));
          window.dispatchEvent(new Event("progressus:notifications-changed"));
        }).subscribe();
    });

    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [pathname]);

  useEffect(() => {
    const refreshProjects = (event: Event) => {
      const projects = (event as CustomEvent<{ projects: AccessibleProject[] }>).detail?.projects;
      if (projects) setGlobalProjects(projects);
    };
    window.addEventListener("progressus:project-access-checked", refreshProjects);
    return () => window.removeEventListener("progressus:project-access-checked", refreshProjects);
  }, []);

  useEffect(() => {
    if (!isCreateMenuOpen) return;
    let active = true;
    setGlobalProjectsLoading(true);
    void Promise.all([supabase.auth.getSession(), listAccessibleProjects()])
      .then(([sessionResult, projects]) => {
        if (!active) return;
        setGlobalUserId(sessionResult.data.session?.user.id ?? "");
        setGlobalProjects(projects);
      })
      .catch(() => {
        if (!active) return;
        setGlobalProjects([]);
        setGlobalUserId("");
        setNotice("Não foi possível carregar seus projetos. Abra o menu Criar para tentar novamente.");
      })
      .finally(() => {
        if (active) setGlobalProjectsLoading(false);
      });
    return () => { active = false; };
  }, [isCreateMenuOpen]);

  useEffect(() => {
    const term = searchTerm.trim();
    if (term.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearchLoading(true);
      void searchGlobal(term)
        .then((results) => {
          if (active) setSearchResults(results);
        })
        .catch(() => {
          if (active) {
            setSearchResults([]);
            setNotice("Não foi possível realizar a busca agora.");
          }
        })
        .finally(() => {
          if (active) setSearchLoading(false);
        });
    }, 280);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchTerm]);

  function handleSearchResult(result: GlobalSearchResult) {
    setSearchTerm("");
    setSearchOpen(false);
    router.push(result.href);
  }

  function resultKindLabel(kind: GlobalSearchResult['kind']) {
    return kind === 'project' ? 'Projeto' : kind === 'task' ? 'Tarefa' : 'Mensagem';
  }

  function showUnavailableFeature() {
    setNotice(
      "Esta funcionalidade será disponibilizada nas próximas etapas do Progressus.",
    );
    window.setTimeout(() => setNotice(""), 3200);
  }

  function handleOpenCreateMenu() {
    setIsMobileMenuOpen(false);
    setIsCreateMenuOpen((current) => !current);
  }

  function handleOpenNewTask() {
    setIsCreateMenuOpen(false);

    if (onOpenNewTask) {
      onOpenNewTask();
      return;
    }

    if (!globalUserId) {
      setNotice("Não foi possível identificar sua sessão. Entre novamente para criar uma tarefa.");
      return;
    }
    setIsGlobalTaskOpen(true);
  }

  function handleOpenNewProject() {
    setIsCreateMenuOpen(false);
    setIsGlobalProjectOpen(true);
  }

  async function handleGlobalProjectCreate(data: CreateProjectData) {
    const project = await createProject(data);
    setIsGlobalProjectOpen(false);
    router.push(`/projects/${project.id}`);
  }

  async function handleLogout() {
    setIsUserMenuOpen(false);
    await onLogout();
  }

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <div className="flex h-full flex-col px-3 py-4">
        <div className="flex items-center justify-between px-2">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 rounded-xl"
          >
            <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-[#0e0c17]">
              <img
                src="/brand/progressus-logo.png"
                alt="Logo Progressus"
                className="size-full object-contain p-1"
              />
            </span>

            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              Progressus
            </span>
          </Link>

          {mobile && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Fechar menu"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav
          className="mt-8 flex flex-col gap-0.5"
          aria-label="Navegação principal"
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.available &&
              (pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`)));

            if (!item.available) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={showUnavailableFeature}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-primary/12 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={`size-[18px] shrink-0 ${isActive ? "text-primary" : ""}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-1 pb-1">
          <button
            type="button"
            onClick={handleOpenCreateMenu}
            className="glow-accent flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
          >
            <Plus className="size-4" aria-hidden="true" />
            {createLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[270px] border-r border-border bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Fechar menu"
          />
          <aside className="relative h-full w-[min(280px,calc(100vw-2rem))] border-r border-border bg-sidebar shadow-2xl">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-[270px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-[18px]" aria-hidden="true" />
            </button>

            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => { setSearchTerm(event.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }}
                placeholder="Buscar projetos, tarefas e mensagens…"
                aria-label="Busca global"
                className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40 lg:max-w-md"
              />
              {searchOpen && searchTerm.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/30 lg:max-w-md">
                  {searchLoading ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">Buscando...</div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">Nenhum projeto, tarefa ou mensagem encontrada.</div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto p-1.5">
                      {searchResults.map((result) => (
                        <button key={`${result.kind}-${result.id}`} type="button" onClick={() => handleSearchResult(result)} className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-accent">
                          <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg bg-primary/12 text-primary"><Search className="size-3.5" aria-hidden="true" /></span>
                          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-foreground">{result.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{result.meta || result.description}</span></span>
                          <span className="shrink-0 text-[10px] text-muted-foreground">{resultKindLabel(result.kind)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleOpenCreateMenu}
                className="hidden h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-accent sm:flex"
              >
                <Plus className="size-4 text-primary" aria-hidden="true" />
                Criar
              </button>

              {isCreateMenuOpen && (
                <div className="absolute right-[118px] top-14 z-40 w-52 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/30">
                  <button type="button" onClick={handleOpenNewTask} disabled={globalProjectsLoading} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-accent disabled:opacity-50">
                    <ClipboardPlus className="size-4 text-primary" />
                    Nova tarefa
                  </button>
                  <button type="button" onClick={handleOpenNewProject} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-foreground transition hover:bg-accent">
                    <FolderPlus className="size-4 text-primary" />
                    Novo projeto
                  </button>
                </div>
              )}

              <Link
                href="/notifications"
                className="relative grid size-10 place-items-center rounded-xl border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Notificações"
              >
                <Bell className="size-[18px]" aria-hidden="true" />
                {unreadNotifications > 0 && <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-bold text-white">{unreadNotifications > 99 ? "99+" : unreadNotifications}</span>}
              </Link>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((current) => !current)}
                  className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface p-1.5 pr-2 text-foreground transition hover:bg-accent"
                  aria-label="Menu do usuário"
                  aria-expanded={isUserMenuOpen}
                >
                  <UserAvatar initial={userInitial} className="size-7" />
                  <ChevronDown
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/30">
                    <div className="border-b border-border px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {userName}
                      </p>
                    </div>

                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <UserRound className="size-4" aria-hidden="true" />
                      Perfil
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <Settings className="size-4" aria-hidden="true" />
                      Preferências
                    </Link>
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {notice && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-2xl shadow-black/30">
            {notice}
          </div>
        )}

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>

      <NewProjectDialog
        open={isGlobalProjectOpen}
        onClose={() => setIsGlobalProjectOpen(false)}
        onCreate={handleGlobalProjectCreate}
      />
      {isGlobalTaskOpen && globalUserId && (
        <CreateTaskDialog
          open
          projects={globalProjects}
          userId={globalUserId}
          onClose={() => setIsGlobalTaskOpen(false)}
          onRequestCreateProject={() => { setIsGlobalTaskOpen(false); setIsGlobalProjectOpen(true); }}
          onCreated={(task) => { setIsGlobalTaskOpen(false); router.push(`/projects/${task.id_projeto}/tasks`); }}
        />
      )}
    </div>
  );
}
