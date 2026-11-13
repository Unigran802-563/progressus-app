'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, CheckCheck, Clock3, ExternalLink, Loader2, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import AppShell from '@/components/layout/AppShell';
import { EmptyState, PageHeader } from '@/components/ui/progressus-ui';
import { listarMinhasTarefas, type MinhaTarefa } from '@/lib/tasks';
import { supabase } from '@/lib/supabase';

type Notification = { id: string; title: string; description: string; href: string; kind: 'overdue' | 'dueSoon' | 'chat'; createdAt: string };
type Preferences = { overdue: boolean; dueSoon: boolean };

function dateLabel(date: string | null) { return date ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${date}T00:00:00`)) : 'sem prazo'; }
function buildNotifications(tasks: MinhaTarefa[], preferences: Preferences): Notification[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const soon = new Date(today); soon.setDate(soon.getDate() + 1);
  return tasks.flatMap<Notification>((task) => {
    if (!task.prazo || task.status_nome.toLocaleLowerCase('pt-BR').includes('concl')) return [];
    const due = new Date(`${task.prazo}T00:00:00`);
    if (due < today && preferences.overdue) return [{ id: `overdue-${task.id_tarefa}`, title: 'Tarefa atrasada', description: `${task.nome} venceu em ${dateLabel(task.prazo)}.`, href: `/projects/${task.id_projeto}`, kind: 'overdue', createdAt: task.prazo }];
    if (due >= today && due <= soon && preferences.dueSoon) return [{ id: `soon-${task.id_tarefa}`, title: 'Prazo próximo', description: `${task.nome} vence em ${dateLabel(task.prazo)}.`, href: `/projects/${task.id_projeto}`, kind: 'dueSoon', createdAt: task.prazo }];
    return [];
  });
}

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [tasks, setTasks] = useState<MinhaTarefa[]>([]);
  const [chatNotifications, setChatNotifications] = useState<Notification[]>([]);
  const [read, setRead] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<Preferences>({ overdue: true, dueSoon: true });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { void supabase.auth.getSession().then(async ({ data }) => { if (!data.session) { router.replace('/auth/login'); return; } const current = data.session.user; setUser(current); try { const saved = localStorage.getItem(`progressus:read-notifications:${current.id}`); if (saved) setRead(JSON.parse(saved)); const chatSaved = localStorage.getItem(`progressus:chat-notifications:${current.id}`); if (chatSaved) setChatNotifications(JSON.parse(chatSaved)); const prefs = localStorage.getItem(`progressus:preferences:${current.id}`); if (prefs) { const parsed = JSON.parse(prefs); setPreferences({ overdue: parsed.overdue !== false, dueSoon: parsed.dueSoon !== false }); } setTasks(await listarMinhasTarefas(current.id)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível carregar as notificações.'); } finally { setLoading(false); } }); }, [router]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    function refreshChatNotifications() {
      try {
        const saved = localStorage.getItem(`progressus:chat-notifications:${user!.id}`);
        setChatNotifications(saved ? JSON.parse(saved) : []);
      } catch { /* Ignorar cache inválido sem bloquear a navegação. */ }
    }
    function refreshAccess() {
      refreshChatNotifications();
      void listarMinhasTarefas(user!.id).then((items) => {
        if (active) setTasks(items);
      }).catch(() => { /* RLS continua protegendo os dados durante uma falha de rede. */ });
    }
    window.addEventListener('progressus:project-access-checked', refreshAccess);
    window.addEventListener('progressus:tasks-changed', refreshAccess);
    window.addEventListener('progressus:notifications-changed', refreshChatNotifications);
    return () => {
      active = false;
      window.removeEventListener('progressus:project-access-checked', refreshAccess);
      window.removeEventListener('progressus:tasks-changed', refreshAccess);
      window.removeEventListener('progressus:notifications-changed', refreshChatNotifications);
    };
  }, [user]);

  const notifications = useMemo(() => [...chatNotifications, ...buildNotifications(tasks, preferences)].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [chatNotifications, preferences, tasks]);
  const unread = notifications.filter((item) => !read.includes(item.id)).length;
  useEffect(() => {
    window.localStorage.setItem('progressus:unread-notifications', String(unread));
    window.dispatchEvent(new Event('progressus:notifications-changed'));
  }, [unread]);
  const userName = String(user?.user_metadata?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário');
  const userInitial = userName.charAt(0).toUpperCase() || 'U';
  function persist(next: string[]) { setRead(next); if (user) localStorage.setItem(`progressus:read-notifications:${user.id}`, JSON.stringify(next)); }
  function markAll() { persist(notifications.map((item) => item.id)); }
  async function logout() { await supabase.auth.signOut(); router.replace('/auth/login'); }

  return <AppShell userName={userName} userInitial={userInitial} onLogout={logout}><div className="mx-auto flex max-w-4xl flex-col gap-6"><div className="flex items-end justify-between gap-3"><PageHeader title="Notificações" subtitle={`${unread} não lidas`} />{notifications.length > 0 && <button type="button" onClick={markAll} className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm text-foreground hover:bg-muted"><CheckCheck className="size-4" />Marcar todas como lidas</button>}</div>{loading ? <div className="surface-panel flex min-h-52 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin text-primary" />Carregando notificações...</div> : error ? <div className="surface-panel"><EmptyState icon={<TriangleAlert className="size-6" />} title="Não foi possível carregar" description={error} /></div> : notifications.length === 0 ? <div className="surface-panel"><EmptyState icon={<Bell className="size-6" />} title="Tudo em dia" description="Não há notificações de prazos ou mensagens." /></div> : <section className="surface-panel divide-y divide-border">{notifications.map((item) => { const isRead = read.includes(item.id); const isChat = item.kind === 'chat'; return <button key={item.id} type="button" onClick={() => { if (!isRead) persist([...read, item.id]); router.push(item.href); }} className={`flex w-full items-start gap-3 p-4 text-left transition hover:bg-muted/40 ${!isRead ? 'bg-primary/5' : ''}`}><span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${isChat ? 'bg-primary/15 text-primary' : item.kind === 'overdue' ? 'bg-danger/15 text-danger' : 'bg-warning/15 text-warning'}`}>{isChat ? <Bell className="size-4" /> : item.kind === 'overdue' ? <TriangleAlert className="size-4" /> : <Clock3 className="size-4" />}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2 text-sm font-semibold text-foreground">{item.title}{!isRead && <span className="size-1.5 rounded-full bg-primary" />}</span><span className="mt-1 block text-sm text-muted-foreground">{item.description}</span></span><ExternalLink className="mt-1 size-4 shrink-0 text-muted-foreground" /></button>; })}</section>}</div></AppShell>;
}
