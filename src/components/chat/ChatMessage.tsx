"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Check, Ellipsis, Pencil, Trash2, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import type { ChatMessage as ChatMessageType, ChatFile } from "@/types/chat";
import ProjectConfirmationDialog from "@/components/projects/ProjectConfirmationDialog";
import { emitSuccess } from "@/lib/feedback";

type ChatMessageProps = {
  message: ChatMessageType;
  isOwn: boolean;
  senderName: string;
  onOpenFile: (file: ChatFile) => void;
  onEdit?: (messageId: string, content: string) => Promise<void>;
  onDelete?: (messageId: string) => Promise<void>;
  onDeleteForMe?: (messageId: string) => Promise<void>;
};

function renderMessageContent(
  content: string,
  mentions: ChatMessageType["menções"],
  isOwn: boolean,
) {
  const validMentions = (mentions ?? [])
    .filter(
      (mention) =>
        mention.inicio !== null &&
        mention.fim !== null &&
        mention.inicio >= 0 &&
        mention.fim > mention.inicio &&
        mention.fim <= content.length &&
        content.slice(mention.inicio, mention.fim) === mention.texto,
    )
    .sort((a, b) => a.inicio! - b.inicio!);

  const parts = [];
  let currentPosition = 0;

  validMentions.forEach((mention, index) => {
    if (mention.inicio! < currentPosition) return;

    if (mention.inicio! > currentPosition) {
      parts.push(
        <span key={`text-${index}`}>
          {content.slice(currentPosition, mention.inicio!)}
        </span>,
      );
    }

    parts.push(
      <span
        key={`mention-${mention.id_mencao}`}
        className={`rounded px-1 font-semibold ${
          isOwn
            ? "bg-green-400/20 text-green-200"
            : "bg-violet-100 text-violet-800 dark:bg-violet-500/20 dark:text-violet-300"
        }`}
      >
        {content.slice(mention.inicio!, mention.fim!)}
      </span>,
    );

    currentPosition = mention.fim!;
  });

  if (currentPosition < content.length) {
    parts.push(<span key="text-final">{content.slice(currentPosition)}</span>);
  }

  return <>{parts}</>;
}

export function ChatMessage({
  message,
  isOwn,
  senderName,
  onOpenFile,
  onEdit,
  onDelete,
  onDeleteForMe,
}: ChatMessageProps) {
  const [fileUrls, setFileUrls] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.conteudo ?? "");
  const [menuOpen, setMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'all' | 'me'>('all');
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

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

  useEffect(() => {
    if (!menuOpen) return;

    function positionMenu() {
      const button = menuButtonRef.current;
      const menu = menuRef.current;
      if (!button || !menu) return;
      const buttonRect = button.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const gap = 8;
      const viewportTop = window.visualViewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (window.visualViewport?.height ?? window.innerHeight);
      const canOpenAbove = buttonRect.top - viewportTop >= menuRect.height + gap;
      const top = canOpenAbove
        ? buttonRect.top - menuRect.height - gap
        : Math.min(buttonRect.bottom + gap, viewportBottom - menuRect.height - gap);
      const left = Math.max(gap, Math.min(buttonRect.right - menuRect.width, window.innerWidth - menuRect.width - gap));
      setMenuPosition({ top: Math.max(viewportTop + gap, top), left });
    }

    const closeOnOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target;
      if (target instanceof Node && !menuRef.current?.contains(target) && !menuButtonRef.current?.contains(target)) {
        setMenuOpen(false);
      }
    };

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenuOpen(false); menuButtonRef.current?.focus(); }
    };
    positionMenu();
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('mousedown', closeOnOutside);
    document.addEventListener('touchstart', closeOnOutside);
    window.visualViewport?.addEventListener('resize', positionMenu);
    window.visualViewport?.addEventListener('scroll', positionMenu);
    window.addEventListener('resize', positionMenu);
    window.addEventListener('scroll', positionMenu, true);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('mousedown', closeOnOutside);
      document.removeEventListener('touchstart', closeOnOutside);
      window.visualViewport?.removeEventListener('resize', positionMenu);
      window.visualViewport?.removeEventListener('scroll', positionMenu);
      window.removeEventListener('resize', positionMenu);
      window.removeEventListener('scroll', positionMenu, true);
    };
  }, [menuOpen]);

  async function saveEdit() {
    if (!onEdit || !draft.trim()) return;
    try {
      setSaving(true);
      await onEdit(message.id_mensagem, draft);
      emitSuccess("Mensagem editada com sucesso.");
      setEditing(false);
      setMenuOpen(false);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const action = deleteMode === 'me' ? onDeleteForMe : onDelete;
    if (!action) return;
    setSaving(true);
    try {
      await action(message.id_mensagem);
      emitSuccess(deleteMode === 'me' ? "Mensagem removida para você." : "Mensagem excluída para todos.");
      setDeleteDialogOpen(false);
      setMenuOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`flex ${isOwn ? "justify-end" : "justify-start"}`}>
      <div
        className={`relative max-w-[75%] rounded-2xl px-4 py-2 pr-10 shadow-sm ${
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

        {editing ? (
          <div className="space-y-2">
            <textarea value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} autoFocus className="w-full min-w-48 rounded-lg border border-primary/40 bg-background/30 px-2 py-1.5 text-sm text-foreground outline-none" />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => { setEditing(false); setDraft(message.conteudo ?? ""); }} className="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs"><X className="size-3.5" />Cancelar</button>
              <button type="button" onClick={() => void saveEdit()} disabled={saving || !draft.trim()} className="inline-flex h-8 items-center gap-1 rounded-lg bg-primary px-2 text-xs text-primary-foreground disabled:opacity-50"><Check className="size-3.5" />Salvar</button>
            </div>
          </div>
        ) : message.conteudo && (
          <p className="whitespace-pre-wrap break-words text-sm">
            {renderMessageContent(message.conteudo, message.menções, isOwn)}
          </p>
        )}

        {message.arquivos && message.arquivos.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.arquivos.map((file) => {
              const fileUrl = fileUrls[file.id_arquivo];

              const isImage = file.tipo?.startsWith("image/");

              if (isImage && fileUrl) {
                return (
                  <button
                    key={file.id_arquivo}
                    type="button"
                    onClick={() => onOpenFile(file)}
                    className="block overflow-hidden rounded-lg text-left"
                  >
                    <img
                      src={fileUrl}
                      alt={file.nome}
                      className="max-h-80 max-w-full rounded-lg object-contain"
                    />
                  </button>
                );
              }

              return (
                <button
                  key={file.id_arquivo}
                  type="button"
                  onClick={() => onOpenFile(file)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition hover:opacity-80 ${
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
                </button>
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

        {isOwn && (onEdit || onDelete) && !editing && (
          <div className="absolute right-2 top-2 z-10">
            <button ref={menuButtonRef} type="button" onClick={() => { setMenuPosition(null); setMenuOpen((current) => !current); }} aria-label="Ações da mensagem" className="grid size-8 place-items-center rounded-lg text-current/60 transition hover:bg-black/10 hover:text-current"><Ellipsis className="size-4" /></button>
            {menuOpen && typeof document !== 'undefined' && createPortal(<div ref={menuRef} style={menuPosition ? { top: menuPosition.top, left: menuPosition.left } : { top: 0, left: 0, visibility: 'hidden' }} className="fixed z-[120] min-w-36 rounded-xl border border-border bg-surface p-1 text-foreground shadow-xl shadow-black/25">
              {onEdit && <button type="button" onClick={() => { setEditing(true); setMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"><Pencil className="size-3.5" />Editar</button>}
              {onDeleteForMe && <button type="button" onClick={() => { setDeleteMode('me'); setMenuOpen(false); setDeleteDialogOpen(true); }} disabled={saving} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs hover:bg-muted"><Trash2 className="size-3.5" />Apagar para mim</button>}
              {onDelete && new Date(message.data_hora).getTime() >= Date.now() - 60 * 60 * 1000 && <button type="button" onClick={() => { setDeleteMode('all'); setMenuOpen(false); setDeleteDialogOpen(true); }} disabled={saving} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-danger hover:bg-danger/10"><Trash2 className="size-3.5" />Apagar para todos</button>}
            </div>, document.body)}
          </div>
        )}
      </div>
      <ProjectConfirmationDialog
        open={deleteDialogOpen}
        title={deleteMode === 'me' ? 'Apagar mensagem para você?' : 'Apagar mensagem para todos?'}
        description={deleteMode === 'me' ? 'A mensagem será ocultada somente para você.' : 'A mensagem será removida da conversa para todos. Essa opção só fica disponível até 1 hora após o envio.'}
        icon={<Trash2 className="size-5" aria-hidden="true" />}
        variant="danger"
        confirmLabel={deleteMode === 'me' ? 'Apagar para mim' : 'Apagar para todos'}
        pendingLabel="Apagando..."
        pending={saving}
        onClose={() => setDeleteDialogOpen(false)}
        onConfirm={() => void remove()}
      />
    </div>
  );
}
