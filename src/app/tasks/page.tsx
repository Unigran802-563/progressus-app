'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { CalendarDays, CheckCircle2, KanbanSquare, List, Loader2, PencilLine, Plus, Search, TriangleAlert } from 'lucide-react';
import { useProjectParticipantsRefresh } from '@/hooks/useProjectParticipantsRefresh';

import AppShell from '@/components/layout/AppShell';
import EditTaskDialog from '@/components/tasks/EditTaskDialog';
import { EmptyState, PageHeader } from '@/components/ui/progressus-ui';
import { atualizarTarefa, criarTarefa, listarMinhasTarefas, listarOuCriarStatus, type MinhaTarefa } from '@/lib/tasks';
import { listAccessibleProjects, listProjectParticipants } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { canEditTask } from '@/lib/task-permissions';
import { getTaskResponsibleName } from '@/lib/task-responsibles';
import type { AccessibleProject, ProjectParticipant, Tarefa, TarefaPrioridade, TarefaStatus } from '@/types';

type TasksView = 'kanban' | 'list';
type DueFilter = 'any' | '7' | '30';
type ResponsibleFilter = 'mine' | 'any';
type TaskColumn = 'A fazer' | 'Em andamento' | 'Atrasadas' | 'Concluídas';

const taskColumns: TaskColumn[] = ['A fazer', 'Em andamento', 'Atrasadas', 'Concluídas'];

function isCompleted(task: MinhaTarefa) {
  return task.status_nome.toLocaleLowerCase('pt-BR').includes('concl');
}

function isOverdue(task: MinhaTarefa) {
  if (!task.prazo || isCompleted(task)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${task.prazo}T00:00:00`) < today;
}

function getTaskColumn(task: MinhaTarefa): TaskColumn {
  if (isCompleted(task)) return 'Concluídas';
  if (isOverdue(task)) return 'Atrasadas';
  const status = task.status_nome.toLocaleLowerCase('pt-BR');
  if (status.includes('andamento') || status.includes('progresso') || status.includes('revis')) return 'Em andamento';
  return 'A fazer';
}

function priorityTone(priority: string | null) {
  const value = priority?.toLocaleLowerCase('pt-BR');
  if (value === 'alta') return 'text-warning bg-warning/10';
  if (value === 'baixa') return 'text-info bg-info/10';
  return 'text-primary bg-primary/10';
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T00:00:00`));
}

function isWithinDays(date: string | null | undefined, days: number) {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${date}T00:00:00`);
  return due >= today && due.getTime() <= today.getTime() + days * 86400000;
}

export default function MyTasksPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<MinhaTarefa[]>([]);
  const [projects, setProjects] = useState<AccessibleProject[]>([]);
  const [statuses, setStatuses] = useState<TarefaStatus[]>([]);
  const [participants, setParticipants] = useState<ProjectParticipant[]>([]);
  const [view, setView] = useState<TasksView>('kanban');
  const [search, setSearch] = useState('');
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [responsibleFilter, setResponsibleFilter] = useState<ResponsibleFilter>('mine');
  const [dueFilter, setDueFilter] = useState<DueFilter>('any');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [formError, setFormError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newStatusId, setNewStatusId] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [priority, setPriority] = useState<TarefaPrioridade>('Media');
  const [dueDate, setDueDate] = useState('');
  const [editingTask, setEditingTask] = useState<Tarefa | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<TaskColumn | null>(null);

  const userName = String(user?.user_metadata?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário');
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  const load = useCallback(async (userId: string, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const [taskData, projectData] = await Promise.all([listarMinhasTarefas(userId, { includeCreated: true }), listAccessibleProjects()]);
      setTasks(taskData);
      setProjects(projectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar suas tarefas.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  const projectsById = useMemo(() => new Map(projects.map((project) => [project.id, project])), [projects]);
  function taskEditable(task: Tarefa) {
    const project = projectsById.get(task.id_projeto);
    return Boolean(project && !project.archivedAt && canEditTask(task, user?.id ?? '', project.myRole));
  }

  function openTask(task: MinhaTarefa) {
    if (taskEditable(task)) setEditingTask(task);
    else router.push(`/projects/${task.id_projeto}`);
  }

  const closeEditTask = useCallback(() => setEditingTask(null), []);
  const handleTaskSaved = useCallback((_updated: Tarefa) => {
    setEditingTask(null);
    if (user?.id) void load(user.id, false);
  }, [load, user?.id]);
  const handleTaskDeleted = useCallback((_taskId: string) => {
    setEditingTask(null);
    if (user?.id) void load(user.id, false);
  }, [load, user?.id]);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (sessionError || !data.session) {
        router.replace('/auth/login');
        return;
      }
      if (!active) return;
      setUser(data.session.user);
      void load(data.session.user.id);
    });
    return () => { active = false; };
  }, [load, router]);

  useEffect(() => {
    if (!user) return;
    const userId = user.id;

    function refreshTasks() {
      void load(userId, false);
    }

    function refreshAccess(event: Event) {
      const accessibleProjects = (event as CustomEvent<{ projects: AccessibleProject[] }>).detail?.projects;
      if (accessibleProjects) {
        setProjects(accessibleProjects.filter((project) => !project.archivedAt));
        const accessibleIds = new Set(accessibleProjects.map((project) => project.id));
        setTasks((current) => current.filter((task) => accessibleIds.has(task.id_projeto)));
      }
      refreshTasks();
    }

    window.addEventListener('progressus:tasks-changed', refreshTasks);
    window.addEventListener('progressus:project-access-checked', refreshAccess);
    return () => {
      window.removeEventListener('progressus:tasks-changed', refreshTasks);
      window.removeEventListener('progressus:project-access-checked', refreshAccess);
    };
  }, [load, user]);

  useEffect(() => {
    let active = true;
    setStatuses([]);
    setNewStatusId('');
    setParticipants([]);
    setResponsibleId('');
    setLoadedProjectId('');
    setLoadingProjectData(false);
    if (!modalOpen || !newProjectId) return;

    setLoadingProjectData(true);
    void Promise.all([listarOuCriarStatus(newProjectId), listProjectParticipants(newProjectId)])
      .then(([items, projectParticipants]) => {
        if (!active) return;
        setStatuses(items);
        setNewStatusId(items[0]?.id_status ?? '');
        const eligible = projectParticipants.filter((participant) => participant.role !== 'viewer');
        setParticipants(eligible);
        setResponsibleId(eligible.find((participant) => participant.userId === user?.id)?.userId ?? eligible[0]?.userId ?? '');
        setLoadedProjectId(newProjectId);
      })
      .catch(() => {
        if (active) setFormError('Não foi possível carregar os status e responsáveis. Selecione o projeto novamente.');
      })
      .finally(() => { if (active) setLoadingProjectData(false); });
    return () => { active = false; };
  }, [modalOpen, newProjectId, user?.id]);

  const visibleTasks = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return tasks.filter((task) => {
      const matchesSearch = !normalized || `${task.nome} ${task.projeto_nome} ${task.status_nome}`.toLocaleLowerCase('pt-BR').includes(normalized);
      const matchesProject = !projectFilter || task.id_projeto === projectFilter;
      const matchesStatus = !statusFilter || getTaskColumn(task) === statusFilter;
      const matchesPriority = !priorityFilter || (task.prioridade || 'Media') === priorityFilter;
      const matchesDue = dueFilter === 'any' || isWithinDays(task.prazo, Number(dueFilter));
      const matchesResponsible = responsibleFilter === 'any' || task.id_usuario === user?.id;
      return matchesSearch && matchesProject && matchesStatus && matchesPriority && matchesDue && matchesResponsible;
    });
  }, [dueFilter, priorityFilter, projectFilter, responsibleFilter, search, statusFilter, tasks, user?.id]);


  async function handleComplete(task: MinhaTarefa) {
    if (!taskEditable(task) || updatingTaskId || isCompleted(task)) return;
    try {
      setUpdatingTaskId(task.id_tarefa);
      const projectStatuses = await listarOuCriarStatus(task.id_projeto);
      const completed = projectStatuses.find((item) => item.nome.toLocaleLowerCase('pt-BR').includes('concl'));
      if (!completed) {
        setError('Não existe uma coluna de status concluído neste projeto.');
        return;
      }
      await atualizarTarefa(task.id_tarefa, { id_status: completed.id_status });
      if (user) await load(user.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a tarefa.');
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function findStatusForColumn(statusesForProject: TarefaStatus[], column: TaskColumn) {
    if (column === 'Atrasadas') return null;
    const normalized = (status: TarefaStatus) => status.nome.toLocaleLowerCase('pt-BR');
    if (column === 'Concluídas') return statusesForProject.find((status) => normalized(status).includes('concl')) ?? null;
    if (column === 'Em andamento') {
      return statusesForProject.find((status) => normalized(status).includes('andamento') || normalized(status).includes('progresso') || normalized(status).includes('revis')) ?? null;
    }
    return statusesForProject.find((status) => normalized(status).includes('fazer'))
      ?? statusesForProject.find((status) => !normalized(status).includes('concl') && !normalized(status).includes('andamento') && !normalized(status).includes('progresso') && !normalized(status).includes('revis'))
      ?? statusesForProject[0]
      ?? null;
  }

  async function moveTaskToColumn(task: MinhaTarefa, column: TaskColumn) {
    setDropTarget(null);
    setDraggingTaskId(null);
    if (column === 'Atrasadas') {
      setError('A coluna “Atrasadas” é automática e depende do prazo. Altere o prazo ou arraste para um status real.');
      return;
    }
    if (!taskEditable(task) || updatingTaskId) return;
    try {
      setUpdatingTaskId(task.id_tarefa);
      const projectStatuses = await listarOuCriarStatus(task.id_projeto);
      const targetStatus = findStatusForColumn(projectStatuses, column);
      if (!targetStatus) {
        setError(`O projeto “${task.projeto_nome}” não possui um status correspondente a “${column}”.`);
        return;
      }
      if (targetStatus.id_status === task.id_status) return;
      await atualizarTarefa(task.id_tarefa, { id_status: targetStatus.id_status });
      if (user) await load(user.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível mover a tarefa.');
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function changeTaskProject(value: string) {
    setNewProjectId(value);
    setStatuses([]);
    setNewStatusId('');
    setParticipants([]);
    setResponsibleId('');
    setLoadedProjectId('');
    setFormError('');
  }

  function openNewTask() {
    setName(''); setDescription(''); setDueDate(''); setPriority('Media');
    changeTaskProject('');
    setModalOpen(true);
  }

  useProjectParticipantsRefresh(newProjectId, modalOpen, (eligible) => {
    setParticipants(eligible);
    setResponsibleId((current) => eligible.some((member) => member.userId === current) ? current : '');
  }, () => { changeTaskProject(''); });

  const projectAllowed = projects.some((project) => project.id === newProjectId && project.myRole !== 'viewer' && !project.archivedAt);
  const projectDataReady = Boolean(newProjectId && loadedProjectId === newProjectId && !loadingProjectData);
  const canCreateTask = Boolean(user && name.trim() && projectAllowed && projectDataReady && statuses.some((status) => status.id_status === newStatusId) && participants.some((participant) => participant.userId === responsibleId) && !saving);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (!user) {
      setFormError('Usuário não autenticado.');
      return;
    }
    if (!name.trim()) {
      setFormError('Informe o nome da tarefa.');
      return;
    }
    if (!newProjectId || !projectAllowed) {
      setFormError('Selecione o projeto da tarefa.');
      return;
    }
    if (!projectDataReady) {
      setFormError('Aguarde o carregamento dos status e responsáveis do projeto.');
      return;
    }
    if (!statuses.some((status) => status.id_status === newStatusId)) {
      setFormError('Selecione o status inicial da tarefa.');
      return;
    }
    if (!participants.some((participant) => participant.userId === responsibleId)) {
      setFormError('Selecione o responsável pela tarefa.');
      return;
    }
    try {
      setFormError('');
      setSaving(true);
      await criarTarefa({ id_projeto: newProjectId, id_status: newStatusId, id_usuario: responsibleId, nome: name, descricao: description, prioridade: priority, prazo: dueDate || null });
      await load(user.id, false);
      setModalOpen(false);
      setName(''); setDescription(''); setDueDate(''); setPriority('Media'); setNewProjectId(''); setResponsibleId('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  function taskCard(task: MinhaTarefa) {
    const project = projectsById.get(task.id_projeto);
    const editable = taskEditable(task);
    return (
      <article key={task.id_tarefa} draggable={editable} onDragStart={(event) => { if (!editable) { event.preventDefault(); return; } event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', task.id_tarefa); setDraggingTaskId(task.id_tarefa); }} onDragEnd={() => { setDraggingTaskId(null); setDropTarget(null); }} className={`rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg ${editable ? 'cursor-grab active:cursor-grabbing' : ''} ${draggingTaskId === task.id_tarefa ? 'opacity-50' : ''}`}>
        <button type="button" onClick={() => openTask(task)} className="block w-full text-left text-sm font-semibold leading-5 text-foreground hover:text-primary">{task.nome}</button>
        <button type="button" onClick={() => router.push(`/projects/${task.id_projeto}`)} className="mt-2 flex items-center gap-2 text-left text-xs text-muted-foreground hover:text-primary"><span className="size-2 rounded-full bg-primary" />{project?.name ?? task.projeto_nome}</button>
        {task.descricao && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{task.descricao}</p>}
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${priorityTone(task.prioridade)}`}>{task.prioridade || 'Media'}</span>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarDays className="size-3.5" />{formatDate(task.prazo)}</span>
          <span title={getTaskResponsibleName(task)} aria-label={`Responsável: ${getTaskResponsibleName(task)}`} className="grid size-7 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{task.responsavel_excluido ? '?' : getTaskResponsibleName(task).charAt(0).toUpperCase()}</span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">Responsável: {getTaskResponsibleName(task)}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          {editable && <button type="button" onClick={() => setEditingTask(task)} className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline" aria-label={`Editar tarefa ${task.nome}`}><PencilLine className="size-3.5" />Editar</button>}
          {!isCompleted(task) && <button type="button" disabled={!editable || updatingTaskId === task.id_tarefa} onClick={() => void handleComplete(task)} className="inline-flex items-center gap-1.5 text-xs font-medium text-success hover:text-success/80 disabled:cursor-not-allowed disabled:opacity-50"><CheckCircle2 className="size-3.5" />Marcar como concluída</button>}
        </div>
      </article>
    );
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth/login'); }

  return <AppShell createLabel="Nova tarefa" userName={userName} userInitial={userInitial} onLogout={logout} onOpenNewTask={openNewTask}><div className="mx-auto flex max-w-[1400px] flex-col gap-5"><PageHeader title="Minhas tarefas" subtitle={`${visibleTasks.length} de ${tasks.length} tarefas visíveis com os filtros atuais.`} actions={<div className="flex items-center gap-2"><div className="inline-flex rounded-xl border border-border bg-muted/40 p-1"><button type="button" onClick={() => setView('kanban')} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ${view === 'kanban' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><KanbanSquare className="size-4" />Kanban</button><button type="button" onClick={() => setView('list')} className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium ${view === 'list' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}><List className="size-4" />Lista</button></div><button type="button" onClick={openNewTask} className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="size-4" />Nova tarefa</button></div>} /><section className="surface-panel grid gap-3 p-4 md:grid-cols-6"><div className="relative md:col-span-2"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefas" className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:border-primary/50" /></div><select aria-label="Filtrar por projeto" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Todos os projetos</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select aria-label="Filtrar por status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Todos os status</option>{taskColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select><select aria-label="Filtrar por prioridade" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Todas as prioridades</option><option value="Alta">Alta</option><option value="Media">Média</option><option value="Baixa">Baixa</option></select><select aria-label="Filtrar por responsável" value={responsibleFilter} onChange={(event) => setResponsibleFilter(event.target.value as ResponsibleFilter)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="mine">Responsável: eu</option><option value="any">Qualquer responsável</option></select><select aria-label="Filtrar por prazo" value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueFilter)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="any">Qualquer prazo</option><option value="7">Próximos 7 dias</option><option value="30">Próximos 30 dias</option></select></section>{loading ? <div className="surface-panel flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin text-primary" />Carregando tarefas...</div> : error ? <div className="surface-panel"><EmptyState icon={<TriangleAlert className="size-6" />} title="Não foi possível carregar as tarefas" description={error} action={<button type="button" onClick={() => user && void load(user.id)} className="rounded-xl border border-border px-4 py-2 text-sm">Tentar novamente</button>} /></div> : visibleTasks.length === 0 ? <div className="surface-panel"><EmptyState icon={<List className="size-6" />} title="Nenhuma tarefa encontrada" description="Ajuste os filtros ou crie uma nova tarefa para começar." action={<button type="button" onClick={openNewTask} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Nova tarefa</button>} /></div> : view === 'kanban' ? <section className="grid gap-4 xl:grid-cols-4">{taskColumns.map((column) => { const columnTasks = visibleTasks.filter((task) => getTaskColumn(task) === column); return <div key={column} onDragOver={(event) => { if (draggingTaskId && column !== 'Atrasadas') { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; setDropTarget(column); } }} onDragLeave={() => setDropTarget((current) => current === column ? null : current)} onDrop={(event) => { event.preventDefault(); const task = visibleTasks.find((item) => item.id_tarefa === event.dataTransfer.getData('text/plain')); if (task) void moveTaskToColumn(task, column); }} className={`min-w-0 rounded-2xl border bg-muted/20 p-3 transition-colors ${dropTarget === column ? 'border-primary bg-primary/10' : 'border-border'} ${column === 'Atrasadas' && draggingTaskId ? 'opacity-75' : ''}`}><div className="mb-3 flex items-center justify-between border-b border-border/70 pb-3"><div className="flex items-center gap-2"><span className={`size-2 rounded-full ${column.toLocaleLowerCase('pt-BR').includes('concl') ? 'bg-success' : column.toLocaleLowerCase('pt-BR').includes('atras') ? 'bg-danger' : column.toLocaleLowerCase('pt-BR').includes('andamento') ? 'bg-warning' : 'bg-primary'}`} /><h2 className="text-sm font-semibold text-foreground">{column}</h2>{draggingTaskId && column !== 'Atrasadas' && <span className="text-[10px] text-primary">Soltar aqui</span>}</div><span className="grid min-w-7 place-items-center rounded-full bg-background px-2 py-1 text-xs text-muted-foreground">{columnTasks.length}</span></div><div className="space-y-3">{columnTasks.map(taskCard)}{columnTasks.length === 0 && <div className="rounded-xl border border-dashed border-border px-3 py-8 text-center text-xs text-muted-foreground">Nenhuma tarefa nesta coluna.</div>}<button type="button" onClick={openNewTask} className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2.5 text-xs text-muted-foreground hover:border-primary/40 hover:text-primary"><Plus className="size-3.5" />Adicionar tarefa</button></div></div>; })}</section> : <section className="surface-panel overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b border-border bg-muted/25"><tr><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tarefa</th><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Projeto</th><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prioridade</th><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Responsável</th><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Prazo</th><th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ação</th></tr></thead><tbody className="divide-y divide-border">{visibleTasks.map((task) => <tr key={task.id_tarefa} className="hover:bg-muted/20"><td className="px-5 py-4"><button type="button" onClick={() => openTask(task)} className="text-sm font-semibold text-foreground hover:text-primary">{task.nome}</button></td><td className="px-5 py-4 text-sm text-muted-foreground"><button type="button" onClick={() => router.push(`/projects/${task.id_projeto}`)} className="text-left hover:text-primary">{task.projeto_nome}</button></td><td className="px-5 py-4 text-sm text-muted-foreground">{task.status_nome}</td><td className="px-5 py-4"><span className={`rounded-full px-2 py-1 text-xs font-medium ${priorityTone(task.prioridade)}`}>{task.prioridade || 'Media'}</span></td><td className="px-5 py-4 text-sm text-muted-foreground">{getTaskResponsibleName(task)}</td><td className="px-5 py-4 text-sm text-muted-foreground">{formatDate(task.prazo)}</td><td className="px-5 py-4">{taskEditable(task) && <button type="button" onClick={() => setEditingTask(task)} className="mr-3 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline" aria-label={`Editar tarefa ${task.nome}`}><PencilLine className="size-3.5" />Editar</button>}{isCompleted(task) ? <span className="text-xs text-success">Concluída</span> : <button type="button" disabled={!taskEditable(task) || updatingTaskId === task.id_tarefa} onClick={() => void handleComplete(task)} className="text-xs font-medium text-success hover:underline disabled:cursor-not-allowed disabled:opacity-50">Concluir</button>}</td></tr>)}</tbody></table></section>}</div>{modalOpen && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"><form noValidate onSubmit={handleCreate} className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-display text-xl font-semibold text-foreground">Nova tarefa</h2><p className="mt-1 text-sm text-muted-foreground">Adicione uma atividade ao projeto.</p></div><button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="text-sm text-muted-foreground">Fechar</button></div><div className="grid gap-3"><input aria-label="Nome da tarefa" aria-required="true" disabled={saving} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da tarefa" className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição (opcional)" className="min-h-24 rounded-xl border border-border bg-background p-3 text-sm text-foreground" /><select aria-label="Projeto" aria-required="true" disabled={saving || loading} value={newProjectId} onChange={(event) => changeTaskProject(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Selecione o projeto</option>{projects.filter((project) => project.myRole !== 'viewer' && !project.archivedAt).map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select aria-label="Status inicial" aria-required="true" disabled={saving || !projectDataReady || statuses.length === 0} value={newStatusId} onChange={(event) => setNewStatusId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">{loadingProjectData ? 'Carregando...' : !newProjectId ? 'Selecione o projeto primeiro' : 'Selecione o status'}</option>{statuses.map((status) => <option key={status.id_status} value={status.id_status}>{status.nome}</option>)}</select><select aria-label="Responsável" aria-required="true" disabled={saving || !projectDataReady || participants.length === 0} value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">{loadingProjectData ? 'Carregando...' : !newProjectId ? 'Selecione o projeto primeiro' : 'Selecione o responsável'}</option>{participants.map((participant) => <option key={participant.userId} value={participant.userId}>{participant.name}{participant.userId === user?.id ? ' (você)' : ''}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><select value={priority} onChange={(event) => setPriority(event.target.value as TarefaPrioridade)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="Baixa">Baixa</option><option value="Media">Média</option><option value="Alta">Alta</option></select><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></div></div>{formError && <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{formError}</p>}{!loading && !projects.some((project) => project.myRole !== 'viewer' && !project.archivedAt) && <p className="mt-3 text-sm text-muted-foreground">Você não possui projetos com permissão para criar tarefas.</p>}<button disabled={!canCreateTask} type="submit" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100">{saving ? 'Salvando...' : 'Criar tarefa'}</button></form></div>}<EditTaskDialog open={Boolean(editingTask)} task={editingTask} userId={user?.id ?? ''} onClose={closeEditTask} onSaved={handleTaskSaved} onDeleted={handleTaskDeleted} /></AppShell>;
}
