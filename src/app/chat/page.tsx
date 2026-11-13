"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Search,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

import AppShell from "@/components/layout/AppShell";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";

import {
  getOrCreateProjectChat,
  getOrCreatePrivateChat,
  listPrivateChats,
  listUnreadChatCounts,
  type PrivateChatSummary,
} from "@/lib/chat";
import {
  listAccessibleProjects,
  listProjectParticipants,
} from "@/lib/projects";
import { useChatMessages } from "@/hooks/chat/useChatMessages";
import { supabase } from "@/lib/supabase";

import type { AccessibleProject } from "@/types";
import type {
  ChatParticipant,
  ChatMentionDraft,
} from "@/types/chat";

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectedProjectId = searchParams.get("projectId");
  const selectedPrivateChatId = searchParams.get("chatId");

  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<AccessibleProject[]>([]);
  const [privateChats, setPrivateChats] = useState<PrivateChatSummary[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [groupChatIds, setGroupChatIds] = useState<Record<string, string>>({});
  const [startingPrivateChatId, setStartingPrivateChatId] = useState<
    string | null
  >(null);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState("geral");

  const [isLoading, setIsLoading] = useState(true);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [groupsOpen, setGroupsOpen] = useState(true);
  const [individualsOpen, setIndividualsOpen] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadInitialData() {
      try {
        const { data, error: authError } = await supabase.auth.getSession();

        if (authError || !data.session) {
          router.replace("/auth/login");
          return;
        }

        const currentUser = data.session.user;

        const [accessibleProjects, userPrivateChats] = await Promise.all([
          listAccessibleProjects(),
          listPrivateChats(currentUser.id),
        ]);

        if (!active) return;

        setUser(currentUser);
        setProjects(accessibleProjects);
        setPrivateChats(userPrivateChats);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar suas conversas.",
        );
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadInitialData();

    return () => {
      active = false;
    };
  }, [router]);

  useEffect(() => {
    let active = true;
    function refreshAccess(event: Event) {
      const accessible = (event as CustomEvent<{ projects: AccessibleProject[] }>).detail?.projects;
      if (!accessible) return;
      const available = accessible.filter((project) => !project.archivedAt);
      setProjects((current) => JSON.stringify(current) === JSON.stringify(available) ? current : available);
      if (!selectedProjectId || selectedPrivateChatId) return;
      if (!available.some((project) => project.id === selectedProjectId)) {
        setChatId(null);
        setParticipants([]);
        setProjectName(null);
        router.replace("/chat");
        return;
      }
      void listProjectParticipants(selectedProjectId).then((members) => {
        if (!active) return;
        setParticipants(members.map((member) => ({ id_usuario: member.userId, nome: member.name, email: member.email, papel: member.role })));
      }).catch(() => { /* Não descartar histórico durante falha transitória de rede. */ });
    }
    window.addEventListener("progressus:project-access-checked", refreshAccess);
    return () => {
      active = false;
      window.removeEventListener("progressus:project-access-checked", refreshAccess);
    };
  }, [selectedProjectId, selectedPrivateChatId, router]);

  const refreshUnreadCounts = useCallback(async () => {
    if (!user) return;

    try {
      const projectIds = projects.map((project) => project.id);

      let groupChats: { id_chat: string; id_projeto: string | null }[] = [];

      if (projectIds.length > 0) {
        const { data, error } = await supabase
          .from("chat")
          .select("id_chat, id_projeto")
          .eq("tipo", "grupo")
          .in("id_projeto", projectIds);

        if (error) throw error;

        groupChats = data ?? [];
      }

      const projectChatMap: Record<string, string> = {};

      for (const chat of groupChats) {
        if (chat.id_projeto) {
          projectChatMap[chat.id_projeto] = chat.id_chat;
        }
      }

      setGroupChatIds(projectChatMap);

      const allChatIds = [
        ...new Set([
          ...groupChats.map((chat) => chat.id_chat),
          ...privateChats.map((chat) => chat.chatId),
        ]),
      ];

      const counts = await listUnreadChatCounts(allChatIds, user.id);

      setUnreadCounts(counts);
    } catch (err) {
      console.error("Erro ao atualizar mensagens não lidas:", err);
    }
  }, [user, projects, privateChats]);

  useEffect(() => {
    if (!user || isLoading) return;

    void refreshUnreadCounts();

    const channel = supabase
      .channel("chat-unread-counts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagem",
        },
        () => {
          void refreshUnreadCounts();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagem_leitura",
        },
        () => {
          void refreshUnreadCounts();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, isLoading, refreshUnreadCounts]);

  useEffect(() => {
    let active = true;

    async function loadSelectedChat() {
      if (!user || isLoading) return;

      setError(null);
      setChatId(null);
      setParticipants([]);
      setProjectName(null);

      if (selectedPrivateChatId) {
        setIsChatLoading(true);

        const privateChat = privateChats.find(
          (item) => item.chatId === selectedPrivateChatId,
        );

        if (!privateChat) {
          setError("Conversa privada não encontrada ou sem acesso.");
          setIsChatLoading(false);
          return;
        }

        setChatId(privateChat.chatId);
        setSelectedParticipantId(privateChat.otherUserId);

        setParticipants([
          {
            id_usuario: privateChat.otherUserId,
            nome: privateChat.otherUserName,
            email: "",
            papel: "",
          },
        ]);

        setIsChatLoading(false);
        return;
      }

      if (selectedProjectId) {
        const project = projects.find((item) => item.id === selectedProjectId);

        if (!project) {
          setIsChatLoading(false);

          if (projects.length > 0) {
            setError("Projeto não encontrado ou você não tem acesso a ele.");
          }

          return;
        }

        try {
          setIsChatLoading(true);

          const [chat, projectParticipants] = await Promise.all([
            getOrCreateProjectChat(selectedProjectId),
            listProjectParticipants(selectedProjectId),
          ]);

          if (!active) return;

          setChatId(chat.id_chat);
          setProjectName(project.name);
          setSelectedParticipantId("geral");

          setParticipants(
            projectParticipants.map((participant) => ({
              id_usuario: participant.userId,
              nome: participant.name,
              email: participant.email,
              papel: participant.role,
            })),
          );
        } catch (err) {
          if (!active) return;

          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível abrir o chat do projeto.",
          );
        } finally {
          if (active) setIsChatLoading(false);
        }

        return;
      }

      setIsChatLoading(false);
      setSelectedParticipantId("geral");
    }

    void loadSelectedChat();

    return () => {
      active = false;
    };
  }, [
    selectedProjectId,
    selectedPrivateChatId,
    user,
    projects,
    privateChats,
    isLoading,
  ]);

  const {
    messages,
    firstUnreadMessageId,
    isLoading: isMessagesLoading,
    isSending,
    error: messageError,
    sendMessage,
  } = useChatMessages(
    chatId,
    user?.id ?? null,
    selectedProjectId,
    refreshUnreadCounts,
  );
  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const userName = String(
    user?.user_metadata?.nome ||
      user?.user_metadata?.name ||
      user?.email?.split("@")[0] ||
      "Usuário",
  );

  const userInitial = userName.charAt(0).toUpperCase() || "U";

  const normalizedSearch = search.trim().toLowerCase();

  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(normalizedSearch),
  );

  const filteredPrivateChats = privateChats.filter((chat) =>
    chat.otherUserName.toLowerCase().includes(normalizedSearch),
  );

  function handleSelectProject(projectId: string) {
    router.push(`/chat?projectId=${projectId}`);
  }

  function handleSelectPrivateChat(privateChatId: string) {
    router.push(`/chat?chatId=${privateChatId}`);
  }

  async function handleStartPrivateChat(otherUserId: string) {
    if (!user || startingPrivateChatId) return;

    try {
      setStartingPrivateChatId(otherUserId);
      setError(null);

      const chat = await getOrCreatePrivateChat(otherUserId);

      const updatedPrivateChats = await listPrivateChats(user.id);

      const existingSummary = updatedPrivateChats.find(
        (item) => item.chatId === chat.id_chat,
      );

      const participant = participants.find(
        (item) => item.id_usuario === otherUserId,
      );

      const newSummary: PrivateChatSummary = existingSummary ?? {
        chatId: chat.id_chat,
        otherUserId,
        otherUserName: participant?.nome ?? "Usuário",
      };

      setPrivateChats(
        existingSummary
          ? updatedPrivateChats
          : [...updatedPrivateChats, newSummary],
      );

      router.push(`/chat?chatId=${chat.id_chat}`);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível iniciar a conversa privada.",
      );
    } finally {
      setStartingPrivateChatId(null);
    }
  }

  function handleClearSelection() {
    router.push("/chat");
  }

  const hasSelection = Boolean(selectedProjectId || selectedPrivateChatId);

  return (
    <AppShell
      userName={userName}
      userInitial={userInitial}
      onLogout={handleLogout}
    >
      <main className="flex h-[calc(100vh-150px)] min-h-[420px] flex-col bg-background text-foreground">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          {/* Painel de conversas */}
          <aside
            className={`flex shrink-0 flex-col border-r border-border transition-all duration-300 ${
              isSidebarCollapsed ? "w-16" : "w-[280px]"
            }`}
          >
            {/* Cabeçalho */}
            <div
              className={`border-b border-border ${
                isSidebarCollapsed ? "flex justify-center p-3" : "p-4"
              }`}
            >
              {isSidebarCollapsed ? (
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  title="Expandir conversas"
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-violet-500 transition hover:bg-violet-600 hover:text-white active:bg-violet-700"
                >
                  <PanelLeftOpen size={19} />
                </button>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <h1 className="text-lg font-semibold">Conversas</h1>

                    <button
                      type="button"
                      onClick={() => setIsSidebarCollapsed(true)}
                      title="Recolher conversas"
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-violet-500 transition hover:bg-violet-600 hover:text-white active:bg-violet-700"
                    >
                      <PanelLeftClose size={18} />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                    <Search
                      size={16}
                      className="shrink-0 text-muted-foreground"
                    />

                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Buscar conversa..."
                      className="h-10 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                </>
              )}
            </div>

            {isSidebarCollapsed ? (
              /* Barra de ícones quando recolhida */
              <div className="flex flex-col items-center gap-3 p-3">
                <button
                  type="button"
                  onClick={() => setIsSidebarCollapsed(false)}
                  title="Pesquisar conversas"
                  className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-background hover:text-foreground"
                >
                  <Search size={20} />
                </button>

                <div className="w-full border-t border-border" />

                <button
                  type="button"
                  onClick={() => {
                    setGroupsOpen(true);
                    setIndividualsOpen(false);
                    setIsSidebarCollapsed(false);
                  }}
                  title="Grupos"
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                    selectedProjectId
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  <Users size={20} />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIndividualsOpen(true);
                    setGroupsOpen(false);
                    setIsSidebarCollapsed(false);
                  }}
                  title="Conversas individuais"
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition ${
                    selectedPrivateChatId
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-background hover:text-foreground"
                  }`}
                >
                  <MessageSquare size={20} />
                </button>
              </div>
            ) : (
              /* Lista completa quando expandida */
              <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3">
                {/* Grupos */}
                <section className="flex min-h-0 flex-1 flex-col">
                  <button
                    type="button"
                    onClick={() => setGroupsOpen((current) => !current)}
                    className="flex w-full shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-background"
                  >
                    {groupsOpen ? (
                      <ChevronDown size={17} />
                    ) : (
                      <ChevronRight size={17} />
                    )}

                    <Users size={17} />
                    <span>Grupos</span>

                    <span className="ml-auto text-xs text-muted-foreground">
                      {projects.length}
                    </span>
                  </button>

                  {groupsOpen && (
                    <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
                      {isLoading ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Carregando projetos...
                        </p>
                      ) : filteredProjects.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhum projeto encontrado.
                        </p>
                      ) : (
                        filteredProjects.map((project) => {
                          const isSelected = selectedProjectId === project.id;

                          return (
                            <button
                              key={project.id}
                              type="button"
                              onClick={() => handleSelectProject(project.id)}
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                                isSelected
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-foreground hover:bg-background"
                              }`}
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full bg-violet-400" />

                              <span className="min-w-0 flex-1 truncate">
                                {project.name}
                              </span>

                              {(unreadCounts[groupChatIds[project.id]] ?? 0) >
                                0 && (
                                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-violet-500 px-1.5 text-[10px] font-semibold text-white">
                                  {unreadCounts[groupChatIds[project.id]] > 99
                                    ? "99+"
                                    : unreadCounts[groupChatIds[project.id]]}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </section>

                <div className="shrink-0 border-t border-border" />

                {/* Individuais */}
                <section className="flex min-h-0 flex-1 flex-col">
                  <button
                    type="button"
                    onClick={() => setIndividualsOpen((current) => !current)}
                    className="flex w-full shrink-0 items-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold hover:bg-background"
                  >
                    {individualsOpen ? (
                      <ChevronDown size={17} />
                    ) : (
                      <ChevronRight size={17} />
                    )}

                    <MessageSquare size={17} />
                    <span>Individuais</span>

                    <span className="ml-auto text-xs text-muted-foreground">
                      {privateChats.length}
                    </span>
                  </button>

                  {individualsOpen && (
                    <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto">
                      {isLoading ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Carregando conversas...
                        </p>
                      ) : filteredPrivateChats.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhuma conversa individual encontrada.
                        </p>
                      ) : (
                        filteredPrivateChats.map((privateChat) => {
                          const isSelected =
                            selectedPrivateChatId === privateChat.chatId;

                          return (
                            <button
                              key={privateChat.chatId}
                              type="button"
                              onClick={() =>
                                handleSelectPrivateChat(privateChat.chatId)
                              }
                              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                                isSelected
                                  ? "bg-primary/10 font-medium text-primary"
                                  : "text-foreground hover:bg-background"
                              }`}
                            >
                              <span className="h-2 w-2 shrink-0 rounded-full bg-green-400" />

                              <span className="min-w-0 flex-1 truncate">
                                {privateChat.otherUserName}
                              </span>

                              {(unreadCounts[privateChat.chatId] ?? 0) > 0 && (
                                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-blue-500 px-1.5 text-[10px] font-semibold text-white">
                                  {unreadCounts[privateChat.chatId] > 99
                                    ? "99+"
                                    : unreadCounts[privateChat.chatId]}
                                </span>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                  )}
                </section>
              </div>
            )}
          </aside>

          {/* Área da conversa */}
          <section className="flex min-w-0 flex-1 flex-col">
            {!hasSelection ? (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <MessageSquare size={30} />
                </div>

                <h2 className="text-lg font-semibold">
                  Suas conversas em um só lugar
                </h2>

                <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                  Selecione um projeto ou uma conversa individual ao lado para
                  começar.
                </p>
              </div>
            ) : isChatLoading ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">
                  Abrindo conversa...
                </p>
              </div>
            ) : error ? (
              <div className="m-4 rounded-lg border border-red-700 bg-red-600 p-4 text-sm text-white">
                {error}

                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="ml-2 underline"
                >
                  Voltar
                </button>
              </div>
            ) : chatId && user ? (
              <>
                <ChatHeader
                  projectName={projectName ?? ""}
                  participants={participants}
                  selectedChat={selectedParticipantId}
                  currentUserId={user.id}
                  startingPrivateChatId={startingPrivateChatId}
                  onStartPrivateChat={handleStartPrivateChat}
                />

                <ChatMessages
                  key={chatId}
                  messages={messages}
                  currentUserId={user.id}
                  participants={participants}
                  isLoading={isMessagesLoading}
                  firstUnreadMessageId={firstUnreadMessageId}
                />

                {messageError && (
                  <div className="border-t bg-red-50 px-4 py-2 text-center text-sm text-red-600">
                    {messageError}
                  </div>
                )}

                <ChatInput
                  onSend={sendMessage}
                  isSending={isSending}
                  participants={participants}
                  isGroup={Boolean(selectedProjectId)}
                  currentUserId={user?.id ?? null}
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                Selecione uma conversa.
              </div>
            )}
          </section>
        </div>
      </main>
    </AppShell>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          Carregando chat...
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
