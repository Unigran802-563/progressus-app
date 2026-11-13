'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { CalendarDays, ChevronLeft, ChevronRight, Loader2, Plus, TriangleAlert } from 'lucide-react';
import { useProjectParticipantsRefresh } from '@/hooks/useProjectParticipantsRefresh';

import AppShell from '@/components/layout/AppShell';
import { EmptyState, PageHeader } from '@/components/ui/progressus-ui';
import { atualizarTarefa, criarTarefa, listarMinhasTarefas, listarOuCriarStatus, type MinhaTarefa } from '@/lib/tasks';
import { listAccessibleProjects, listProjectParticipants } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import { getTaskResponsibleName } from '@/lib/task-responsibles';
import type { AccessibleProject, ProjectParticipant, TarefaPrioridade, TarefaStatus } from '@/types';

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
  const [projectId, setProjectId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [responsibleId, setResponsibleId] = useState('');
  const [name, setName] = useState('');
  const [priority, setPriority] = useState<TarefaPrioridade>('Media');
  const [saving, setSaving] = useState(false);
  const [loadingProjectData, setLoadingProjectData] = useState(false);
  const [loadedProjectId, setLoadedProjectId] = useState('');
  const [formError, setFormError] = useState('');

  const userName = String(user?.user_metadata?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário');
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  const load = useCallback(async (userId: string, showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      setError('');
      const [taskData, projectData] = await Promise.all([listarMinhasTarefas(userId), listAccessibleProjects()]);
      setTasks(taskData.filter((task) => task.prazo));
      setProjects(projectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o calendário.');
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

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

    window.addEventListener('progressus:tasks-changed', refreshCalendar);
    window.addEventListener('progressus:project-access-checked', refreshCalendar);
    return () => {
      window.removeEventListener('progressus:tasks-changed', refreshCalendar);
      window.removeEventListener('progressus:project-access-checked', refreshCalendar);
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
      const current = map.get(task.prazo) ?? [];
      current.push(task);
      map.set(task.prazo, current);
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
    try {
      await atualizarTarefa(task.id_tarefa, { prazo: value || null });
      if (user) await load(user.id, false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível alterar o prazo.');
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
    return <div key={key} className={`min-h-32 border-b border-r border-border p-2 ${outsideMonth ? 'bg-background/35' : 'bg-surface/30'}`}><div className="mb-2 flex items-center justify-between"><span className={`text-xs font-semibold ${key === dateKey(new Date()) ? 'grid size-6 place-items-center rounded-full bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{date.getDate()}</span><button type="button" onClick={() => openCreate(key)} className="text-muted-foreground hover:text-primary" aria-label={`Criar tarefa em ${key}`}><Plus className="size-3.5" /></button></div><div className="space-y-1">{dayTasks.map((task) => <div key={task.id_tarefa} className="rounded-lg border border-primary/20 bg-primary/10 p-1.5"><button type="button" onClick={() => router.push(`/projects/${task.id_projeto}`)} className="block w-full truncate text-left text-[11px] font-medium text-foreground hover:text-primary">{task.nome}</button><p className="mt-1 truncate text-[10px] text-muted-foreground" title={getTaskResponsibleName(task)}>Responsável: {getTaskResponsibleName(task)}</p><input type="date" value={task.prazo ?? ''} onChange={(event) => void changeTaskDate(task, event.target.value)} className="mt-1 w-full bg-transparent text-[10px] text-muted-foreground" /></div>)}</div></div>;
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth/login'); }

  return <AppShell createLabel="Nova tarefa" userName={userName} userInitial={userInitial} onLogout={logout} onOpenNewTask={() => openCreate(dateKey(new Date()))}><div className="mx-auto flex max-w-[1400px] flex-col gap-6"><PageHeader title="Calendário" subtitle="Visualize e ajuste os prazos das suas tarefas." /><section className="surface-panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><button type="button" onClick={() => moveCursor(-1)} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><ChevronLeft className="size-4" /></button><button type="button" onClick={() => setCursor(new Date())} className="rounded-lg border border-border px-3 py-2 text-xs text-foreground">Hoje</button><button type="button" onClick={() => moveCursor(1)} className="grid size-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-muted"><ChevronRight className="size-4" /></button><h2 className="ml-2 font-semibold capitalize text-foreground">{new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(cursor)}</h2></div><div className="flex items-center gap-2"><button type="button" onClick={() => setView('month')} className={`rounded-lg px-3 py-2 text-xs ${view === 'month' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>Mês</button><button type="button" onClick={() => setView('week')} className={`rounded-lg px-3 py-2 text-xs ${view === 'week' ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>Semana</button><button type="button" onClick={() => openCreate(dateKey(new Date()))} className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground"><Plus className="size-3.5" />Nova tarefa</button></div></section>{loading ? <div className="surface-panel flex min-h-64 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin text-primary" />Carregando calendário...</div> : error ? <div className="surface-panel"><EmptyState icon={<TriangleAlert className="size-6" />} title="Não foi possível carregar o calendário" description={error} /></div> : tasks.length === 0 ? <div className="surface-panel"><EmptyState icon={<CalendarDays className="size-6" />} title="Nenhuma tarefa com prazo" description="Crie ou atribua uma tarefa com prazo para visualizar seus compromissos." action={<button type="button" onClick={() => openCreate(dateKey(new Date()))} className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">Criar tarefa</button>} /></div> : view === 'month' ? <section className="surface-panel overflow-hidden"><div className="grid grid-cols-7 border-b border-border">{['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <div key={day} className="p-3 text-center text-xs font-semibold text-muted-foreground">{day}</div>)}</div><div className="grid grid-cols-7">{monthDays.map((day) => renderDay(day, day.getMonth() !== cursor.getMonth()))}</div></section> : <section className="grid gap-3 md:grid-cols-7">{weekDays.map((day) => { const key = dateKey(day); const dayTasks = tasksByDate.get(key) ?? []; return <div key={key} className="surface-panel min-h-48 p-3"><div className="mb-3 flex items-center justify-between"><div><p className="text-xs text-muted-foreground">{new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(day)}</p><p className="font-semibold text-foreground">{formatDate(key)}</p></div><button type="button" onClick={() => openCreate(key)} className="text-muted-foreground hover:text-primary"><Plus className="size-4" /></button></div>{dayTasks.length === 0 ? <p className="text-xs text-muted-foreground">Sem tarefas</p> : <div className="space-y-2">{dayTasks.map((task) => <div key={task.id_tarefa} className="rounded-lg border border-primary/20 bg-primary/10 p-2"><button type="button" onClick={() => router.push(`/projects/${task.id_projeto}`)} className="text-left text-xs font-medium text-foreground hover:text-primary">{task.nome}</button><p className="mt-1 truncate text-[10px] text-muted-foreground" title={getTaskResponsibleName(task)}>Responsável: {getTaskResponsibleName(task)}</p><input type="date" value={task.prazo ?? ''} onChange={(event) => void changeTaskDate(task, event.target.value)} className="mt-2 w-full bg-transparent text-[10px] text-muted-foreground" /></div>)}</div>}</div>; })}</section>}</div>{modalOpen && <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-3 backdrop-blur-sm sm:items-center sm:p-4"><form noValidate onSubmit={handleCreate} className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:p-6"><div className="mb-4 flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-foreground">Nova tarefa em {formatDate(selectedDate)}</h2><button type="button" disabled={saving} onClick={() => setModalOpen(false)} className="text-sm text-muted-foreground">Fechar</button></div><div className="grid gap-3"><input aria-label="Nome da tarefa" aria-required="true" disabled={saving} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da tarefa" className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /><select aria-label="Projeto" aria-required="true" disabled={saving || loading} value={projectId} onChange={(event) => changeTaskProject(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Selecione o projeto</option>{projects.filter((project) => project.myRole !== 'viewer').map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select aria-label="Status inicial" aria-required="true" disabled={saving || !projectDataReady || statuses.length === 0} value={statusId} onChange={(event) => setStatusId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">{loadingProjectData ? 'Carregando...' : !projectId ? 'Selecione o projeto primeiro' : 'Selecione o status'}</option>{statuses.map((status) => <option key={status.id_status} value={status.id_status}>{status.nome}</option>)}</select><select aria-label="Responsável" aria-required="true" disabled={saving || !projectDataReady || participants.length === 0} value={responsibleId} onChange={(event) => setResponsibleId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">{loadingProjectData ? 'Carregando...' : !projectId ? 'Selecione o projeto primeiro' : 'Selecione o responsável'}</option>{participants.map((participant) => <option key={participant.userId} value={participant.userId}>{participant.name}{participant.userId === user?.id ? ' (você)' : ''}</option>)}</select><select value={priority} onChange={(event) => setPriority(event.target.value as TarefaPrioridade)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="Baixa">Baixa</option><option value="Media">Média</option><option value="Alta">Alta</option></select></div>{formError && <p role="alert" className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{formError}</p>}{!loading && !projects.some((project) => project.myRole !== 'viewer' && !project.archivedAt) && <p className="mt-3 text-sm text-muted-foreground">Você não possui projetos com permissão para criar tarefas.</p>}<button disabled={!canCreateTask} type="submit" className="mt-5 h-10 w-full rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100">{saving ? 'Salvando...' : 'Criar tarefa'}</button></form></div>}</AppShell>;
}
