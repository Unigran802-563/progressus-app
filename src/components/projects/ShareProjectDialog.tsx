'use client';

import { useEffect, useState } from 'react';
import { Check, Copy, Link2, Loader2, UsersRound, X } from 'lucide-react';

import { createProjectInvite } from '@/lib/projects';
import type { InviteRole, Project } from '@/types';

type ShareProjectDialogProps = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
};

function formatExpiration(date: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

export default function ShareProjectDialog({
  open,
  project,
  onClose,
}: ShareProjectDialogProps) {
  const [role, setRole] = useState<InviteRole>('member');
  const [inviteUrl, setInviteUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setRole('member');
      setInviteUrl('');
      setExpiresAt('');
      setErrorMessage('');
      setIsGenerating(false);
      setIsCopied(false);
    }
  }, [open]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isGenerating) {
        onClose();
      }
    }

    if (open) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => window.removeEventListener('keydown', handleEscape);
  }, [isGenerating, onClose, open]);

  async function handleGenerateInvite() {
    if (!project) return;

    try {
      setIsGenerating(true);
      setErrorMessage('');
      setIsCopied(false);

      const invite = await createProjectInvite(project.id, role);
      setInviteUrl(`${window.location.origin}/invite/${invite.token}`);
      setExpiresAt(invite.expiresAt);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível gerar o link de convite.',
      );
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleCopyInvite() {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 2200);
    } catch {
      setErrorMessage('Não foi possível copiar automaticamente. Selecione e copie o link exibido.');
    }
  }

  if (!open || !project) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar compartilhamento"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={isGenerating ? undefined : onClose}
      />

      <section
        className="relative z-10 w-[calc(100vw-2rem)] max-w-[34rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-project-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <UsersRound className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="share-project-title"
                className="font-display text-lg font-semibold text-foreground"
              >
                Compartilhar projeto
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                Convide pessoas para <strong className="font-medium text-foreground">{project.name}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          {!inviteUrl ? (
            <>
              <div className="rounded-xl border border-primary/20 bg-primary/10 px-3.5 py-3 text-sm leading-6 text-muted-foreground">
                O link poderá ser usado <strong className="font-semibold text-foreground">uma única vez</strong> e expira em 7 dias. Compartilhe-o apenas com a pessoa convidada.
              </div>

              <fieldset className="space-y-2.5">
                <legend className="text-sm font-medium text-foreground">
                  Permissão do convidado
                </legend>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    role === 'member'
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value="member"
                    checked={role === 'member'}
                    onChange={() => setRole('member')}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Participante</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      Poderá acompanhar o projeto e participar das funcionalidades liberadas para membros.
                    </span>
                  </span>
                </label>

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${
                    role === 'viewer'
                      ? 'border-primary/50 bg-primary/10'
                      : 'border-border hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="invite-role"
                    value="viewer"
                    checked={role === 'viewer'}
                    onChange={() => setRole('viewer')}
                    className="mt-1 accent-primary"
                  />
                  <span>
                    <span className="block text-sm font-semibold text-foreground">Visualizador</span>
                    <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                      Terá acesso apenas para consulta, sem permissão de alterar o projeto.
                    </span>
                  </span>
                </label>
              </fieldset>

              {errorMessage && (
                <p
                  className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
                  role="alert"
                >
                  {errorMessage}
                </p>
              )}

              <div className="flex justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => void handleGenerateInvite()}
                  disabled={isGenerating}
                  className="glow-accent inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isGenerating ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Link2 className="size-4" aria-hidden="true" />
                  )}
                  {isGenerating ? 'Gerando...' : 'Gerar link seguro'}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-xl border border-success/25 bg-success/10 px-3.5 py-3 text-sm text-success">
                Link de convite criado com sucesso.
              </div>

              <div className="space-y-2">
                <label htmlFor="invite-url" className="text-sm font-medium text-foreground">
                  Link para compartilhar
                </label>
                <div className="flex gap-2">
                  <input
                    id="invite-url"
                    value={inviteUrl}
                    readOnly
                    onFocus={(event) => event.currentTarget.select()}
                    className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-xs text-foreground outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void handleCopyInvite()}
                    className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted"
                  >
                    {isCopied ? (
                      <Check className="size-4 text-success" aria-hidden="true" />
                    ) : (
                      <Copy className="size-4" aria-hidden="true" />
                    )}
                    {isCopied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
              </div>

              <p className="text-xs leading-5 text-muted-foreground">
                Permissão: <strong className="text-foreground">{role === 'member' ? 'Participante' : 'Visualizador'}</strong>. Válido até {formatExpiration(expiresAt)}.
              </p>

              {errorMessage && (
                <p className="text-xs text-danger" role="alert">
                  {errorMessage}
                </p>
              )}

              <div className="flex justify-end border-t border-border pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 items-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
                >
                  Concluir
                </button>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
