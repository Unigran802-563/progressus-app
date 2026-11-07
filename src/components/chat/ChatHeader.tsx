"use client";

import { useState } from "react";
import { Loader2, MessageSquare, Users, X } from "lucide-react";
import type { ChatParticipant } from "@/types/chat";

type ChatHeaderProps = {
  projectName: string;
  participants: ChatParticipant[];
  selectedChat: "geral" | string;
  currentUserId?: string;
  startingPrivateChatId?: string | null;
  onStartPrivateChat?: (userId: string) => void;
};

export function ChatHeader({
  projectName,
  participants,
  selectedChat,
  currentUserId,
  startingPrivateChatId,
  onStartPrivateChat,
}: ChatHeaderProps) {
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);

  const selectedParticipant = participants.find(
    (participant) => participant.id_usuario === selectedChat,
  );

  const isPrivateChat = selectedChat !== "geral";

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-6">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-foreground">
          {isPrivateChat
            ? (selectedParticipant?.nome ?? "Conversa privada")
            : "Chat geral"}
        </h1>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {isPrivateChat ? (
            <p className="truncate">Conversa privada</p>
          ) : (
            <>
              <p className="truncate">{projectName}</p>
              <span aria-hidden="true">•</span>
              <span>
                {participants.length}{" "}
                {participants.length === 1 ? "participante" : "participantes"}
              </span>
            </>
          )}
        </div>
      </div>

      {!isPrivateChat && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsParticipantsOpen((current) => !current)}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-green-600 transition-colors hover:bg-green-600 hover:text-white active:bg-green-700"
          >
            <Users className="size-4" />
            <span className="hidden sm:inline">Participantes</span>
          </button>

          {isParticipantsOpen && (
            <div className="absolute right-0 top-12 z-30 flex max-h-[min(420px,calc(100vh-120px))] w-72 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
              <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Participantes
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {participants.length}{" "}
                    {participants.length === 1 ? "pessoa" : "pessoas"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsParticipantsOpen(false)}
                  className="grid size-8 place-items-center rounded-lg text-red-600 transition-colors hover:bg-red-600 hover:text-white active:bg-red-700"
                  aria-label="Fechar participantes"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
                {participants.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                    Nenhum participante encontrado.
                  </p>
                ) : (
                  participants.map((participant) => {
                    const isCurrentUser =
                      participant.id_usuario === currentUserId;

                    const isStarting =
                      startingPrivateChatId === participant.id_usuario;

                    return (
                      <div
                        key={participant.id_usuario}
                        className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-background"
                      >
                        <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-violet-600 bg-transparent text-sm font-semibold text-violet-600">
                          {isCurrentUser
                            ? "V"
                            : participant.nome.charAt(0).toUpperCase()}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {isCurrentUser ? "Você" : participant.nome}
                          </p>

                          <p className="truncate text-xs text-muted-foreground">
                            {isCurrentUser
                              ? "Seu usuário"
                              : participant.papel === "owner"
                                ? "Proprietário"
                                : participant.papel === "viewer"
                                  ? "Visualizador"
                                  : "Participante"}
                          </p>
                        </div>

                        {!isCurrentUser && (
                          <button
                            type="button"
                            onClick={() =>
                              onStartPrivateChat?.(participant.id_usuario)
                            }
                            disabled={
                              Boolean(startingPrivateChatId) ||
                              !onStartPrivateChat
                            }
                            className="grid size-9 shrink-0 place-items-center rounded-lg text-violet-600 transition-colors hover:bg-violet-600 hover:text-white active:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                            aria-label={`Conversar com ${participant.nome}`}
                            title="Iniciar conversa privada"
                          >
                            {isStarting ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : (
                              <MessageSquare className="size-4" />
                            )}
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
