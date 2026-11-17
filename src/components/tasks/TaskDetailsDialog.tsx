'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { CalendarClock, Loader2, PencilLine, X } from 'lucide-react';
import TaskFilesPanel from '@/components/tasks/TaskFilesPanel';
import { buscarTarefa, listarStatus } from '@/lib/tasks';
import { getProject, getProjectMember } from '@/lib/projects';
import { canEditTask } from '@/lib/task-permissions';
import { getTaskResponsibleName } from '@/lib/task-responsibles';
import { supabase } from '@/lib/supabase';
import type { Project, Tarefa } from '@/types';

type Props = {
  open: boolean; task: Tarefa | null; project?: Project | null;
  projectName?: string; statusName?: string; responsibleName?: string;
  onClose: () => void; onEdit?: () => void;
};
type Details = { task: Tarefa; project: Project; statusName: string; editable: boolean };

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sem prazo definido';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Prazo inválido';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

export default function TaskDetailsDialog({ open, task: selectedTask, onClose, onEdit }: Props) {
  const id = useId();
  const taskId = selectedTask?.id_tarefa ?? '';
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const callbacks = useRef({ onClose, onEdit });
  callbacks.current = { onClose, onEdit };
  const fileBusyRef = useRef(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!open || !taskId) return;
    let active = true;
    setDetails(null); setLoading(true); setError('');
    void (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) throw new Error('Sua sessão expirou. Entre novamente.');
        const task = await buscarTarefa(taskId);
        if (!task) throw new Error('Esta tarefa não está disponível ou está oculta porque o projeto está inativo.');
        const [project, member, statuses] = await Promise.all([
          getProject(task.id_projeto), getProjectMember(task.id_projeto, data.user.id), listarStatus(task.id_projeto),
        ]);
        if (!project || !member || project.archivedAt || project.deletedAt) throw new Error('As tarefas deste projeto estão indisponíveis até que ele seja restaurado.');
        if (active) setDetails({ task, project, statusName: statuses.find((s) => s.id_status === task.id_status)?.nome ?? 'Sem status', editable: canEditTask(task, data.user.id, member.role) });
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os detalhes.');
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [open, taskId, reload]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      // Um visualizador/confirmador aninhado controla seu próprio Escape e Tab.
      const nested = event.target instanceof Element ? event.target.closest('[role="dialog"]') : null;
      if (nested && nested !== dialogRef.current) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!fileBusyRef.current) callbacks.current.onClose();
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]'));
      const first = controls[0]; const last = controls[controls.length - 1];
      if (!first || !last) { event.preventDefault(); dialogRef.current.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [open]);

  function close() { if (!fileBusyRef.current) callbacks.current.onClose(); }
  function changeBusy(value: boolean) { fileBusyRef.current = value; setFileBusy(value); }
  if (!open || !taskId) return null;
  const current = details?.task.id_tarefa === taskId ? details : null;
  const editable = Boolean(current?.editable && onEdit);

  return <div className="fixed inset-0 z-[85] flex items-start justify-center overflow-y-auto bg-black/70 p-3 backdrop-blur-sm sm:items-center sm:p-4" role="presentation">
    <button type="button" aria-label="Fechar detalhes da tarefa" tabIndex={-1} disabled={fileBusy} className="absolute inset-0 cursor-default" onClick={close} />
    <section ref={dialogRef} tabIndex={-1} className="relative z-10 my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-xl overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50 outline-none" role="dialog" aria-modal="true" aria-labelledby={`${id}-title`} aria-busy={loading || fileBusy}>
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-primary">Detalhes da tarefa</p><h2 id={`${id}-title`} className="mt-1 break-words text-xl font-semibold text-foreground">{current?.task.nome ?? 'Visualizar tarefa'}</h2></div>
        <button ref={closeRef} type="button" onClick={close} disabled={fileBusy} className="grid size-11 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Fechar"><X className="size-5" /></button>
      </header>
      <div className="space-y-5 px-5 py-5 sm:px-6 sm:py-6">
        {loading && <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Carregando detalhes e verificando acesso...</p>}
        {error && <div role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">{error}<button type="button" onClick={() => setReload((value) => value + 1)} className="mt-2 block underline">Tentar novamente</button></div>}
        {current && <>
          <dl className="grid gap-4 rounded-xl border border-border bg-background p-4 sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Projeto</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{current.project.name}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Status</dt><dd className="mt-1 text-sm font-medium text-foreground">{current.statusName}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Prioridade</dt><dd className="mt-1 text-sm font-medium text-foreground">{current.task.prioridade === 'Media' ? 'Média' : current.task.prioridade || 'Sem prioridade'}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Responsável</dt><dd className="mt-1 break-words text-sm font-medium text-foreground">{getTaskResponsibleName(current.task)}</dd></div>
            <div className="sm:col-span-2"><dt className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3.5" />Prazo</dt><dd className="mt-1 text-sm font-medium text-foreground">{formatDate(current.task.prazo)}</dd></div>
          </dl>
          <div><h3 className="text-sm font-semibold text-foreground">Descrição</h3><p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-4 text-sm leading-6 text-muted-foreground">{current.task.descricao?.trim() || 'Esta tarefa não possui descrição.'}</p></div>
          <TaskFilesPanel taskId={taskId} projectId={current.task.id_projeto} disabled={!editable} onBusyChange={changeBusy} />
        </>}
      </div>
      <footer className="flex flex-col-reverse gap-2 border-t border-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
        <button type="button" onClick={close} disabled={fileBusy} className="h-11 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50">Fechar</button>
        {editable && <button type="button" disabled={fileBusy} onClick={() => { if (!fileBusyRef.current) callbacks.current.onEdit?.(); }} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"><PencilLine className="size-4" />Editar tarefa</button>}
      </footer>
    </section>
  </div>;
}
