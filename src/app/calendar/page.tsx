'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { useProjectParticipantsRefresh } from '@/hooks/useProjectParticipantsRefresh';

import AppShell from '@/components/layout/AppShell';
import NewProjectDialog from '@/components/projects/NewProjectDialog';
import CreateTaskDialog from '@/components/tasks/CreateTaskDialog';
import EditTaskDialog from '@/components/tasks/EditTaskDialog';
import { EmptyState, PageHeader } from '@/components/ui/progressus-ui';
import { atualizarTarefa, criarTarefa, listarMinhasTarefas, listarOuCriarStatus, type MinhaTarefa } from '@/lib/tasks';
import { createProject, listAccessibleProjects, listProjectParticipants } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { canEditTask } from '@/lib/task-permissions';
import { getTaskResponsibleName } from '@/lib/task-responsibles';
import type { AccessibleProject, ProjectParticipant, Tarefa, TarefaPrioridade, TarefaStatus } from '@/types';

type CalendarView = 'month' | 'week';

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function fromKey(value: string) {
  return new Date(`${value}T00:00:00`);
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  result.setHours(0, 0, 0, 0);
  return result;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(fromKey(value));
}

function taskDateKey(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return dateKey(new Date(value));
}

function toLocalDateTimeInput(value: string) {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T09:00`;
  const date = new Date(value);
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return '';
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? fromKey(value) : new Date(value);
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
}

function localDateTimeToIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export default function CalendarPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<MinhaTarefa[]>([]);
  const [projects, setProjects] = useState<AccessibleProject[]>([]);
  const [statuses, setStatuses] = useState<TarefaStatus[]>([]);
  const [participants, setParticipants] = useState<ProjectParticipant[]>([]);
  const [cursor, setCursor] = useState(() => new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()));
  const [modalOpen, setModalOpen] = useState(false);
  const [isNewProjectDialogOpen, setIsNewProjectDialogOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<TarefaPrioridade>('Media');
  const [saving, setSaving] = useState(false);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [formError, setFormError] = useState('');
  const [editingTask, setEditingTask] = useState<Tarefa | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const userName = String(user?.user_metadata?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário');
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  const load = useCallback(async (userId: string, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const [taskData, projectData] = await Promise.all([listarMinhasTarefas(userId, { includeCreated: true }), listAccessibleProjects()]);
      setTasks(taskData.filter((task) => task.prazo));
      setProjects(projectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o calendário.');
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
    function refreshCalendar() {
      if (user) void load(user.id, false);
    }

    function refreshAccess(event: Event) {
      const accessibleProjects = (event as CustomEvent<{ projects: AccessibleProject[] }>).detail?.projects;
      if (accessibleProjects) {
        setProjects(accessibleProjects.filter((project) => !project.archivedAt));
        const accessibleIds = new Set(accessibleProjects.map((project) => project.id));
        setTasks((current) => current.filter((task) => accessibleIds.has(task.id_projeto)));
      }
      refreshCalendar();
    }

    window.addEventListener('progressus:tasks-changed', refreshCalendar);
    window.addEventListener('progressus:project-access-checked', refreshAccess);
    return () => {
      window.removeEventListener('progressus:tasks-changed', refreshCalendar);
      window.removeEventListener('progressus:project-access-checked', refreshAccess);
    };
  }, [load, user]);

  useEffect(() => {
    let active = true;
    setStatuses([]);
    setStatusId('');
    setParticipants([]);
    setResponsibleId('');
    setLoadedProjectId('');
    setLoadingProjectData(false);
    if (!modalOpen || !projectId) return;

    setLoadingProjectData(true);
    void Promise.all([listarOuCriarStatus(projectId), listProjectParticipants(projectId)])
      .then(([items, projectParticipants]) => {
        if (!active) return;
        setStatuses(items);
        setStatusId(items[0]?.id_status ?? '');
        const eligible = projectParticipants.filter((participant) => participant.role !== 'viewer');
        setParticipants(eligible);
        setResponsibleId(eligible.find((participant) => participant.userId === user?.id)?.userId ?? eligible[0]?.userId ?? '');
        setLoadedProjectId(projectId);
      })
      .catch(() => {
        if (active) setFormError('Não foi possível carregar os status e responsáveis. Selecione o projeto novamente.');
      })
      .finally(() => { if (active) setLoadingProjectData(false); });
    return () => { active = false; };
  }, [modalOpen, projectId, user?.id]);

  const monthDays = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const start = startOfWeek(first);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [cursor]);

  const weekDays = useMemo(() => {
    const start = startOfWeek(cursor);
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [cursor]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, MinhaTarefa[]>();
    for (const task of tasks) {
      if (!task.prazo) continue;
      const key = taskDateKey(task.prazo);
      const current = map.get(key) ?? [];
      current.push(task);
      map.set(key, current);
    }
    return map;
  }, [tasks]);

  function moveCursor(delta: number) {
    setCursor((current) => {
      const next = new Date(current);
      if (view === 'month') next.setMonth(next.getMonth() + delta);
      else next.setDate(next.getDate() + delta * 7);
      return next;
    });
  }

  async function changeTaskDate(task: MinhaTarefa, value: string) {
    if (!taskEditable(task) || updatingTaskId) return;
    try {
      setUpdatingTaskId(task.id_tarefa);
      await atualizarTarefa(task.id_tarefa, { prazo: localDateTimeToIso(value) });
      if (user) await load(user.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar o prazo.');
    } finally {
      setUpdatingTaskId(null);
    }
  }

  function changeTaskProject(value: string) {
    setProjectId(value);
    setStatuses([]);
    setStatusId('');
    setParticipants([]);
    setResponsibleId('');
    setLoadedProjectId('');
    setFormError('');
  }

  function openCreate(date: string) {
    setSelectedDate(date);
    changeTaskProject('');
    setStatusId('');
    setName('');
    setPriority('Media');
    setError('');
    setModalOpen(true);
  }

  function handleCreatedTask(task: Tarefa) {
    setModalOpen(false);
    if (user) void load(user.id, false);
    router.push(`/projects/${task.id_projeto}/tasks`);
  }

  async function handleCreateProject(data: import('@/types').CreateProjectData) {
    const project = await createProject(data);
    setIsNewProjectDialogOpen(false);
    if (user) void load(user.id, false);
    router.push(`/projects/${project.id}`);
  }

  useProjectParticipantsRefresh(projectId, modalOpen, (eligible) => {
    setParticipants(eligible);
    setResponsibleId((current) => eligible.some((member) => member.userId === current) ? current : '');
  }, () => { changeTaskProject(''); });

  const projectAllowed = projects.some((project) => project.id === projectId && project.myRole !== 'viewer' && !project.archivedAt);
  const projectDataReady = Boolean(projectId && loadedProjectId === projectId && !loadingProjectData);
  const canCreateTask = Boolean(user && name.trim() && projectAllowed && projectDataReady && statuses.some((status) => status.id_status === statusId) && participants.some((participant) => participant.userId === responsibleId) && !saving);

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
    if (!projectId || !projectAllowed) {
      setFormError('Selecione o projeto da tarefa.');
      return;
    }
    if (!projectDataReady) {
      setFormError('Aguarde o carregamento dos status e responsáveis do projeto.');
      return;
    }
    if (!statuses.some((status) => status.id_status === statusId)) {
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
      await criarTarefa({ id_projeto: projectId, id_status: statusId, id_usuario: responsibleId, nome: name, prioridade: priority, prazo: selectedDate });
      await load(user.id, false);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível criar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  function renderDay(date: Date, outsideMonth = false) {
    const key = dateKey(date);
    const dayTasks = tasksByDate.get(key) ?? [];
    return <div key={key} className={`min-h-28 min-w-0 border-b border-r border-border p-1.5 sm:min-h-32 sm:p-2 ${outsideMonth ? 'bg-background/35' : 'bg-surface/30'}`}><div className="mb-2 flex items-center justify-between"><span className={`text-xs font-semibold ${key === dateKey(new Date()) ? 'grid size-6 place-items-center rounded-full bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{date.getDate()}</span><button type="button" onClick={() => openCreate(key)} className="text-muted-foreground hover:text-primary" aria-label={`Criar tarefa em ${key}`}><Plus className="size-3.5" /></button></div><div className="space-y-1">{dayTasks.map((task) => <div key={task.id_tarefa} className="rounded-lg border border-primary/20 bg-primary/10 p-1.5"><button type="button" onClick={() => openTask(task)} className="block w-full truncate text-left text-[11px] font-medium text-foreground hover:text-primary">{task.nome}</button><p className="mt-1 truncate text-[10px] text-muted-foreground" title={getTaskResponsibleName(task)}>Prazo: {formatDateTime(task.prazo)} · Responsável: {getTaskResponsibleName(task)}</p><input type="datetime-local" aria-label={`Prazo e horário de ${task.nome}`} disabled={!taskEditable(task) || updatingTaskId === task.id_tarefa} value={task.prazo ? toLocalDateTimeInput(task.prazo) : ''} onChange={(event) => void changeTaskDate(task, event.target.value)} className="mt-1 w-full bg-transparent text-[10px] text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" /></div>)}</div></div>;
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth/login'); }

  return <AppShell createLabel="Nova tarefa" userName={userName} userInitial={userInitial} onLogout={logout} onOpenNewTask={() => openCreate(dateKey(new Date()))}><div className="mx-auto flex max-w-[1400px] flex-col gap-6"><PageHeader title="Calendário" subtitle="Visualize e ajuste os prazos das suas tarefas." /><section className="surface-panel flex min-w-0 flex-col gap-3 p-3 sm:p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 flex-wrap items-center gap-2"><button type="button" onClick={() => moveCursor(-1)} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => setCursor(new Date())} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">Hoje</button><button type="button" onClick={() => moveCursor(1)} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><ChevronRight className="size-4" /></button><h2 className="ml-0 min-w-0 truncate font-semibold capitalize text-foreground sm:ml-2">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor)}</h2></div><div className="flex flex-wrap items-center gap-1.5 sm:gap-2"><button type="button" onClick={() => setView('month')} className={`rounded-lg px-3 py-2 text-xs ${view === 'month' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>Mês</button><button type="button" onClick={() => setView('week')} className={`rounded-lg px-3 py-2 text-xs ${view === 'week' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>Semana</button><button type="button" onClick={() => openCreate(dateKey(new Date()))} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="size-3.5" />Nova tarefa</button></div></section>{loading ? <div className="surface-panel flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin text-primary" />Carregando calendário...</div> : error ? <div className="surface-panel"><EmptyState icon={<TriangleAlert className="size-6" />} title="Não foi possível carregar o calendário" description={error} /></div> : tasks.length === 0 ? <div className="surface-panel"><EmptyState icon={<CalendarDays className="size-6" />} title="Nenhuma tarefa com prazo" description="Crie ou atribua uma tarefa com prazo para visualizar seus compromissos." action={<button type="button" onClick={() => openCreate(dateKey(new Date()))} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Criar tarefa</button>} /></div> : view === 'month' ? <section className="surface-panel overflow-hidden"><div className="grid min-w-0 grid-cols-7 border-b border-border">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <div key={day} className="min-w-0 p-2 text-center text-[10px] font-semibold text-muted-foreground sm:p-3 sm:text-xs">{day}</div>)}</div><div className="grid min-w-0 grid-cols-7">{monthDays.map((day) => renderDay(day, day.getMonth() !== cursor.getMonth()))}</div></section> : <section className="grid gap-3 md:grid-cols-7">{weekDays.map((day) => { const key = dateKey(day); const dayTasks = tasksByDate.get(key) ?? []; return <div key={key} className="surface-panel min-h-48 p-3"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(day)}</p><p className="font-semibold text-foreground">{formatDate(key)}</p></div><button type="button" onClick={() => openCreate(key)} className="text-muted-foreground hover:text-primary"><Plus className="size-4" /></button></div>{dayTasks.length === 0 ? <p className="text-xs text-muted-foreground">Sem tarefas</p> : <div className="space-y-2">{dayTasks.map((task) => <div key={task.id_tarefa} className="rounded-lg border border-primary/20 bg-primary/10 p-2"><button type="button" onClick={() => openTask(task)} className="text-left text-xs font-medium text-foreground hover:text-primary">{task.nome}</button><p className="mt-1 truncate text-[10px] text-muted-foreground" title={getTaskResponsibleName(task)}>Prazo: {formatDateTime(task.prazo)} · Responsável: {getTaskResponsibleName(task)}</p><input type="datetime-local" aria-label={`Prazo e horário de ${task.nome}`} disabled={!taskEditable(task) || updatingTaskId === task.id_tarefa} value={task.prazo ? toLocalDateTimeInput(task.prazo) : ''} onChange={(event) => void changeTaskDate(task, event.target.value)} className="mt-2 w-full bg-transparent text-[10px] text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" /></div>)}</div>}</div>; })}</section>}</div><CreateTaskDialog open={modalOpen} projects={projects} userId={user?.id ?? ""} initialDueDate={selectedDate} onClose={() => setModalOpen(false)} onCreated={handleCreatedTask} onRequestCreateProject={() => { setModalOpen(false); setIsNewProjectDialogOpen(true); }} /><NewProjectDialog open={isNewProjectDialogOpen} onClose={() => setIsNewProjectDialogOpen(false)} onCreate={handleCreateProject} /><EditTaskDialog open={Boolean(editingTask)} task={editingTask} userId={user?.id ?? ''} onClose={closeEditTask} onSaved={handleTaskSaved} onDeleted={handleTaskDeleted} /></AppShell>;
}
