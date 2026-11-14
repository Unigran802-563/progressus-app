'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ClipboardPlus, Loader2, TriangleAlert, X } from 'lucide-react';
import { useProjectParticipantsRefresh } from '@/hooks/useProjectParticipantsRefresh';
import ProjectConfirmationDialog from '@/components/projects/ProjectConfirmationDialog';

import { criarTarefa, listarOuCriarStatus } from '@/lib/tasks';
import { listProjectParticipants } from '@/lib/projects';
import type { AccessibleProject, ProjectParticipant, Tarefa, TarefaPrioridade, TarefaStatus } from '@/types';

function toLocalDateTimeInput(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateTimeToIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

type CreateTaskDialogProps = {
  open: boolean;
  // Quando informado, preserva o vínculo do botão Criar tarefa de um projeto.
  projectId?: string;
  projectName?: string;
  // No fluxo global, o usuário escolhe um dos projetos permitidos.
  projects?: AccessibleProject[];
  initialDueDate?: string;
  userId: string;
  onClose: () => void;
  onCreated?: (task: Tarefa) => void;
  onRequestCreateProject?: () => void;
};

export default function CreateTaskDialog({
  open,
  projectId,
  projectName,
  projects = [],
  initialDueDate = '',
  userId,
  onClose,
  onCreated,
  onRequestCreateProject,
}: CreateTaskDialogProps) {
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [statuses, setStatuses] = useState<TarefaStatus[]>([]);
  const [statusId, setStatusId] = useState('');
  const [participants, setParticipants] = useState<ProjectParticipant[]>([]);
  const [responsibleId, setResponsibleId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TarefaPrioridade>('Media');
  const [dueDate, setDueDate] = useState('');
  const [loadingStatuses, setLoadingStatuses] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [noProjectNoticeOpen, setNoProjectNoticeOpen] = useState(false);

  const editableProjects = projects.filter((project) => project.myRole !== 'viewer' && !project.archivedAt);
  const activeProjectId = projectId || selectedProjectId;
  const activeProjectName = projectName || editableProjects.find((project) => project.id === activeProjectId)?.name;
  const projectAllowed = Boolean(projectId || editableProjects.some((project) => project.id === selectedProjectId));
  const projectDataReady = Boolean(activeProjectId && loadedProjectId === activeProjectId && !loadingStatuses);

  useEffect(() => {
    if (!open) {
      setSelectedProjectId('');
      setName('');
      setDescription('');
      setPriority('Media');
      setDueDate(initialDueDate);
      setError('');
    }
  }, [initialDueDate, open]);

  useEffect(() => {
    if (open && !projectId && projects.length === 0) setNoProjectNoticeOpen(true);
    if (!open) setNoProjectNoticeOpen(false);
  }, [open, projectId, projects.length]);

  useEffect(() => {
    let active = true;
    setStatuses([]);
    setStatusId('');
    setParticipants([]);
    setResponsibleId('');
    setLoadedProjectId('');
    setError('');
    setLoadingStatuses(false);

    if (!open || !activeProjectId || !projectAllowed) return;

    setLoadingStatuses(true);
    void Promise.all([listarOuCriarStatus(activeProjectId), listProjectParticipants(activeProjectId)])
      .then(([items, projectParticipants]) => {
        if (!active) return;
        const eligible = projectParticipants.filter((participant) => participant.role !== 'viewer');
        setStatuses(items);
        setStatusId(items[0]?.id_status ?? '');
        setParticipants(eligible);
        setResponsibleId(eligible.find((participant) => participant.userId === userId)?.userId ?? eligible[0]?.userId ?? '');
        setLoadedProjectId(activeProjectId);
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : 'Não foi possível carregar os status e responsáveis.');
      })
      .finally(() => {
        if (active) setLoadingStatuses(false);
      });

    // Uma resposta de um projeto anterior não pode sobrescrever a seleção atual.
    return () => { active = false; };
  }, [open, activeProjectId, projectAllowed, userId]);

  function changeProject(value: string) {
    setSelectedProjectId(value);
    setStatuses([]);
    setStatusId('');
    setParticipants([]);
    setResponsibleId('');
    setLoadedProjectId('');
    setError('');
  }

  useProjectParticipantsRefresh(activeProjectId, open, (eligible) => {
    setParticipants(eligible);
    setResponsibleId((current) => eligible.some((member) => member.userId === current) ? current : '');
  }, () => { if (projectId) onClose(); else changeProject(''); });

  const statusValid = statuses.some((status) => status.id_status === statusId);
  const responsibleValid = participants.some((participant) => participant.userId === responsibleId);
  const canSubmit = Boolean(userId && name.trim() && projectAllowed && projectDataReady && statusValid && responsibleValid && !saving);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!activeProjectId || !projectAllowed) {
      setError('Selecione o projeto da tarefa.');
      return;
    }
    if (!name.trim()) {
      setError('Informe o nome da tarefa.');
      return;
    }
    if (!projectDataReady) {
      setError('Aguarde o carregamento dos status e responsáveis do projeto.');
      return;
    }
    if (!statusValid) {
      setError('Selecione o status inicial da tarefa.');
      return;
    }
    if (!responsibleValid) {
      setError('Selecione o responsável pela tarefa.');
      return;
    }
    if (!userId) {
      setError('Usuário não autenticado.');
      return;
    }

    try {
      setSaving(true);
      setError('');
      const createdTask = await criarTarefa({
        id_projeto: activeProjectId,
        id_status: statusId,
        id_usuario: responsibleId,
        nome: name.trim(),
        descricao: description,
        prioridade: priority,
        prazo: dueDate || null,
      });
      onCreated?.(createdTask);
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível criar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Fechar janela de nova tarefa" className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" onClick={saving ? undefined : onClose} />
      <section className="relative z-10 my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-2rem)]" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><ClipboardPlus className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 id="create-task-title" className="font-display text-lg font-semibold text-foreground">Criar tarefa</h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">{activeProjectName ? `Vinculada a ${activeProjectName}` : 'Selecione o projeto para esta tarefa.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} className="grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50" aria-label="Fechar"><X className="size-5" /></button>
        </div>
        <form noValidate onSubmit={handleSubmit} className="space-y-4 px-5 py-5 sm:px-6 sm:py-6">
          {!projectId && (
            <div className="space-y-2">
              <label htmlFor="task-project" className="text-sm font-medium text-foreground">Projeto <span className="text-danger">*</span></label>
              <select id="task-project" aria-required="true" value={selectedProjectId} onChange={(event) => changeProject(event.target.value)} disabled={saving || editableProjects.length === 0} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground disabled:opacity-60">
                <option value="">Selecione o projeto</option>
                {editableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              {editableProjects.length === 0 && <p className="text-sm text-muted-foreground">Crie um projeto para liberar a criação de tarefas.</p>}
            </div>
          )}
          <div className="space-y-2"><label htmlFor="task-name" className="text-sm font-medium text-foreground">Nome da tarefa <span className="text-danger">*</span></label><input id="task-name" aria-required="true" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} autoFocus disabled={saving} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
          <div className="space-y-2"><label htmlFor="task-description" className="text-sm font-medium text-foreground">Descrição <span className="text-muted-foreground">(opcional)</span></label><textarea id="task-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} disabled={saving} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><label htmlFor="task-status" className="text-sm font-medium text-foreground">Status inicial <span className="text-danger">*</span></label><select id="task-status" aria-required="true" value={statusId} onChange={(event) => setStatusId(event.target.value)} disabled={saving || !projectDataReady || statuses.length === 0} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">{loadingStatuses ? 'Carregando...' : !activeProjectId ? 'Selecione o projeto primeiro' : 'Selecione o status'}</option>{statuses.map((status) => <option key={status.id_status} value={status.id_status}>{status.nome}</option>)}</select></div>
            <div className="space-y-2"><label htmlFor="task-priority" className="text-sm font-medium text-foreground">Prioridade</label><select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as TarefaPrioridade)} disabled={saving} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="Baixa">Baixa</option><option value="Media">Média</option><option value="Alta">Alta</option></select></div>
          </div>
          <div className="space-y-2"><label htmlFor="task-responsible" className="text-sm font-medium text-foreground">Responsável <span className="text-danger">*</span></label><select id="task-responsible" aria-required="true" value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)} disabled={saving || !projectDataReady || participants.length === 0} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">{loadingStatuses ? 'Carregando...' : !activeProjectId ? 'Selecione o projeto primeiro' : 'Selecione o responsável'}</option>{participants.map((participant) => <option key={participant.userId} value={participant.userId}>{participant.name}{participant.userId === userId ? ' (você)' : ''}</option>)}</select></div>
          <div className="space-y-2"><label htmlFor="task-due-date" className="text-sm font-medium text-foreground">Prazo e horário <span className="text-muted-foreground">(opcional)</span></label><input id="task-due-date" type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={saving} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></div>
          {error && <p className="rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end"><button type="button" onClick={onClose} disabled={saving} className="h-10 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Cancelar</button><button type="submit" disabled={!canSubmit} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100">{saving && <Loader2 className="size-4 animate-spin" />}{saving ? 'Criando...' : 'Criar tarefa'}</button></div>
        </form>
      </section>
    </div>
    <ProjectConfirmationDialog
      open={noProjectNoticeOpen}
      title="Crie um projeto primeiro"
      description="Para criar uma tarefa, você precisa vinculá-la a um projeto. Crie seu primeiro projeto agora e depois poderá cadastrar a tarefa."
      icon={<TriangleAlert className="size-5" aria-hidden="true" />}
      confirmLabel="Criar projeto"
      pendingLabel="Abrindo..."
      pending={false}
      onClose={() => { setNoProjectNoticeOpen(false); onClose(); }}
      onConfirm={() => { setNoProjectNoticeOpen(false); onClose(); onRequestCreateProject?.(); }}
    />
    </>
  );
}
