'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { Loader2, PencilLine, ShieldAlert, Trash2, X } from 'lucide-react';
import { useProjectParticipantsRefresh } from '@/hooks/useProjectParticipantsRefresh';
import { getProject, getProjectMember, listAccessibleProjects, listProjectParticipants } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { canEditTask } from '@/lib/task-permissions';
import { atualizarTarefa, buscarTarefa, excluirTarefa, listarStatus } from '@/lib/tasks';
import type { AtualizarTarefaData, Project, ProjectParticipant, Tarefa, TarefaPrioridade, TarefaStatus } from '@/types';

type EditTaskDialogProps = {
  open: boolean;
  task: Tarefa | null;
  userId: string;
  onClose: () => void;
  onSaved?: (updated: Tarefa) => void;
  onDeleted?: (taskId: string) => void;
};

type TaskContext = {
  task: Tarefa;
  project: Project;
  participants: ProjectParticipant[];
  statuses: TarefaStatus[];
  userId: string;
};

class TaskAccessError extends Error {}

const priorities: TarefaPrioridade[] = ['Baixa', 'Media', 'Alta'];
const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-surface';
const inputClass = 'h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60';

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

function isRealDate(value: string) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) && Number.isFinite(new Date(value).getTime());
}

async function readTaskContext(taskId: string, userId: string): Promise<TaskContext> {
  // A prop identifica a tela, mas não comprova a identidade da sessão atual.
  const { data, error } = await supabase.auth.getUser();
  if (error || !userId || data.user?.id !== userId) {
    throw new TaskAccessError('Sua sessão mudou ou expirou. Entre novamente para editar a tarefa.');
  }
  const currentTask = await buscarTarefa(taskId);
  if (!currentTask) throw new TaskAccessError('Esta tarefa não está mais disponível ou você perdeu o acesso.');

  const [project, member, activeProjects] = await Promise.all([
    getProject(currentTask.id_projeto),
    getProjectMember(currentTask.id_projeto, userId),
    listAccessibleProjects(),
  ]);
  if (!project) throw new TaskAccessError('O projeto não está mais disponível ou você perdeu o acesso.');
  if (project.archivedAt) throw new TaskAccessError('Este projeto está arquivado. Restaure o projeto antes de editar tarefas.');
  // getProject não expõe excluido_em; a listagem padrão exclui arquivos e lixeira.
  if (!activeProjects.some((item) => item.id === project.id && !item.archivedAt)) {
    throw new TaskAccessError('Este projeto não está ativo ou você perdeu o acesso. Projetos na lixeira não permitem editar tarefas.');
  }
  const role = member?.userId === userId && member.projectId === currentTask.id_projeto ? member.role : null;
  if (!canEditTask(currentTask, userId, role)) {
    throw new TaskAccessError('Você não tem permissão para editar esta tarefa. Somente o proprietário ou um participante ativo que criou a tarefa ou é responsável por ela pode editar.');
  }

  // Edição apenas lê os status existentes: nunca inicializa status de um projeto.
  const [participants, statuses] = await Promise.all([
    listProjectParticipants(currentTask.id_projeto),
    listarStatus(currentTask.id_projeto),
  ]);
  return {
    task: currentTask,
    project,
    participants: participants.filter((participant) => participant.role === 'owner' || participant.role === 'member'),
    statuses: statuses.filter((status) => status.id_projeto === currentTask.id_projeto),
    userId,
  };
}

export default function EditTaskDialog({ open, task, userId, onClose, onSaved, onDeleted }: EditTaskDialogProps) {
  const id = useId();
  const taskId = task?.id_tarefa ?? '';
  const [context, setContext] = useState<TaskContext | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [statusId, setStatusId] = useState('');
  const [priority, setPriority] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState('');
  const [accessWarning, setAccessWarning] = useState('');
  const dialogRef = useRef<HTMLElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const generationRef = useRef(0);
  const accessRevisionRef = useRef(0);
  const saveRef = useRef<object | null>(null);
  const refreshRef = useRef<() => void>(() => {});
  const revokeRef = useRef<() => void>(() => {});
  const callbacksRef = useRef({ open, taskId, userId, onClose, onSaved, onDeleted });
  callbacksRef.current = { open, taskId, userId, onClose, onSaved, onDeleted };

  useEffect(() => {
    const generation = ++generationRef.current;
    let active = true;
    let request = 0;
    let initialized = false;
    let loadedProjectId = '';
    saveRef.current = null;
    setContext(null);
    setName('');
    setDescription('');
    setStatusId('');
    setPriority('');
    setDueDate('');
    setResponsibleId('');
    setError('');
    setAccessWarning('');
    setSaving(false);
    setDeleting(false);
    setConfirmDelete(false);
    setChecking(false);
    setLoading(Boolean(open && taskId));

    function revoke() {
      if (!active) return;
      ++request;
      ++accessRevisionRef.current;
      setAccessWarning('Você perdeu a permissão para editar esta tarefa ou o projeto foi arquivado.');
      setLoading(false);
      setChecking(false);
    }

    async function load() {
      if (!active || !open || !taskId || saveRef.current) return;
      const currentRequest = ++request;
      if (initialized) setChecking(true); else setLoading(true);
      setError('');
      try {
        const next = await readTaskContext(taskId, userId);
        if (!active || request !== currentRequest || generationRef.current !== generation) return;
        loadedProjectId = next.project.id;
        if (!initialized) {
          setName(next.task.nome);
          setDescription(next.task.descricao ?? '');
          setStatusId(next.task.id_status ?? '');
          // Não normalizar valores históricos nem atribuir automaticamente outro usuário.
          setPriority(next.task.prioridade ?? '');
          setDueDate(toLocalDateTimeInput(next.task.prazo ?? ''));
          setResponsibleId(next.task.id_usuario ?? '');
          setContext(next);
          initialized = true;
        } else {
          // Atualizar acesso/listas sem apagar o rascunho nem trocar sua referência histórica.
          setContext((previous) => previous ? { ...next, task: previous.task } : next);
        }
        setAccessWarning('');
      } catch (reason) {
        if (!active || request !== currentRequest) return;
        if (reason instanceof TaskAccessError) setAccessWarning(reason.message);
        else setError('Não foi possível carregar ou verificar a tarefa. Tente novamente.');
        // Falha na revalidação também bloqueia edição até uma nova consulta bem-sucedida.
        if (initialized && !(reason instanceof TaskAccessError)) {
          setAccessWarning('Não foi possível confirmar seu acesso. Verifique novamente antes de editar.');
        }
      } finally {
        if (active && request === currentRequest) {
          setLoading(false);
          setChecking(false);
        }
      }
    }

    refreshRef.current = () => { void load(); };
    revokeRef.current = revoke;
    if (open && !taskId) setAccessWarning('Selecione uma tarefa para editar.');
    if (!open || !taskId) return () => { active = false; ++generationRef.current; };
    void load();

    function refreshOnMembersChanged(event: Event) {
      const projectId = (event as CustomEvent<{ projectId?: string }>).detail?.projectId;
      // A consulta usa o projeto da tarefa lida, não o vínculo recebido na prop.
      if (!projectId || !loadedProjectId || projectId === loadedProjectId) void load();
    }
    function refreshOnFocus() { void load(); }
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      // Não executar chamadas assíncronas do cliente dentro do callback de autenticação.
      if (session?.user.id !== userId) revoke();
    });
    window.addEventListener('focus', refreshOnFocus);
    window.addEventListener('progressus:project-members-changed', refreshOnMembersChanged);

    // Cleanup invalida todas as respostas: A atrasada nunca preenche B, nem a mesma tarefa reaberta.
    return () => {
      active = false;
      ++request;
      ++generationRef.current;
      authListener.subscription.unsubscribe();
      window.removeEventListener('focus', refreshOnFocus);
      window.removeEventListener('progressus:project-members-changed', refreshOnMembersChanged);
    };
    // Apenas a identidade da tarefa reinicia o formulário; novos objetos da prop não apagam o rascunho.
  }, [open, taskId, userId]);

  const currentContext = context?.task.id_tarefa === taskId && context.userId === userId ? context : null;
  const editable = Boolean(open && currentContext && !loading && !accessWarning);
  const busy = loading || checking || saving || deleting;

  useProjectParticipantsRefresh(currentContext?.project.id ?? '', open && Boolean(currentContext), () => {
    // O evento é um sinal de refresh, não uma autorização; reconsultar tarefa, sessão e papel.
    refreshRef.current();
  }, () => revokeRef.current());

  function closeDialog() {
    if (!saveRef.current) callbacksRef.current.onClose();
  }

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement;
    const previousButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'))
      .filter((button) => !dialogRef.current?.contains(button));
    const previousIndex = previousButtons.indexOf(previousFocus as HTMLButtonElement);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();

    function focusInside() {
      if (saveRef.current) dialogRef.current?.focus(); else cancelRef.current?.focus();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!saveRef.current) callbacksRef.current.onClose();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, textarea, a[href], [tabindex]',
      )).filter((element) => !element.matches(':disabled') && element.tabIndex >= 0 && !element.hidden);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focused = document.activeElement;
      if (!first || !last) {
        event.preventDefault();
        dialogRef.current.focus();
      } else if (event.shiftKey && (focused === first || focused === dialogRef.current || !dialogRef.current.contains(focused))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (focused === last || focused === dialogRef.current || !dialogRef.current.contains(focused))) {
        event.preventDefault();
        first.focus();
      }
    }
    function handleFocusIn(event: FocusEvent) {
      if (event.target instanceof Node && !dialogRef.current?.contains(event.target)) focusInside();
    }
    document.addEventListener('keydown', handleKeyDown, true);
    document.addEventListener('focusin', handleFocusIn);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
      document.removeEventListener('focusin', handleFocusIn);
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      else if (previousIndex >= 0) {
        const fallback = previousButtons.slice(previousIndex + 1).find((button) => button.isConnected)
          ?? previousButtons.slice(0, previousIndex).reverse().find((button) => button.isConnected);
        fallback?.focus();
      }
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (busy || !editable) dialogRef.current?.focus();
    else nameRef.current?.focus();
  }, [open, taskId, busy, editable]);

  const originalResponsibleId = currentContext?.task.id_usuario ?? '';
  const historicalResponsible = Boolean(originalResponsibleId && currentContext
    && !currentContext.participants.some((participant) => participant.userId === originalResponsibleId));
  const responsibleValid = !responsibleId || responsibleId === originalResponsibleId
    || Boolean(currentContext?.participants.some((participant) => participant.userId === responsibleId));
  const unavailableSelection = Boolean(responsibleId && responsibleId !== originalResponsibleId
    && !currentContext?.participants.some((participant) => participant.userId === responsibleId));
  const statusValid = Boolean(currentContext?.statuses.some((status) => status.id_status === statusId));
  const priorityValid = priorities.includes(priority as TarefaPrioridade)
    || priority === (currentContext?.task.prioridade ?? '');
  const dateValid = isRealDate(dueDate);
  const canSubmit = Boolean(editable && !busy && userId && name.trim() && statusValid && responsibleValid && priorityValid && dateValid);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saveRef.current || busy || !editable || !currentContext) return;
    if (!name.trim()) { setError('Informe o nome da tarefa.'); nameRef.current?.focus(); return; }
    if (!statusValid) { setError('Selecione um status existente do projeto.'); return; }
    if (!dateValid) { setError('Informe um prazo válido, com data e horário.'); return; }
    if (!responsibleValid) { setError('Selecione um participante ativo ou a opção Sem responsável.'); return; }
    if (!priorityValid) { setError('Selecione uma prioridade válida.'); return; }

    const token = {};
    const generation = generationRef.current;
    const accessRevision = accessRevisionRef.current;
    const original = currentContext.task;
    saveRef.current = token; // Trava síncrona contra dois submits antes do próximo render.
    setSaving(true);
    setError('');
    const isCurrent = () => generationRef.current === generation && callbacksRef.current.open
      && callbacksRef.current.taskId === original.id_tarefa && callbacksRef.current.userId === userId;
    try {
      const fresh = await readTaskContext(original.id_tarefa, userId);
      if (!isCurrent()) return;
      if (fresh.task.id_projeto !== original.id_projeto) {
        throw new TaskAccessError('O vínculo desta tarefa mudou. Feche e abra a edição novamente.');
      }
      // Uma revogação recebida enquanto a verificação estava em curso não pode ser ignorada.
      if (accessRevisionRef.current !== accessRevision || !fresh.statuses.some((status) => status.id_status === statusId)) {
        throw new TaskAccessError('O acesso ou o status da tarefa mudou. Verifique novamente antes de salvar.');
      }
      const responsibleChanged = responsibleId !== (original.id_usuario ?? '');
      if (responsibleChanged && responsibleId
        && !fresh.participants.some((participant) => participant.userId === responsibleId)) {
        setContext({ ...fresh, task: original });
        throw new Error('responsible-unavailable');
      }

      // Enviar só campos alterados preserva creator, criação, prioridade legada e responsável histórico.
      // O ID excluído inalterado fica no banco (não é reenviado nem substituído); o trigger valida mudanças.
      const payload: AtualizarTarefaData = {};
      if (name !== original.nome) payload.nome = name.trim();
      if (description !== (original.descricao ?? '')) payload.descricao = description;
      if (statusId !== original.id_status) payload.id_status = statusId;
      if (priority !== (original.prioridade ?? '')) payload.prioridade = priority as TarefaPrioridade;
      if (dueDate !== (original.prazo ?? '')) payload.prazo = localDateTimeToIso(dueDate);
      if (responsibleChanged) payload.id_usuario = responsibleId || null;
      if (Object.keys(payload).length === 0) {
        if (isCurrent()) { callbacksRef.current.onSaved?.(fresh.task); callbacksRef.current.onClose(); }
        return;
      }
      const updated = await atualizarTarefa(original.id_tarefa, payload);
      if (!isCurrent()) return;
      callbacksRef.current.onSaved?.(updated);
      callbacksRef.current.onClose();
    } catch (reason) {
      if (!isCurrent()) return;
      if (reason instanceof TaskAccessError) setAccessWarning(reason.message);
      else setError(reason instanceof Error && reason.message === 'responsible-unavailable'
        ? 'O responsável selecionado não participa mais do projeto. Escolha um participante ativo ou Sem responsável.'
        : 'Não foi possível salvar as alterações. Verifique os dados e tente novamente.');
    } finally {
      if (saveRef.current === token) {
        saveRef.current = null;
        if (isCurrent()) setSaving(false);
      }
    }
  }

  async function handleDelete() {
    if (saveRef.current || busy || !editable || !currentContext) return;
    const token = {};
    const generation = generationRef.current;
    const original = currentContext.task;
    saveRef.current = token;
    setDeleting(true);
    setError('');
    const isCurrent = () => generationRef.current === generation && callbacksRef.current.open
      && callbacksRef.current.taskId === original.id_tarefa && callbacksRef.current.userId === userId;
    try {
      const fresh = await readTaskContext(original.id_tarefa, userId);
      if (!isCurrent()) return;
      if (fresh.task.id_projeto !== original.id_projeto) {
        throw new TaskAccessError('O vínculo desta tarefa mudou. Feche e abra a edição novamente.');
      }
      await excluirTarefa(original.id_tarefa);
      if (!isCurrent()) return;
      callbacksRef.current.onDeleted?.(original.id_tarefa);
      callbacksRef.current.onClose();
    } catch (reason) {
      if (!isCurrent()) return;
      if (reason instanceof TaskAccessError) setAccessWarning(reason.message);
      else setError(reason instanceof Error && reason.message.includes('permiss')
        ? 'Não foi possível excluir: você não tem permissão para excluir esta tarefa.'
        : 'Não foi possível excluir a tarefa. Ela pode já ter sido removida ou estar indisponível.');
      setConfirmDelete(false);
    } finally {
      if (saveRef.current === token) {
        saveRef.current = null;
        if (isCurrent()) setDeleting(false);
      }
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-3 sm:items-center sm:p-4" role="presentation">
      <button type="button" aria-label="Fechar edição da tarefa" aria-hidden="true" tabIndex={-1} disabled={saving} className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm" onClick={closeDialog} />
      <section ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-busy={busy} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description${error ? ` ${id}-error` : ''}${accessWarning ? ` ${id}-warning` : ''}`} className="relative z-10 my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl shadow-black/50 outline-none sm:max-h-[calc(100dvh-2rem)]">
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary"><PencilLine className="size-5" aria-hidden="true" /></span>
            <div className="min-w-0">
              <h2 id={`${id}-title`} className="font-display text-lg font-semibold text-foreground">Editar tarefa</h2>
              <p id={`${id}-description`} className="mt-0.5 break-words text-sm text-muted-foreground">Atualize os dados da tarefa. O projeto permanece o mesmo.</p>
            </div>
          </div>
          <button type="button" onClick={closeDialog} disabled={saving} className={`grid size-9 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`} aria-label="Fechar"><X className="size-5" aria-hidden="true" /></button>
        </div>

        <div className="px-5 py-5 sm:px-6 sm:py-6">
          {loading && <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status"><Loader2 className="size-4 animate-spin" aria-hidden="true" />Carregando tarefa e verificando acesso...</p>}
          {accessWarning && <p id={`${id}-warning`} className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-sm text-warning" role="alert"><ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{accessWarning}</p>}
          {accessWarning && currentContext && (
            <dl className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4 text-sm" aria-label="Últimos dados carregados, somente leitura">
              <div><dt className="text-muted-foreground">Projeto</dt><dd className="mt-1 break-words text-foreground">{currentContext.project.name}</dd></div>
              <div><dt className="text-muted-foreground">Tarefa</dt><dd className="mt-1 break-words text-foreground">{currentContext.task.nome}</dd></div>
              {currentContext.task.descricao && <div><dt className="text-muted-foreground">Descrição</dt><dd className="mt-1 whitespace-pre-wrap break-words text-foreground">{currentContext.task.descricao}</dd></div>}
            </dl>
          )}

          {editable && currentContext && (
            <form id={`${id}-form`} noValidate onSubmit={handleSubmit}>
              <fieldset disabled={busy} className="min-w-0 space-y-4">
                <legend className="sr-only">Dados da tarefa</legend>
                <div className="space-y-2"><label htmlFor={`${id}-project`} className="text-sm font-medium text-foreground">Projeto</label><input id={`${id}-project`} value={currentContext.project.name} readOnly aria-readonly="true" className={`${inputClass} text-muted-foreground`} /></div>
                <div className="space-y-2"><label htmlFor={`${id}-name`} className="text-sm font-medium text-foreground">Nome da tarefa <span className="text-danger">*</span></label><input ref={nameRef} id={`${id}-name`} required aria-required="true" value={name} onChange={(event) => setName(event.target.value)} maxLength={160} className={inputClass} /></div>
                <div className="space-y-2"><label htmlFor={`${id}-task-description`} className="text-sm font-medium text-foreground">Descrição <span className="text-muted-foreground">(opcional)</span></label><textarea id={`${id}-task-description`} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} rows={3} className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60" /></div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-2"><label htmlFor={`${id}-status`} className="text-sm font-medium text-foreground">Status <span className="text-danger">*</span></label><select id={`${id}-status`} required aria-required="true" value={statusId} onChange={(event) => setStatusId(event.target.value)} className={inputClass}><option value="">Selecione o status</option>{statusId && !statusValid && <option value={statusId} disabled>Status atual indisponível</option>}{currentContext.statuses.map((status) => <option key={status.id_status} value={status.id_status}>{status.nome}</option>)}</select>{currentContext.statuses.length === 0 && <p className="text-sm text-muted-foreground">Este projeto não possui status disponíveis. A edição não cria novos status.</p>}</div>
                  <div className="space-y-2"><label htmlFor={`${id}-priority`} className="text-sm font-medium text-foreground">Prioridade</label><select id={`${id}-priority`} value={priority} onChange={(event) => setPriority(event.target.value)} className={inputClass}>{!priorities.includes(priority as TarefaPrioridade) && <option value={priority} disabled>{priority ? `Prioridade atual: ${priority}` : 'Sem prioridade'}</option>}<option value="Baixa">Baixa</option><option value="Media">Média</option><option value="Alta">Alta</option></select></div>
                </div>
                <div className="space-y-2"><label htmlFor={`${id}-responsible`} className="text-sm font-medium text-foreground">Responsável</label><select id={`${id}-responsible`} value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)} aria-invalid={unavailableSelection || undefined} className={inputClass}><option value="">Sem responsável</option>{historicalResponsible && <option value={originalResponsibleId} disabled={responsibleId !== originalResponsibleId}>Usuário excluído (responsável anterior)</option>}{unavailableSelection && <option value={responsibleId} disabled>Participante indisponível</option>}{currentContext.participants.map((participant) => <option key={participant.userId} value={participant.userId}>{participant.name}{participant.userId === userId ? ' (você)' : ''}</option>)}</select>{historicalResponsible && <p className="text-sm text-muted-foreground">O responsável anterior será preservado se você não alterar este campo.</p>}</div>
                <div className="space-y-2"><label htmlFor={`${id}-due-date`} className="text-sm font-medium text-foreground">Prazo e horário <span className="text-muted-foreground">(opcional)</span></label><input id={`${id}-due-date`} type="datetime-local" value={dueDate} onChange={(event) => setDueDate(event.target.value)} aria-invalid={!dateValid || undefined} aria-describedby={!dateValid ? `${id}-date-error` : undefined} className={inputClass} />{!dateValid && <p id={`${id}-date-error`} className="text-sm text-danger">Informe um prazo válido, com data e horário.</p>}</div>
              </fieldset>
            </form>
          )}

          {error && <p id={`${id}-error`} className="mt-4 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger" role="alert">{error}</p>}
          <p className="sr-only" role="status">{saving ? 'Salvando alterações...' : checking ? 'Verificando acesso...' : ''}</p>
          {confirmDelete && editable && currentContext && (
            <div className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-4" role="alertdialog" aria-label="Confirmar exclusão da tarefa">
              <p className="text-sm font-semibold text-foreground">Excluir esta tarefa?</p>
              <p className="mt-1 text-sm text-muted-foreground">A tarefa <strong className="text-foreground">{currentContext.task.nome}</strong> será excluída permanentemente e não poderá ser recuperada.</p>
              <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setConfirmDelete(false)} disabled={busy} className={`h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}>Cancelar</button>
                <button type="button" onClick={() => void handleDelete()} disabled={busy} className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-danger px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}>{deleting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{deleting ? 'Excluindo...' : 'Excluir tarefa'}</button>
              </div>
            </div>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            {editable && !confirmDelete && <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-danger hover:bg-danger/10 disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}><Trash2 className="size-4" aria-hidden="true" />Excluir tarefa</button>}
            {!editable && <span />}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button ref={cancelRef} type="button" onClick={closeDialog} disabled={saving} className={`h-10 rounded-xl px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 ${focusClass}`}>Cancelar</button>
            {!editable && !busy && taskId && <button type="button" onClick={() => refreshRef.current()} className={`h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground hover:bg-muted ${focusClass}`}>Verificar novamente</button>}
            {editable && !confirmDelete && <button type="submit" form={`${id}-form`} disabled={!canSubmit} className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100 ${focusClass}`}>{saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}{saving ? 'Salvando...' : 'Salvar alterações'}</button>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
