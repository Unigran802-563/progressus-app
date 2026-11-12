"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/lib/supabase";

import type {
  ChatMessage as ChatMessageType,
  ChatParticipant,
  ChatFile,
} from "@/types/chat";

import { ChatMessage } from "./ChatMessage";

type ChatMessagesProps = {
  messages: ChatMessageType[];
  currentUserId: string;
  participants: ChatParticipant[];
  isLoading: boolean;
  firstUnreadMessageId?: string | null;
};

export function ChatMessages({
  messages,
  currentUserId,
  participants,
  isLoading,
  firstUnreadMessageId = null,
}: ChatMessagesProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const initialPositionPendingRef = useRef(false);
  const initializedRef = useRef(false);
  const previousMessagesRef = useRef<ChatMessageType[]>([]);
  const previousFirstUnreadRef = useRef<string | null>(null);

  const [showNewMessageButton, setShowNewMessageButton] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const allFiles = useMemo(
    () => messages.flatMap((message) => message.arquivos ?? []),
    [messages],
  );

  const selectedFileIndex = allFiles.findIndex(
    (file) => file.id_arquivo === selectedFileId,
  );

  const selectedFile =
    selectedFileIndex >= 0 ? allFiles[selectedFileIndex] : null;

  function openFile(file: ChatFile) {
    setPreviewUrl(null);
    setSelectedFileId(file.id_arquivo);
    setDownloadUrl(null);
  }

  function closeViewer() {
    setSelectedFileId(null);
    setPreviewUrl(null);
    setDownloadUrl(null);
  }

  function navigateFile(direction: -1 | 1) {
    const nextIndex = selectedFileIndex + direction;

    if (nextIndex < 0 || nextIndex >= allFiles.length) return;

    setPreviewUrl(null);
    setSelectedFileId(allFiles[nextIndex].id_arquivo);
  }

  useEffect(() => {
    if (!selectedFile) return;

    let cancelled = false;

    async function loadPreviewUrl() {
      setPreviewLoading(true);
      setPreviewUrl(null);
      setDownloadUrl(null);

      const [
        { data: previewData, error: previewError },
        { data: downloadData, error: downloadError },
      ] = await Promise.all([
        supabase.storage
          .from("arquivos")
          .createSignedUrl(selectedFile!.caminho, 60 * 60),

        supabase.storage
          .from("arquivos")
          .createSignedUrl(selectedFile!.caminho, 60 * 60, {
            download: selectedFile!.nome,
          }),
      ]);

      if (cancelled) return;

      if (previewError || downloadError) {
        console.error(
          "Erro ao carregar arquivo:",
          previewError ?? downloadError,
        );
        setPreviewLoading(false);
        return;
      }

      setPreviewUrl(previewData.signedUrl);
      setDownloadUrl(downloadData.signedUrl);
      setPreviewLoading(false);
    }
    loadPreviewUrl();

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  useEffect(() => {
    if (!selectedFile) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSelectedFileId(null);
        setPreviewUrl(null);
        setDownloadUrl(null);
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        const nextIndex = selectedFileIndex + direction;

        if (nextIndex >= 0 && nextIndex < allFiles.length) {
          setPreviewUrl(null);
          setSelectedFileId(allFiles[nextIndex].id_arquivo);
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedFile, selectedFileIndex, allFiles]);

  function isNearBottom() {
    const container = containerRef.current;

    if (!container) return true;

    const distanceFromBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight;

    return distanceFromBottom < 120;
  }

  function scrollToBottom(behavior: ScrollBehavior = "auto") {
    const container = containerRef.current;

    if (!container) return;

    container.scrollTo({
      top: container.scrollHeight,
      behavior,
    });

    setShowNewMessageButton(false);
  }

  function scrollToFirstUnread() {
    const container = containerRef.current;

    console.log("[CHAT SCROLL] Iniciando posicionamento", {
      firstUnreadMessageId,
      containerExists: !!container,
    });

    if (!container) return;

    if (!firstUnreadMessageId) {
      console.log(
        "[CHAT SCROLL] Nenhuma mensagem não lida. Indo para o final.",
      );
      scrollToBottom();
      return;
    }

    const unreadElement = document.getElementById(
      `message-${firstUnreadMessageId}`,
    );

    console.log("[CHAT SCROLL] Elemento encontrado", {
      expectedId: `message-${firstUnreadMessageId}`,
      elementExists: !!unreadElement,
    });

    if (!unreadElement) {
      console.log("[CHAT SCROLL] Elemento não encontrado. Indo para o final.");
      scrollToBottom();
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const messageRect = unreadElement.getBoundingClientRect();

    const targetPosition =
      container.scrollTop +
      messageRect.top -
      containerRect.top -
      container.clientTop -
      16;

    console.log("[CHAT SCROLL] Medidas antes do scroll", {
      currentScrollTop: container.scrollTop,
      targetPosition,
      scrollHeight: container.scrollHeight,
      clientHeight: container.clientHeight,
      messageTop: messageRect.top,
      containerTop: containerRect.top,
    });

    container.scrollTo({
      top: targetPosition,
      behavior: "auto",
    });

    requestAnimationFrame(() => {
      console.log("[CHAT SCROLL] Resultado após o scroll", {
        actualScrollTop: container.scrollTop,
        expectedScrollTop: targetPosition,
        messageTopAfterScroll: unreadElement.getBoundingClientRect().top,
      });
    });
  }

  const scrollToFirstUnreadRef = useRef(scrollToFirstUnread);

  scrollToFirstUnreadRef.current = scrollToFirstUnread;

  useEffect(() => {
    if (isLoading || messages.length === 0) return;

    const content = contentRef.current;

    if (!content) return;

    const observer = new ResizeObserver(() => {
      if (!initialPositionPendingRef.current) return;

      scrollToFirstUnreadRef.current();
    });

    observer.observe(content);

    return () => observer.disconnect();
  }, [isLoading, messages.length]);

  useEffect(() => {
    if (isLoading) return;

    if (messages.length === 0) {
      initializedRef.current = false;
      previousMessagesRef.current = [];
      return;
    }

    const previousMessages = previousMessagesRef.current;

    if (!initializedRef.current) {
      initializedRef.current = true;
      initialPositionPendingRef.current = true;
      previousMessagesRef.current = messages;
      previousFirstUnreadRef.current = firstUnreadMessageId;

      console.log("[CHAT SCROLL] Inicialização", {
        messageCount: messages.length,
        firstUnreadMessageId,
        isLoading,
      });

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToFirstUnread();
        });
      });

      return;
    }

    if (previousFirstUnreadRef.current !== firstUnreadMessageId) {
      previousFirstUnreadRef.current = firstUnreadMessageId;
      initialPositionPendingRef.current = true;

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToFirstUnread();
        });
      });
    }

    const newMessages = messages.filter(
      (message) =>
        !previousMessages.some(
          (previous) => previous.id_mensagem === message.id_mensagem,
        ),
    );

    previousMessagesRef.current = messages;

    if (newMessages.length === 0) return;

    const lastNewMessage = newMessages[newMessages.length - 1];

    if (lastNewMessage.id_usuario === currentUserId) {
      scrollToBottom("smooth");
      return;
    }

    if (isNearBottom()) {
      scrollToBottom("smooth");
    } else {
      setShowNewMessageButton(true);
    }
  }, [messages, isLoading, firstUnreadMessageId, currentUserId]);

  function handleUserInteraction() {
    initialPositionPendingRef.current = false;
  }

  function handleScroll() {
    if (isNearBottom()) {
      setShowNewMessageButton(false);
    }
  }

  function getSenderName(message: ChatMessageType) {
    if (message.id_usuario === currentUserId) {
      return "Você";
    }

    if (message.id_usuario === null) {
      return "IA";
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
    <>
      <div className="relative min-h-0 flex-1">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          onWheel={handleUserInteraction}
          onTouchStart={handleUserInteraction}
          onPointerDown={handleUserInteraction}
          className="h-full min-h-0 overflow-y-auto p-4"
        >
          <div
            ref={contentRef}
            className="mx-auto flex max-w-4xl flex-col gap-3"
          >
            {messages.map((message) => (
              <div key={message.id_mensagem} className="scroll-mt-4">
                {firstUnreadMessageId === message.id_mensagem && (
                  <div className="flex items-center gap-3 py-3">
                    <div className="h-px flex-1 bg-violet-400" />
                    <span className="shrink-0 text-xs font-semibold text-violet-500">
                      Novas mensagens
                    </span>
                    <div className="h-px flex-1 bg-violet-400" />
                  </div>
                )}

                <div id={`message-${message.id_mensagem}`}>
                  <ChatMessage
                    message={message}
                    isOwn={message.id_usuario === currentUserId}
                    senderName={getSenderName(message)}
                    onOpenFile={openFile}
                  />
                </div>
              </div>
            ))}
          </div>
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

      {selectedFile && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          role="dialog"
          aria-modal="true"
          aria-label={`Visualizador: ${selectedFile.nome}`}
        >
          {/* Cabeçalho */}
          <div className="flex items-center justify-between gap-4 border-b border-white/10 bg-neutral-950 px-4 py-3 text-white">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {selectedFile.nome}
              </p>

              <p className="text-xs text-white/60">
                Arquivo {selectedFileIndex + 1} de {allFiles.length}
              </p>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {previewUrl && (
                <a
                  href={previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg px-3 py-2 text-sm font-medium !text-violet-600 transition hover:bg-violet-600 hover:!text-white"
                >
                  Abrir em outra aba
                </a>
              )}

              {downloadUrl && (
                <a
                  href={downloadUrl}
                  className="rounded-lg px-3 py-2 text-sm font-medium !text-green-600 transition hover:bg-green-600 hover:!text-white"
                >
                  Baixar
                </a>
              )}

              <button
                type="button"
                onClick={closeViewer}
                aria-label="Fechar visualizador"
                className="rounded-lg px-3 py-2 text-xl text-red-600 transition hover:bg-red-600 hover:text-white"
              >
                ×
              </button>
            </div>
          </div>

          {/* Área de visualização */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center p-4">
            {selectedFileIndex > 0 && (
              <button
                type="button"
                onClick={() => navigateFile(-1)}
                aria-label="Arquivo anterior"
                className="absolute left-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-3xl text-violet-500 transition hover:bg-violet-600 hover:text-white"
              >
                ‹
              </button>
            )}

            <div className="flex h-full w-full items-center justify-center">
              {previewLoading && (
                <p className="text-sm text-white/70">Carregando arquivo...</p>
              )}

              {!previewLoading && !previewUrl && (
                <p className="text-sm text-white/70">
                  Não foi possível carregar este arquivo.
                </p>
              )}

              {!previewLoading &&
                previewUrl &&
                selectedFile.tipo?.startsWith("image/") && (
                  <img
                    src={previewUrl}
                    alt={selectedFile.nome}
                    className="max-h-full max-w-full object-contain"
                  />
                )}

              {!previewLoading &&
                previewUrl &&
                selectedFile.tipo === "application/pdf" && (
                  <iframe
                    src={previewUrl}
                    title={selectedFile.nome}
                    className="h-full w-full rounded-lg bg-white"
                  />
                )}

              {!previewLoading &&
                previewUrl &&
                !selectedFile.tipo?.startsWith("image/") &&
                selectedFile.tipo !== "application/pdf" && (
                  <div className="max-w-md text-center text-white">
                    <div className="mb-4 text-6xl">📎</div>

                    <h3 className="text-lg font-semibold">
                      Este arquivo não possui pré-visualização disponível.
                    </h3>

                    <p className="mt-2 text-sm text-white/60">
                      Você pode baixá-lo ou abri-lo em outra aba.
                    </p>
                  </div>
                )}
            </div>

            {selectedFileIndex < allFiles.length - 1 && (
              <button
                type="button"
                onClick={() => navigateFile(1)}
                aria-label="Próximo arquivo"
                className="absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full text-3xl text-violet-500 transition hover:bg-violet-600 hover:text-white"
              >
                ›
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
