"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  listChatMessages,
  sendChatMessage,
  uploadChatFile,
  markChatMessagesAsRead,
} from "@/lib/chat";

import { supabase } from "@/lib/supabase";

import type { ChatMessage, ChatMentionDraft } from "@/types/chat";

export type ChatFileDraft = {
  file: File;
  content: string;
};

type UseChatMessagesReturn = {
  messages: ChatMessage[];
  firstUnreadMessageId: string | null;
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  sendMessage: (
    content: string,
    files: ChatFileDraft[],
    mentions: ChatMentionDraft[],
  ) => Promise<void>;
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 3;

export function useChatMessages(
  chatId: string | null,
  userId: string | null,
  projectId: string | null,
  onMessagesRead?: () => void,
): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [firstUnreadMessageId, setFirstUnreadMessageId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const messagesRef = useRef<ChatMessage[]>([]);
  const currentChatIdRef = useRef<string | null>(chatId);
  const unreadPositionCapturedChatIdRef = useRef<string | null>(null);
  const onMessagesReadRef = useRef(onMessagesRead);
  const requestIdRef = useRef(0);

  useEffect(() => {
    onMessagesReadRef.current = onMessagesRead;
  }, [onMessagesRead]);

  currentChatIdRef.current = chatId;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const markMessagesAsRead = useCallback(
    async (items: ChatMessage[]) => {
      if (
        !userId ||
        typeof document === "undefined" ||
        document.visibilityState !== "visible" ||
        !document.hasFocus()
      ) {
        return;
      }

      const unreadMessageIds = items
        .filter((message) => message.id_usuario !== userId)
        .map((message) => message.id_mensagem);

      if (!unreadMessageIds.length) return;

      try {
        await markChatMessagesAsRead(unreadMessageIds, userId);

        onMessagesReadRef.current?.();
      } catch (err) {
        console.error("Erro ao marcar mensagens como lidas:", err);
      }
    },
    [userId],
  );

  const captureFirstUnreadMessage = useCallback(
    async (items: ChatMessage[], currentChatId: string, requestId: number) => {
      if (!userId) return;

      if (unreadPositionCapturedChatIdRef.current === currentChatId) {
        console.log("[CHAT UNREAD] Captura já realizada", currentChatId);
        return;
      }

      const incomingMessages = items.filter(
        (message) => message.id_usuario !== userId,
      );

      if (!incomingMessages.length) {
        if (
          currentChatIdRef.current === currentChatId &&
          requestIdRef.current === requestId
        ) {
          setFirstUnreadMessageId(null);
          unreadPositionCapturedChatIdRef.current = currentChatId;
        }
        return;
      }

      const incomingIds = incomingMessages.map(
        (message) => message.id_mensagem,
      );

      const { data: readMessages, error: readError } = await supabase
        .from("mensagem_leitura")
        .select("id_mensagem")
        .eq("id_usuario", userId)
        .in("id_mensagem", incomingIds);

      if (readError) {
        throw new Error(readError.message);
      }

      if (
        currentChatIdRef.current !== currentChatId ||
        requestIdRef.current !== requestId
      ) {
        return;
      }

      const readIds = new Set(
        (readMessages ?? []).map((item) => item.id_mensagem),
      );

      const firstUnread = incomingMessages.find(
        (message) => !readIds.has(message.id_mensagem),
      );

      console.log(
        "[CHAT UNREAD] userId:",
        userId,
        "| totalIncoming:",
        incomingMessages.length,
        "| incomingIds:",
        incomingMessages.map((message) => message.id_mensagem),
        "| readIds:",
        Array.from(readIds),
        "| firstUnreadId:",
        firstUnread?.id_mensagem ?? null,
      );

      setFirstUnreadMessageId(firstUnread?.id_mensagem ?? null);
      unreadPositionCapturedChatIdRef.current = currentChatId;
    },
    [userId],
  );

  const loadMessages = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    messagesRef.current = [];
    unreadPositionCapturedChatIdRef.current = null;
    setFirstUnreadMessageId(null);

    if (!chatId) {
      setMessages([]);
      setFirstUnreadMessageId(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await listChatMessages(chatId);

      if (
        currentChatIdRef.current !== chatId ||
        requestIdRef.current !== requestId
      ) {
        return;
      }

      if (currentChatIdRef.current !== chatId) return;

      await captureFirstUnreadMessage(data, chatId, requestId);

      if (
        currentChatIdRef.current !== chatId ||
        requestIdRef.current !== requestId
      ) {
        return;
      }

      if (currentChatIdRef.current !== chatId) return;

      messagesRef.current = data;
      setMessages(data);

      void markMessagesAsRead(data);
    } catch (err) {
      if (
        currentChatIdRef.current !== chatId ||
        requestIdRef.current !== requestId
      ) {
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as mensagens.",
      );
    } finally {
      if (
        currentChatIdRef.current === chatId &&
        requestIdRef.current === requestId
      ) {
        setIsLoading(false);
      }
    }
  }, [chatId, captureFirstUnreadMessage, markMessagesAsRead]);

  const refreshMessages = useCallback(async () => {
    if (!chatId) return;

    try {
      const data = await listChatMessages(chatId);

      if (currentChatIdRef.current !== chatId) return;

      messagesRef.current = data;
      setMessages(data);

      void markMessagesAsRead(data);
    } catch (err) {
      console.error("Erro ao atualizar mensagens:", err);
    }
  }, [chatId, markMessagesAsRead]);

  useEffect(() => {
    void loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!chatId || !userId) return;

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void markMessagesAsRead(messagesRef.current);
      }
    }

    function handleWindowFocus() {
      void markMessagesAsRead(messagesRef.current);
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [chatId, userId, markMessagesAsRead]);

  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`chat-messages-${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagem",
          filter: `id_chat=eq.${chatId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;

          setMessages((current) => {
            const alreadyExists = current.some(
              (message) => message.id_mensagem === newMessage.id_mensagem,
            );

            if (alreadyExists) return current;

            const updated = [...current, newMessage];
            messagesRef.current = updated;

            return updated;
          });

          void markMessagesAsRead([newMessage]);
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "arquivo",
        },
        () => {
          void refreshMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, refreshMessages, markMessagesAsRead]);

  async function sendMessage(
    content: string,
    files: ChatFileDraft[],
    mentions: ChatMentionDraft[] = [],
  ) {
    if (!chatId || !userId) {
      throw new Error("Não foi possível identificar o chat ou usuário.");
    }

    if (files.length > MAX_FILES) {
      throw new Error("Você pode enviar no máximo 3 arquivos por vez.");
    }

    for (const item of files) {
      if (item.file.size > MAX_FILE_SIZE) {
        throw new Error(
          `O arquivo "${item.file.name}" ultrapassa o limite de 50 MB.`,
        );
      }
    }

    if (!content.trim() && files.length === 0) {
      throw new Error("Digite uma mensagem ou anexe um arquivo.");
    }

    try {
      setIsSending(true);
      setError(null);

      if (content.trim()) {
        const { error: sendError } = await supabase.rpc(
          "send_chat_message_with_mentions",
          {
            p_chat_id: chatId,
            p_content: content,
            p_mentions: mentions,
          },
        );

        if (sendError) {
          throw new Error(sendError.message);
        }
      }

      for (const item of files) {
        const message = await sendChatMessage(chatId, userId, item.content);

        await uploadChatFile(
          chatId,
          message.id_mensagem,
          item.file,
        );
      }

      await refreshMessages();
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Não foi possível enviar as mensagens.";

      setError(errorMessage);
      throw err;
    } finally {
      setIsSending(false);
    }
  }

  return {
    messages,
    firstUnreadMessageId,
    isLoading,
    isSending,
    error,
    sendMessage,
  };
}
