"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import AppShell from "@/components/layout/AppShell";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ChatInput } from "@/components/chat/ChatInput";
import { ChatMessages } from "@/components/chat/ChatMessages";
import { ChatSidebar } from "@/components/chat/ChatSidebar";
import { getOrCreatePrivateChat, getOrCreateProjectChat } from "@/lib/chat";
import { getProject, listProjectParticipants } from "@/lib/projects";
import { useChatMessages } from "@/hooks/chat/useChatMessages";
import { supabase } from "@/lib/supabase";
import type { ChatParticipant } from "@/types/chat";

type ChatPageProps = {
  params: Promise<{
    projectId: string;
  }>;
};

export default function ChatPage({ params }: ChatPageProps) {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [participants, setParticipants] = useState<ChatParticipant[]>([]);
  const [selectedChat, setSelectedChat] = useState<"geral" | string>("geral");
  const [chatId, setChatId] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(true);
  const [chatError, setChatError] = useState<string | null>(null);

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
      setIsAuthLoading(false);
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    async function loadChat() {
      try {
        const { projectId } = await params;

        setProjectId(projectId);

        if (!user) {
          return;
        }

        setIsChatLoading(true);
        setChatError(null);

        const [project, chat, projectParticipants] = await Promise.all([
          getProject(projectId),
          getOrCreateProjectChat(projectId),
          listProjectParticipants(projectId),
        ]);

        if (!project) {
          throw new Error("Projeto não encontrado.");
        }

        setProjectName(project.name);

        setParticipants(
          projectParticipants.map((participant) => ({
            id_usuario: participant.userId,
            nome: participant.name,
            email: participant.email,
            papel: participant.role,
          })),
        );

        setChatId(chat.id_chat);
      } catch (err) {
        setChatError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o chat.",
        );
      } finally {
        setIsChatLoading(false);
      }
    }

    if (!isAuthLoading) {
      void loadChat();
    }
  }, [params, user, isAuthLoading]);

  const userName = useMemo(() => {
    const metadataName = user?.user_metadata?.nome || user?.user_metadata?.name;

    if (metadataName) {
      return String(metadataName);
    }

    return user?.email?.split("@")[0] || "Usuário";
  }, [user]);

  const userInitial = userName.charAt(0).toUpperCase() || "U";

  const {
    messages,
    isLoading: isMessagesLoading,
    isSending,
    error: messageError,
    sendMessage,
  } = useChatMessages(chatId, user?.id ?? null, projectId);

  async function handleSelectGeneral() {
    if (!projectId) {
      return;
    }

    try {
      setChatError(null);

      const generalChat = await getOrCreateProjectChat(projectId);

      setSelectedChat("geral");
      setChatId(generalChat.id_chat);
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Não foi possível abrir o chat geral.",
      );
    }
  }

  async function handleSelectPrivate(userId: string) {
    if (!projectId) {
      return;
    }

    try {
      setChatError(null);

      const privateChat = await getOrCreatePrivateChat(projectId, userId);

      setSelectedChat(userId);
      setChatId(privateChat.id_chat);
    } catch (err) {
      setChatError(
        err instanceof Error
          ? err.message
          : "Não foi possível abrir a conversa privada.",
      );
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  if (isAuthLoading || isChatLoading) {
    return (
      <AppShell
        userName={userName}
        userInitial={userInitial}
        onLogout={handleLogout}
      >
        <main className="flex min-h-[calc(100vh-97px)] items-center justify-center bg-background text-foreground">
          <p className="text-sm text-gray-500">Carregando chat...</p>
        </main>
      </AppShell>
    );
  }

  if (!user) {
    return (
      <AppShell
        userName={userName}
        userInitial={userInitial}
        onLogout={handleLogout}
      >
        <main className="flex min-h-[calc(100vh-97px)] items-center justify-center bg-background text-foreground">
          <p>Você precisa estar autenticado.</p>
        </main>
      </AppShell>
    );
  }

  if (chatError) {
    return (
      <AppShell
        userName={userName}
        userInitial={userInitial}
        onLogout={handleLogout}
      >
        <main className="flex h-[calc(100vh-97px)] min-h-0 flex-col bg-background text-foreground">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
            Erro: {chatError}
          </div>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell
      userName={userName}
      userInitial={userInitial}
      onLogout={handleLogout}
    >
      <main className="flex h-[calc(100vh-97px)] min-h-0 flex-col bg-background text-foreground">
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-xl border border-border bg-surface">
          <ChatSidebar
            projectName={projectName ?? "Projeto"}
            participants={participants}
            currentUserId={user.id}
            selectedChat={selectedChat}
            onSelectGeneral={handleSelectGeneral}
            onSelectPrivate={handleSelectPrivate}
          />

          <section className="flex min-h-0 min-w-[320px] flex-1 basis-0 flex-col">
            <ChatHeader
              projectName={projectName ?? "Projeto"}
              participants={participants}
              selectedChat={selectedChat}
            />

            <ChatMessages
              messages={messages}
              currentUserId={user.id}
              participants={participants}
              isLoading={isMessagesLoading}
            />

            {messageError && (
              <div className="border-t bg-red-50 px-4 py-2 text-center text-sm text-red-600">
                {messageError}
              </div>
            )}

            <ChatInput onSend={sendMessage} isSending={isSending} />
          </section>
        </div>
      </main>
    </AppShell>
  );
}
