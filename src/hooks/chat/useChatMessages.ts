"use client";

import { useCallback, useEffect, useState } from "react";

import { listChatMessages, sendChatMessage, uploadChatFile } from "@/lib/chat";
import { supabase } from "@/lib/supabase";

import type { ChatMessage } from "@/types/chat";

type UseChatMessagesReturn = {
  messages: ChatMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
};

export function useChatMessages(
  chatId: string | null,
  userId: string | null,
  projectId: string | null,
): UseChatMessagesReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(async () => {
    if (!chatId) {
      setMessages([]);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const data = await listChatMessages(chatId);

      setMessages(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar as mensagens.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!chatId) {
      return;
    }

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

            if (alreadyExists) {
              return current;
            }

            return [...current, newMessage];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  async function sendMessage(content: string, file?: File) {
    if (!chatId || !userId) {
      throw new Error("Não foi possível identificar o chat ou usuário.");
    }

    console.log("Arquivo selecionado:", file);
    console.log("Nome:", file?.name);
    console.log("Tamanho:", file?.size);
    console.log("Tipo:", file?.type);

    try {
      setIsSending(true);
      setError(null);

      console.log("Antes de criar mensagem:", {
        content,
        file: file?.name,
        projectId,
        chatId,
        userId,
      });

      const message = await sendChatMessage(chatId, userId, content);

      console.log("Mensagem criada:", message.id_mensagem);

      if (file && projectId) {
        console.log("Iniciando upload:", file.name);

        const filePath = await uploadChatFile(
          projectId,
          message.id_mensagem,
          file,
        );

        console.log("Arquivo enviado para:", filePath);
      }

      setMessages((current) => {
        const alreadyExists = current.some(
          (item) => item.id_mensagem === message.id_mensagem,
        );

        if (alreadyExists) {
          return current;
        }

        return [...current, message];
      });
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Não foi possível enviar a mensagem.";

      setError(message);
      throw err;
    } finally {
      setIsSending(false);
    }
  }

  return {
    messages,
    isLoading,
    isSending,
    error,
    sendMessage,
  };
}
