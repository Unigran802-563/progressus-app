'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, PencilLine, X } from 'lucide-react';

import type { Project, UpdateProjectData } from '@/types';

type EditProjectDialogProps = {
  open: boolean;
  project: Project | null;
  onClose: () => void;
  onSave: (data: UpdateProjectData) => Promise<void>;
};

export default function EditProjectDialog({
  open,
  project,
  onClose,
  onSave,
}: EditProjectDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open && project) {
      setName(project.name);
      setDescription(project.description ?? '');
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [open, project]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    }

    if (open) {
      window.addEventListener('keydown', handleEscape);
    }

    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSubmitting, onClose, open]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setErrorMessage('Informe o nome do projeto.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage('');

      await onSave({
        name,
        description,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível salvar as alterações. Tente novamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!open || !project) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="presentation"
    >
      <button
        type="button"
        aria-label="Fechar janela de edição"
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
        onClick={isSubmitting ? undefined : onClose}
      />

      <section
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-project-title"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary">
              <PencilLine className="size-5" aria-hidden="true" />
            </span>
            <div>
              <h2
                id="edit-project-title"
                className="font-display text-lg font-semibold text-foreground"
              >
                Editar projeto
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                Atualize as informações básicas do projeto.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="grid size-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-2">
            <label
              htmlFor="edit-project-name"
              className="text-sm font-medium text-foreground"
            >
              Nome do projeto <span className="text-danger">*</span>
            </label>
            <input
              id="edit-project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              autoFocus
              disabled={isSubmitting}
              className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="edit-project-description"
              className="text-sm font-medium text-foreground"
            >
              Descrição <span className="text-muted-foreground">(opcional)</span>
            </label>
            <textarea
              id="edit-project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={600}
              rows={4}
              disabled={isSubmitting}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          {errorMessage && (
            <p
              className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"
              role="alert"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-10 rounded-xl px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="glow-accent inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <PencilLine className="size-4" aria-hidden="true" />
              )}
              {isSubmitting ? 'Salvando...' : 'Salvar alterações'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
