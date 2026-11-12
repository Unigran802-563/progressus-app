'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardPlus, Loader2, X } from 'lucide-react';

import { criarTarefa, listarOuCriarStatus } from '@/lib/tasks';
import { listProjectParticipants } from '@/lib/projects';
import type { ProjectParticipant, TarefaPrioridade, TarefaStatus } from '@/types';

type CreateTaskDialogProps = {
  open: boolean;
  projectId: string;
  projectName: string;
  userId: string;
  onClose: () => void;
  onCreated?: () => void;
};

export default function CreateTaskDialog({
  open,
  projectId,
  projectName,
  userId,
  onClose,
  onCreated,
}: CreateTaskDialogProps) {
  const [statuses, setStatuses] = useState<TarefaStatus[]>([]);
  const [statusId, setStatusId] = useState('');
  const [participants, setParticipants] = useState<ProjectParticipant[]>([]);
  const [responsibleId, setResponsibleId] = useState(userId);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TarefaPrioridade>('Media');
  const [dueDate, setDueDate] = useState('');
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setPriority('Media');
      setDueDate('');
      setStatuses([]);
      setStatusId('');
      setParticipants([]);
      setResponsibleId(userId);
      setError('');
      return;
    }

    let active = true;
    setLoadingStatuses(true);
    setError('');
    void Promise.all([listarOuCriarStatus(projectId), listProjectParticipants(projectId)])
      .then(([items, projectParticipants]) => {
        if (!active) return;
        setStatuses(items);
        setStatusId(items[0]?.id_status ?? '');
        setParticipants(projectParticipants.filter((participant) => participant.role !== 'viewer'));
        setResponsibleId(projectParticipants.find((participant) => participant.userId === userId && participant.role !== 'viewer')?.userId ?? projectParticipants.find((participant) => participant.role !== 'viewer')?.userId ?? userId);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os status.');
      })
      .finally(() => {
        if (active) setLoadingStatuses(false);
      });

    return () => {
      active = false;
    };
  }, [open, projectId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      setError('Informe o nome da tarefa.');
      return;
    }
    if (!statusId) {
      setError('Este projeto ainda não possui status para receber tarefas.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      await criarTarefa({
        id_projeto: projectId,
        id_status: statusId,
        id_usuario: responsibleId || userId,
        nome: name,
        descricao: description,
        prioridade: priority,
        prazo: dueDate || null,
      });
      onCreated?.();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="presentation">
      <button type="button" aria-label="Fechar janela de nova tarefa" className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <section className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary"><ClipboardPlus className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 id="create-task-title" className="font-display text-lg font-semibold text-foreground">Criar tarefa</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">Vinculada a {projectName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Fechar"><X className="size-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          <div className="space-y-2"><label htmlFor="task-name" className="text-sm font-medium text-foreground">Nome da tarefa <span className="text-danger">*</span></label><input id="task-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} autoFocus disabled={saving} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
          <div className="space-y-2"><label htmlFor="task-description" className="text-sm font-medium text-foreground">Descrição <span className="text-muted-foreground">(opcional)</span></label><textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} disabled={saving} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><label htmlFor="task-status" className="text-sm font-medium text-foreground">Status inicial</label><select id="task-status" required value={statusId} onChange={(event) => setStatusId(event.target.value)} disabled={saving || loadingStatuses || statuses.length === 0} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">{loadingStatuses ? 'Carregando...' : 'Selecione'}</option>{statuses.map((status) => <option key={status.id_status} value={status.id_status}>{status.nome}</option>)}</select></div>
            <div className="space-y-2"><label htmlFor="task-priority" className="text-sm font-medium text-foreground">Prioridade</label><select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as TarefaPrioridade)} disabled={saving} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="Baixa">Baixa</option><option value="Media">Média</option><option value="Alta">Alta</option></select></div>
          </div>
          <div className="space-y-2"><label htmlFor="task-responsible" className="text-sm font-medium text-foreground">Responsável</label><select id="task-responsible" value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)} disabled={saving || participants.length === 0} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Selecione</option>{participants.map((participant) => <option key={participant.userId} value={participant.userId}>{participant.name}{participant.userId === userId ? ' (você)' : ''}</option>)}</select></div>
          <div className="space-y-2"><label htmlFor="task-due-date" className="text-sm font-medium text-foreground">Prazo <span className="text-muted-foreground">(opcional)</span></label><input id="task-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={saving} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></div>
          {error && <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Cancelar</button><button type="submit" disabled={saving || loadingStatuses || !statusId} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving && <Loader2 className="size-4 animate-spin" />}{saving ? 'Criando...' : 'Criar tarefa'}</button></div>
        </form>
      </section>
    </div>
  );
}
