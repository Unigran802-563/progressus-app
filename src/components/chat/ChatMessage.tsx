"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";
import type { ChatMessage as ChatMessageType } from "@/types/chat";

type ChatMessageProps = {
  message: ChatMessageType;
  isOwn: boolean;
  senderName: string;
};

export function ChatMessage({ message, isOwn, senderName }: ChatMessageProps) {
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    async function loadFileUrls() {
      if (!message.arquivos || message.arquivos.length === 0) {
        return;
      }

      const urls: Record<string, string> = {};

      for (const file of message.arquivos) {
        const { data, error } = await supabase.storage
          .from("arquivos")
          .createSignedUrl(file.caminho, 60 * 60);

        if (error) {
          console.error("Erro ao gerar URL do arquivo:", file.nome, error);
          continue;
        }

        if (data?.signedUrl) {
          urls[file.id_arquivo] = data.signedUrl;
        }
      }

      setFileUrls(urls);
    }

    loadFileUrls();
  }, [message.arquivos]);

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 shadow-sm ${
          isOwn
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-surface text-foreground"
        }`}
      >
        <span
          className={`mb-1 block text-xs font-semibold ${
            isOwn ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {isOwn ? "Você" : senderName}
        </span>

        {message.conteudo && (
          <p className="whitespace-pre-wrap break-words text-sm">
            {message.conteudo}
          </p>
        )}

        {message.arquivos && message.arquivos.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.arquivos.map((file) => {
              const fileUrl = fileUrls[file.id_arquivo];

              const isImage = file.tipo?.startsWith("image/");

              if (isImage && fileUrl) {
                return (
                  <a
                    key={file.id_arquivo}
                    href={fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg"
                  >
                    <img
                      src={fileUrl}
                      alt={file.nome}
                      className="max-h-80 max-w-full rounded-lg object-contain"
                    />
                  </a>
                );
              }

              return (
                <a
                  key={file.id_arquivo}
                  href={fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-3 rounded-lg border px-3 py-2 transition hover:opacity-80 ${
                    isOwn ? "border-primary-foreground/20" : "border-border"
                  }`}
                >
                  <span className="text-lg">📎</span>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{file.nome}</p>

                    <p
                      className={`text-xs ${
                        isOwn
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      }`}
                    >
                      {file.tamanho !== null
                        ? `${(file.tamanho / 1024 / 1024).toFixed(2)} MB`
                        : "Arquivo"}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>
        )}

        <span
          className={`mt-1 block text-xs ${
            isOwn ? "text-primary-foreground/75" : "text-muted-foreground"
          }`}
        >
          {new Date(message.data_hora).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  );
}
