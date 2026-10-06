"use client";

import type { ChatParticipant } from "@/types/chat";

type ChatHeaderProps = {
  projectName: string;
  participants: ChatParticipant[];
  selectedChat: "geral" | string;
};

export function ChatHeader({
  projectName,
  participants,
  selectedChat,
}: ChatHeaderProps) {
  const selectedParticipant = participants.find(
    (participant) => participant.id_usuario === selectedChat,
  );

  const isPrivateChat = selectedChat !== "geral";

  return (
    <header className="flex h-16 shrink-0 items-center border-b border-border bg-surface px-6">
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
    </header>
  );
}
