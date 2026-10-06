"use client";

import { FormEvent, useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";

const MAX_FILE_SIZE = 10 * 1024 * 1024;

type ChatInputProps = {
  onSend: (message: string, file?: File) => Promise<void>;
  isSending: boolean;
};

export function ChatInput({ onSend, isSending }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if ((!message.trim() && !selectedFile) || isSending) {
      return;
    }

    const content = message;
    const file = selectedFile;

    setMessage("");
    setSelectedFile(null);

    try {
      await onSend(content, file ?? undefined);
    } catch {
      setMessage(content);
      setSelectedFile(file);
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert("O arquivo deve ter no máximo 10 MB.");
      event.target.value = "";
      return;
    }

    setSelectedFile(file);
    event.target.value = "";
  }

  function removeSelectedFile() {
    setSelectedFile(null);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-border bg-surface p-4"
    >
      <div className="mx-auto max-w-4xl">
        {selectedFile && (
          <div className="mb-3 flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
            <Paperclip
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {selectedFile.name}
              </p>

              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>

            <button
              type="button"
              onClick={removeSelectedFile}
              disabled={isSending}
              className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-surface hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
              aria-label="Remover arquivo"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="flex items-end gap-3 pl-2">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileChange}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isSending}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Anexar arquivo"
          >
            <Paperclip className="size-[18px]" aria-hidden="true" />
          </button>

          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                event.currentTarget.form?.requestSubmit();
              }
            }}
            placeholder="Digite uma mensagem..."
            rows={1}
            disabled={isSending}
            className="max-h-40 min-h-11 flex-1 resize-none overflow-y-auto rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring/40"
          />

          <button
            type="submit"
            disabled={isSending || (!message.trim() && !selectedFile)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Enviar mensagem"
          >
            <Send className="size-[18px]" aria-hidden="true" />
          </button>
        </div>
      </div>
    </form>
  );
}
