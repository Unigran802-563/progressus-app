"use client";

import {
  FormEvent,
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  AlertCircle,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  File,
  FileImage,
  FileText,
  MessageSquareText,
  Paperclip,
  Send,
  X,
} from "lucide-react";

import type { ChatFileDraft } from "@/hooks/chat/useChatMessages";

import type { ChatMentionDraft, ChatParticipant } from "@/types/chat";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_FILES = 3;

type ChatInputProps = {
  onSend: (
    message: string,
    files: ChatFileDraft[],
    mentions: ChatMentionDraft[],
  ) => Promise<void>;
  isSending: boolean;
  participants: ChatParticipant[];
  isGroup: boolean;
  currentUserId: string | null;
};

type MentionOption = {
  id: string;
  label: string;
  insertText: string;
  description: string;
  tipo: ChatMentionDraft["tipo"];
  id_usuario: string | null;
};

function adjustMentionsAfterEdit(
  mentions: ChatMentionDraft[],
  previousText: string,
  nextText: string,
): ChatMentionDraft[] {
  let prefix = 0;

  while (
    prefix < previousText.length &&
    prefix < nextText.length &&
    previousText[prefix] === nextText[prefix]
  ) {
    prefix++;
  }

  let suffix = 0;

  while (
    suffix < previousText.length - prefix &&
    suffix < nextText.length - prefix &&
    previousText[previousText.length - 1 - suffix] ===
      nextText[nextText.length - 1 - suffix]
  ) {
    suffix++;
  }

  const oldEnd = previousText.length - suffix;
  const newEnd = nextText.length - suffix;
  const difference = newEnd - oldEnd;

  return mentions
    .filter((mention) => mention.fim <= prefix || mention.inicio >= oldEnd)
    .map((mention) => {
      if (mention.inicio >= oldEnd) {
        return {
          ...mention,
          inicio: mention.inicio + difference,
          fim: mention.fim + difference,
        };
      }

      return mention;
    })
    .filter(
      (mention) =>
        nextText.slice(mention.inicio, mention.fim) === mention.texto,
    );
}

export function ChatInput({
  onSend,
  isSending,
  participants,
  isGroup,
  currentUserId,
}: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<ChatFileDraft[]>([]);
  const [editingFileIndex, setEditingFileIndex] = useState<number | null>(null);
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notification, setNotification] = useState("");
  const [mentionQuery, setMentionQuery] = useState<{
    start: number;
    end: number;
    query: string;
  } | null>(null);
  const [mentions, setMentions] = useState<ChatMentionDraft[]>([]);

  const [activeMentionIndex, setActiveMentionIndex] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const mentionOptions = useMemo<MentionOption[]>(() => {
    if (!mentionQuery) return [];

    const query = mentionQuery.query.toLocaleLowerCase("pt-BR");

    const options: MentionOption[] = [
      {
        id: "ia",
        label: "@IA",
        insertText: "@IA",
        description: "Assistente de inteligência artificial",
        tipo: "ia",
        id_usuario: null,
      },
    ];

    if (isGroup) {
      options.push({
        id: "todos",
        label: "@todos",
        insertText: "@todos",
        description: "Mencionar todos os participantes",
        tipo: "todos",
        id_usuario: null,
      });
    }

    participants
      .filter((participant) => participant.id_usuario !== currentUserId)
      .forEach((participant) => {
        options.push({
          id: participant.id_usuario,
          label: `@${participant.nome}`,
          insertText: `@${participant.nome}`,
          description: "Participante do chat",
          tipo: "usuario",
          id_usuario: participant.id_usuario,
        });
      });

    return options.filter((option) =>
      option.label.toLocaleLowerCase("pt-BR").includes(`@${query}`),
    );
  }, [mentionQuery, participants, isGroup, currentUserId]);

  function updateMentionQuery(value: string, cursorPosition: number) {
    if (editingFileIndex !== null) {
      setMentionQuery(null);
      return;
    }

    const textBeforeCursor = value.slice(0, cursorPosition);
    const match = textBeforeCursor.match(/(^|\s)@([^\s@]*)$/);

    if (!match) {
      setMentionQuery(null);
      return;
    }

    const start = cursorPosition - match[0].length + match[1].length;

    setMentionQuery({
      start,
      end: cursorPosition,
      query: match[2],
    });

    setActiveMentionIndex(0);
  }

  function selectMention(option: MentionOption) {
    if (!mentionQuery) return;

    const start = mentionQuery.start;
    const end = mentionQuery.end;

    const updatedMessage =
      message.slice(0, start) + option.insertText + " " + message.slice(end);

    const newCursorPosition = start + option.insertText.length + 1;

    const newMention: ChatMentionDraft = {
      id_usuario: option.id_usuario,
      tipo: option.tipo,
      texto: option.insertText,
      inicio: start,
      fim: start + option.insertText.length,
    };

    setMentions((current) => {
      const difference = option.insertText.length + 1 - (end - start);

      const preservedMentions = current
        .filter((mention) => mention.fim <= start || mention.inicio >= end)
        .map((mention) => {
          if (mention.inicio >= end) {
            return {
              ...mention,
              inicio: mention.inicio + difference,
              fim: mention.fim + difference,
            };
          }

          return mention;
        });

      return [...preservedMentions, newMention].sort(
        (a, b) => a.inicio - b.inicio,
      );
    });

    setMessage(updatedMessage);
    setMentionQuery(null);
    setActiveMentionIndex(0);

    requestAnimationFrame(() => {
      const textarea = textareaRef.current;

      if (!textarea) return;

      textarea.focus();
      textarea.setSelectionRange(newCursorPosition, newCursorPosition);
    });
  }

  useEffect(() => {
    if (!notification) return;

    const timeout = window.setTimeout(() => {
      setNotification("");
    }, 3000);

    return () => window.clearTimeout(timeout);
  }, [notification]);

  useEffect(() => {
    if (previewIndex === null || !selectedFiles[previewIndex]) {
      setPreviewUrl(null);
      return;
    }

    const url = URL.createObjectURL(selectedFiles[previewIndex].file);
    setPreviewUrl(url);

    return () => URL.revokeObjectURL(url);
  }, [previewIndex, selectedFiles]);

  function showError(text: string) {
    setNotification(text);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const incomingFiles = Array.from(event.target.files ?? []);

    if (incomingFiles.length === 0) return;

    const availableSlots = MAX_FILES - selectedFiles.length;

    if (availableSlots <= 0) {
      showError("Você pode selecionar no máximo 3 arquivos por vez.");
      event.target.value = "";
      return;
    }

    const validFiles: ChatFileDraft[] = [];

    for (const file of incomingFiles) {
      if (file.size > MAX_FILE_SIZE) {
        showError(`"${file.name}" ultrapassa o limite de 50 MB.`);
        continue;
      }

      if (selectedFiles.length + validFiles.length >= MAX_FILES) {
        showError("O limite é de 3 arquivos por vez.");
        break;
      }

      validFiles.push({
        file,
        content: "",
      });
    }

    setSelectedFiles((current) => [...current, ...validFiles]);
    event.target.value = "";
  }

  function updateFileContent(index: number, content: string) {
    setSelectedFiles((current) =>
      current.map((item, fileIndex) =>
        fileIndex === index ? { ...item, content } : item,
      ),
    );
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) =>
      current.filter((_, fileIndex) => fileIndex !== index),
    );

    setEditingFileIndex((current) => {
      if (current === index) return null;
      if (current !== null && current > index) return current - 1;
      return current;
    });

    setPreviewIndex((current) => {
      if (current === null) return null;
      if (current === index) return null;
      if (current > index) return current - 1;
      return current;
    });
  }

  function navigatePreview(direction: number) {
    if (previewIndex === null || selectedFiles.length === 0) return;

    const nextIndex =
      (previewIndex + direction + selectedFiles.length) % selectedFiles.length;

    setPreviewIndex(nextIndex);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if ((!message.trim() && selectedFiles.length === 0) || isSending) {
      return;
    }

    const content = message;
    const files = selectedFiles.map((item) => ({ ...item }));

    setMessage("");
    setMentions([]);
    setMentionQuery(null);
    setActiveMentionIndex(0);
    setSelectedFiles([]);
    setEditingFileIndex(null);
    setPreviewIndex(null);

    try {
      await onSend(content, files, mentions);
    } catch (error) {
      setMessage(content);
      setMentions(mentions);
      setSelectedFiles(files);

      showError(
        error instanceof Error
          ? error.message
          : "Não foi possível enviar as mensagens.",
      );
    }
  }

  function getFileIcon(file: File) {
    if (file.type.startsWith("image/")) {
      return FileImage;
    }

    if (file.type === "application/pdf" || file.type.startsWith("text/")) {
      return FileText;
    }

    return File;
  }

  const currentPreview =
    previewIndex !== null ? selectedFiles[previewIndex] : null;

  const editingFile =
    editingFileIndex !== null ? selectedFiles[editingFileIndex] : null;

  function toggleFileEditing(index: number) {
    setEditingFileIndex((current) => (current === index ? null : index));
  }

  function finishFileEditing() {
    setEditingFileIndex(null);
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="relative border-t border-border bg-surface p-4"
      >
        <div className="mx-auto max-w-4xl">
          {selectedFiles.length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  Arquivos selecionados
                </p>

                <p className="text-xs text-muted-foreground">
                  {selectedFiles.length}/{MAX_FILES}
                </p>
              </div>

              {selectedFiles.map((item, index) => {
                const FileIcon = getFileIcon(item.file);

                return (
                  <div
                    key={`${item.file.name}-${index}`}
                    className={`rounded-xl border p-3 transition-colors ${
                      item.content.trim()
                        ? "border-violet-300 bg-violet-50/70 dark:border-violet-500/40 dark:bg-violet-500/10"
                        : "border-border bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <FileIcon
                        className="size-5 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.file.name}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {(item.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setPreviewIndex(index);
                          setEditingFileIndex(null);
                        }}
                        disabled={isSending}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-green-600 transition hover:bg-green-600 hover:text-white active:bg-green-700 disabled:opacity-50"
                        aria-label={`Visualizar ${item.file.name}`}
                        title="Visualizar arquivo"
                      >
                        <Eye className="size-[18px]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleFileEditing(index)}
                        disabled={isSending}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-violet-600 transition hover:bg-violet-600 hover:text-white active:bg-violet-700 disabled:opacity-50"
                        aria-label={`Escrever mensagem sobre ${item.file.name}`}
                        title={
                          editingFileIndex === index
                            ? "Finalizar edição"
                            : "Adicionar mensagem ao arquivo"
                        }
                      >
                        <MessageSquareText className="size-[18px]" />
                      </button>

                      <button
                        type="button"
                        onClick={() => removeSelectedFile(index)}
                        disabled={isSending}
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-600 hover:text-white active:bg-red-700 disabled:opacity-50"
                        aria-label={`Remover ${item.file.name}`}
                        title="Remover arquivo"
                      >
                        <X className="size-[18px]" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Paperclip className="size-3.5" />
            Até 3 arquivos por vez · Máximo de 50 MB por arquivo
          </div>

          <div className="flex items-center gap-3 pl-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending || selectedFiles.length >= MAX_FILES}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-green-600 transition hover:bg-green-600 hover:text-white active:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Anexar arquivos"
              title="Anexar até 3 arquivos de no máximo 50 MB cada"
            >
              <Paperclip className="size-[18px]" />
            </button>

            <div className="relative min-w-0 flex-1">
              {mentionOptions.length > 0 && mentionQuery && (
                <div className="absolute bottom-full left-0 z-30 mb-2 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-xl">
                  {mentionOptions.map((option, index) => (
                    <button
                      key={option.id}
                      type="button"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectMention(option)}
                      className={`flex w-full flex-col rounded-lg px-3 py-2 text-left transition ${
                        index === activeMentionIndex
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-accent"
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {option.label}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={textareaRef}
                value={editingFile ? editingFile.content : message}
                onChange={(event) => {
                  const value = event.target.value;

                  if (editingFileIndex !== null) {
                    updateFileContent(editingFileIndex, value);
                  } else {
                    const cursorPosition = event.target.selectionStart;

                    setMentions((current) =>
                      adjustMentionsAfterEdit(current, message, value),
                    );

                    setMessage(value);
                    updateMentionQuery(value, cursorPosition);
                  }
                }}
                onClick={(event) => {
                  updateMentionQuery(
                    event.currentTarget.value,
                    event.currentTarget.selectionStart,
                  );
                }}
                onKeyDown={(event) => {
                  if (mentionOptions.length > 0 && mentionQuery) {
                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveMentionIndex(
                        (current) => (current + 1) % mentionOptions.length,
                      );
                      return;
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveMentionIndex(
                        (current) =>
                          (current - 1 + mentionOptions.length) %
                          mentionOptions.length,
                      );
                      return;
                    }

                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      selectMention(
                        mentionOptions[activeMentionIndex] ?? mentionOptions[0],
                      );
                      return;
                    }

                    if (event.key === "Escape") {
                      event.preventDefault();
                      setMentionQuery(null);
                      return;
                    }
                  }

                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();

                    if (editingFileIndex !== null) {
                      finishFileEditing();
                      return;
                    }

                    event.currentTarget.form?.requestSubmit();
                  }
                }}
                placeholder={
                  editingFile
                    ? `Escreva uma mensagem para ${editingFile.file.name}...`
                    : "Digite uma mensagem..."
                }
                rows={1}
                disabled={isSending}
                className={`max-h-40 min-h-11 w-full resize-none overflow-y-auto rounded-2xl border px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40 ${
                  editingFile
                    ? "border-violet-300 bg-violet-50/70 focus:border-violet-400 dark:border-violet-500/40 dark:bg-violet-500/10"
                    : "border-border bg-background focus:border-primary"
                }`}
              />
            </div>

            {editingFileIndex !== null ? (
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  finishFileEditing();
                }}
                disabled={isSending}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-700 disabled:opacity-50"
                aria-label="Finalizar edição da mensagem do arquivo"
                title="Concluir edição"
              >
                <Check className="size-[18px]" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={
                  isSending || (!message.trim() && selectedFiles.length === 0)
                }
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-700 active:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Enviar mensagens"
              >
                <Send className="size-[18px]" />
              </button>
            )}
          </div>
        </div>
      </form>

      {notification && (
        <div
          role="alert"
          className="fixed left-1/2 top-5 z-[100] flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-xl"
        >
          <AlertCircle className="size-5 shrink-0" />
          <span>{notification}</span>
          <button
            type="button"
            onClick={() => setNotification("")}
            className="ml-auto rounded-md p-1 text-white/80 transition hover:bg-white/15 hover:text-white"
            aria-label="Fechar aviso"
          >
            <X className="size-4" />
          </button>
        </div>
      )}

      {currentPreview && previewUrl && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPreviewIndex(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Pré-visualização de ${currentPreview.file.name}`}
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {currentPreview.file.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {previewIndex! + 1} de {selectedFiles.length} arquivos
                </p>
              </div>

              <a
                href={previewUrl}
                download={currentPreview.file.name}
                className="rounded-lg px-3 py-2 text-xs font-semibold !text-green-600 transition hover:bg-green-600 hover:!text-white active:bg-green-700"
              >
                Baixar
              </a>

              <button
                type="button"
                onClick={() => setPreviewIndex(null)}
                className="flex size-9 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-600 hover:text-white active:bg-red-700"
                aria-label="Fechar pré-visualização"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="relative flex min-h-[300px] flex-1 items-center justify-center overflow-auto bg-background p-4">
              {previewIndex! > 0 && (
                <button
                  type="button"
                  onClick={() => navigatePreview(-1)}
                  className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-lg transition hover:bg-accent"
                  aria-label="Arquivo anterior"
                >
                  <ChevronLeft className="size-5" />
                </button>
              )}

              {currentPreview.file.type.startsWith("image/") ? (
                <img
                  src={previewUrl}
                  alt={currentPreview.file.name}
                  className="max-h-[70vh] max-w-full object-contain"
                />
              ) : currentPreview.file.type === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  title={`Pré-visualização de ${currentPreview.file.name}`}
                  className="h-[70vh] w-full rounded-lg bg-white"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <FileText className="size-16 text-muted-foreground" />
                  <p className="font-medium text-foreground">
                    Pré-visualização indisponível para este formato.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Você pode baixar o arquivo para conferir seu conteúdo.
                  </p>
                  <a
                    href={previewUrl}
                    download={currentPreview.file.name}
                    className="rounded-lg px-4 py-2 text-sm font-semibold text-green-600 transition hover:bg-green-600 hover:text-white active:bg-green-700"
                  >
                    Baixar arquivo
                  </a>
                </div>
              )}

              {previewIndex! < selectedFiles.length - 1 && (
                <button
                  type="button"
                  onClick={() => navigatePreview(1)}
                  className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-border bg-surface/90 text-foreground shadow-lg transition hover:bg-accent"
                  aria-label="Próximo arquivo"
                >
                  <ChevronRight className="size-5" />
                </button>
              )}
            </div>
            <div className="border-t border-border bg-surface p-4">
              <textarea
                value={currentPreview.content}
                onChange={(event) =>
                  updateFileContent(previewIndex!, event.target.value)
                }
                placeholder="Escreva uma mensagem para este arquivo (opcional)..."
                rows={2}
                disabled={isSending}
                className={`w-full resize-y rounded-xl border px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/40 ${
                  currentPreview.content.trim()
                    ? "border-violet-300 bg-violet-50/70 focus:border-violet-400 dark:border-violet-500/40 dark:bg-violet-500/10"
                    : "border-border bg-background focus:border-primary"
                }`}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
