'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { CheckCircle2, ListChecks, Loader2, Plus, TriangleAlert } from 'lucide-react';

import AppShell from '@/components/layout/AppShell';
import { EmptyState, PageHeader } from '@/components/ui/progressus-ui';
import { listarMinhasTarefas, listarStatus, criarTarefa, atualizarTarefa, type MinhaTarefa } from '@/lib/tasks';
import { listAccessibleProjects } from '@/lib/projects';
import { supabase } from '@/lib/supabase';
import type { AccessibleProject, TarefaPrioridade, TarefaStatus } from '@/types';

type StatusFilter = 'todos' | 'pendentes' | 'concluidas';
type DueFilter = 'todos' | 'atrasadas' | 'proximas' | 'sem_prazo';

function isCompleted(task: MinhaTarefa) {
  return task.status_nome.toLocaleLowerCase('pt-BR').includes('concl');
}

function formatDueDate(date: string | null | undefined) {
  if (!date) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${date}T00:00:00`));
}

export default function MyTasksPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<MinhaTarefa[]>([]);
  const [projects, setProjects] = useState<AccessibleProject[]>([]);
  const [statuses, setStatuses] = useState<TarefaStatus[]>([]);
  const [projectId, setProjectId] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('todos');
  const [dueFilter, setDueFilter] = useState<DueFilter>('todos');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [newProjectId, setNewProjectId] = useState('');
  const [newStatusId, setNewStatusId] = useState('');
  const [priority, setPriority] = useState<TarefaPrioridade>('Media');
  const [dueDate, setDueDate] = useState('');

  const userName = String(user?.user_metadata?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário');
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  const load = useCallback(async (userId: string) => {
    try {
      setLoading(true);
      setError('');
      const [taskData, projectData] = await Promise.all([listarMinhasTarefas(userId), listAccessibleProjects()]);
      setTasks(taskData);
      setProjects(projectData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar suas tarefas.');
    } finally {
      setLoading(false);
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
    if (!newProjectId) {
      setStatuses([]);
      setNewStatusId('');
      return;
    }
    void listarStatus(newProjectId).then((items) => {
      setStatuses(items);
      setNewStatusId(items[0]?.id_status ?? '');
    }).catch(() => {
      setStatuses([]);
      setNewStatusId('');
    });
  }, [newProjectId]);

  const visibleTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const normalized = search.trim().toLocaleLowerCase('pt-BR');
    return tasks.filter((task) => {
      const completed = isCompleted(task);
      if (statusFilter === 'pendentes' && completed) return false;
      if (statusFilter === 'concluidas' && !completed) return false;
      if (projectId && task.id_projeto !== projectId) return false;
      if (normalized && !`${task.nome} ${task.projeto_nome} ${task.status_nome}`.toLocaleLowerCase('pt-BR').includes(normalized)) return false;
      if (dueFilter === 'sem_prazo' && task.prazo) return false;
      if (dueFilter === 'atrasadas' && (!task.prazo || completed || new Date(`${task.prazo}T00:00:00`) >= today)) return false;
      if (dueFilter === 'proximas' && (!task.prazo || new Date(`${task.prazo}T00:00:00`) < today || new Date(`${task.prazo}T00:00:00`).getTime() > today.getTime() + 7 * 86400000)) return false;
      return true;
    });
  }, [dueFilter, projectId, search, statusFilter, tasks]);

  async function handleComplete(task: MinhaTarefa) {
    const completedStatus = (await listarStatus(task.id_projeto)).find((item) => item.nome.toLocaleLowerCase('pt-BR').includes('concl'));
    if (!completedStatus) {
      setError('Não existe uma coluna de status concluído neste projeto.');
      return;
    }
    try {
      const updated = await atualizarTarefa(task.id_tarefa, { id_status: completedStatus.id_status });
      setTasks((current) => current.map((item) => item.id_tarefa === updated.id_tarefa ? { ...item, ...updated, status_nome: completedStatus.nome } : item));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível concluir a tarefa.');
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !name.trim() || !newProjectId || !newStatusId) return;
    try {
      setSaving(true);
      const created = await criarTarefa({ id_projeto: newProjectId, id_status: newStatusId, id_usuario: user.id, nome: name, descricao: description, prioridade: priority, prazo: dueDate || null });
      const project = projects.find((item) => item.id === newProjectId);
      const status = statuses.find((item) => item.id_status === newStatusId);
      setTasks((current) => [{ ...created, projeto_nome: project?.name ?? 'Projeto', status_nome: status?.nome ?? 'Status' }, ...current]);
      setModalOpen(false);
      setName(''); setDescription(''); setDueDate(''); setPriority('Media');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a tarefa.');
    } finally {
      setSaving(false);
    }
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth/login'); }

  return (
    <AppShell userName={userName} userInitial={userInitial} onLogout={logout} onOpenNewProject={() => setModalOpen(true)}>
      <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
        <PageHeader title="Minhas tarefas" subtitle="Acompanhe as tarefas atribuídas a você em todos os projetos." />
        <section className="surface-panel grid gap-3 p-4 md:grid-cols-4">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefa..." className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50 md:col-span-2" />
          <select value={projectId} onChange={(event) => setProjectId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Todos os projetos</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="todos">Todos os status</option><option value="pendentes">Pendentes</option><option value="concluidas">Concluídas</option></select>
          <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueFilter)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground md:col-span-2"><option value="todos">Todos os prazos</option><option value="atrasadas">Atrasadas</option><option value="proximas">Próximos 7 dias</option><option value="sem_prazo">Sem prazo</option></select>
          <button type="button" onClick={() => setModalOpen(true)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"><Plus className="size-4" /> Nova tarefa</button>
        </section>
        {loading ? <div className="surface-panel flex min-h-56 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin text-primary" />Carregando tarefas...</div> : error ? <div className="surface-panel"><EmptyState icon={<TriangleAlert className="size-6" />} title="Não foi possível carregar as tarefas" description={error} action={<button type="button" onClick={() => user && void load(user.id)} className="rounded-xl border border-border px-4 py-2 text-sm">Tentar novamente</button>} /></div> : visibleTasks.length === 0 ? <div className="surface-panel"><EmptyState icon={<ListChecks className="size-6" />} title="Nenhuma tarefa encontrada" description="As tarefas atribuídas a você aparecerão aqui." /></div> : <section className="grid gap-3">{visibleTasks.map((task) => <article key={task.id_tarefa} className="card-elevated flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><div className="flex items-center gap-2"><h2 className="truncate font-semibold text-foreground">{task.nome}</h2><span className="rounded-full bg-primary/10 px-2 py-1 text-[11px] text-primary">{task.prioridade || 'Media'}</span></div><p className="mt-1 text-sm text-muted-foreground">{task.projeto_nome} · {task.status_nome}</p><p className={`mt-1 text-xs ${task.prazo && new Date(`${task.prazo}T00:00:00`) < new Date() && !isCompleted(task) ? 'text-danger' : 'text-muted-foreground'}`}>Prazo: {formatDueDate(task.prazo)}</p></div>{isCompleted(task) ? <span className="inline-flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" />Concluída</span> : <button type="button" onClick={() => void handleComplete(task)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-success/30 px-3 py-2 text-sm text-success hover:bg-success/10"><CheckCircle2 className="size-4" />Concluir</button>}</article>)}</section>}
      </div>
      {modalOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm"><form onSubmit={handleCreate} className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><h2 className="font-display text-xl font-semibold text-foreground">Nova tarefa</h2><button type="button" onClick={() => setModalOpen(false)} className="text-muted-foreground">Fechar</button></div><div className="grid gap-3"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome da tarefa" className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /><textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Descrição (opcional)" className="min-h-24 rounded-xl border border-border bg-background p-3 text-sm text-foreground" /><select required value={newProjectId} onChange={(event) => setNewProjectId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Selecione o projeto</option>{projects.filter((project) => project.myRole !== 'viewer').map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select><select required value={newStatusId} onChange={(event) => setNewStatusId(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="">Selecione o status</option>{statuses.map((status) => <option key={status.id_status} value={status.id_status}>{status.nome}</option>)}</select><div className="grid gap-3 sm:grid-cols-2"><select value={priority} onChange={(event) => setPriority(event.target.value as TarefaPrioridade)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"><option value="Baixa">Baixa</option><option value="Media">Média</option><option value="Alta">Alta</option></select><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground" /></div></div><button disabled={saving} type="submit" className="mt-5 inline-flex h-10 w-full items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? 'Salvando...' : 'Criar tarefa'}</button></form></div>}
    </AppShell>
  );
}
