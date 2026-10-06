"use client";

import { useState } from "react";

import { ChevronLeft, ChevronRight, MessageSquare, User } from "lucide-react";

import type { ChatParticipant } from "@/types/chat";

type ChatSidebarProps = {
  projectName: string;
  participants: ChatParticipant[];
  currentUserId: string;
  selectedChat: "geral" | string;
  onSelectGeneral: () => void;
  onSelectPrivate: (userId: string) => void;
};

export function ChatSidebar({
  projectName,
  participants,
  currentUserId,
  selectedChat,
  onSelectGeneral,
  onSelectPrivate,
}: ChatSidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const otherParticipants = participants.filter(
    (participant) => participant.id_usuario !== currentUserId,
  );

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-border bg-surface transition-all duration-200 ${
        isCollapsed ? "w-16" : "w-72"
      }`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-4">
        {!isCollapsed && (
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">Conversas</h2>

            <p className="mt-1 truncate text-xs text-muted-foreground">
              {projectName}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsCollapsed((current) => !current)}
          className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
          aria-label={isCollapsed ? "Expandir conversas" : "Recolher conversas"}
        >
          {isCollapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Chat geral */}
        <button
          type="button"
          onClick={onSelectGeneral}
          className={`flex w-full items-center rounded-lg py-3 text-left transition-colors ${
            isCollapsed ? "justify-center px-0" : "gap-3 px-3"
          } ${
            selectedChat === "geral"
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-background"
          }`}
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/15">
            <MessageSquare className="size-4" aria-hidden="true" />
          </span>

          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">Geral</p>

              <p className="truncate text-xs text-muted-foreground">
                Chat do projeto
              </p>
            </div>
          )}
        </button>

        {/* Conversas privadas */}
        {otherParticipants.length > 0 && (
          <div className="mt-5">
            {!isCollapsed && (
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Privadas
              </p>
            )}

            <div className="space-y-1">
              {otherParticipants.map((participant) => (
                <button
                  key={participant.id_usuario}
                  type="button"
                  onClick={() => onSelectPrivate(participant.id_usuario)}
                  className={`flex w-full items-center rounded-lg py-3 text-left transition-colors ${
                    isCollapsed ? "justify-center px-0" : "gap-3 px-3"
                  } ${
                    selectedChat === participant.id_usuario
                      ? "bg-primary/10 text-primary"
                      : "text-foreground hover:bg-background"
                  }`}
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-muted-foreground">
                    <User className="size-4" aria-hidden="true" />
                  </span>

                  {!isCollapsed && (
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {participant.nome}
                      </p>

                      <p className="truncate text-xs text-muted-foreground">
                        {participant.email}
                      </p>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
