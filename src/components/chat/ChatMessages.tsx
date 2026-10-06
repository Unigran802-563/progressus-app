"use client";

import { useEffect, useRef, useState } from "react";

import type {
  ChatMessage as ChatMessageType,
  ChatParticipant,
} from "@/types/chat";

import { ChatMessage } from "./ChatMessage";

type ChatMessagesProps = {
  messages: ChatMessageType[];
  currentUserId: string;
  participants: ChatParticipant[];
  isLoading: boolean;
};

export function ChatMessages({
  messages,
  currentUserId,
  participants,
  isLoading,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const [showNewMessageButton, setShowNewMessageButton] = useState(false);

  const isNearBottom = () => {
    const container = containerRef.current;

    if (!container) {
      return true;
    }

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    return distanceFromBottom < 120;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({
      behavior,
      block: "end",
    });

    setShowNewMessageButton(false);
  };

  useEffect(() => {
    if (messages.length === 0) {
      return;
    }

    const container = containerRef.current;

    if (!container) {
      return;
    }

    const wasNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      120;

    if (wasNearBottom) {
      scrollToBottom("smooth");
    } else {
      setShowNewMessageButton(true);
    }
  }, [messages]);

  useEffect(() => {
    if (!containerRef.current || messages.length === 0) {
      return;
    }

    scrollToBottom("auto");
  }, []);

  function handleScroll() {
    if (isNearBottom()) {
      setShowNewMessageButton(false);
    }
  }

  function getSenderName(message: ChatMessageType) {
    if (message.id_usuario === currentUserId) {
      return "Você";
    }

    const participant = participants.find(
      (item) => item.id_usuario === message.id_usuario,
    );

    return participant?.nome ?? "Usuário";
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-gray-500">Carregando mensagens...</p>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-lg font-semibold">Nenhuma mensagem ainda</h2>

          <p className="mt-1 text-sm text-gray-500">
            Seja o primeiro a enviar uma mensagem.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="relative min-h-0 flex-1 overflow-y-auto p-4"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-3">
        {messages.map((message) => (
          <ChatMessage
            key={message.id_mensagem}
            message={message}
            isOwn={message.id_usuario === currentUserId}
            senderName={getSenderName(message)}
          />
        ))}

        <div ref={bottomRef} />
      </div>

      {showNewMessageButton && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          className="sticky bottom-4 left-1/2 z-10 mx-auto flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-md transition hover:opacity-90"
        >
          ↓ Nova mensagem
        </button>
      )}
    </div>
  );
}
