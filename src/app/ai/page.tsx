'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, Check, Loader2, Send, Sparkles, TriangleAlert, UserRound, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import AppShell from '@/components/layout/AppShell';
import { EmptyState, PageHeader } from '@/components/ui/progressus-ui';
import { supabase } from '@/lib/supabase';

type Message = { id: string; role: 'user' | 'assistant'; text: string };
type TaskDraft = { nome: string; descricao: string; prioridade: 'Baixa' | 'Media' | 'Alta'; prazo: string | null; projectId: string; projectName: string; statusId: string; statusName: string; responsibleId: string };
const suggestions = ['Quais tarefas estão atrasadas?', 'O que vence esta semana?', 'Como está o andamento dos meus projetos?'];

export default function AiPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionMessage, setConnectionMessage] = useState('');
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [pendingTask, setPendingTask] = useState<TaskDraft | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace('/auth/login');
      else setUser(data.session.user);
      setLoading(false);
    });
  }, [router]);

  const userName = useMemo(() => String(user?.user_metadata?.nome || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuário'), [user]);
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  async function ask(question: string) {
    const text = question.trim();
    if (!text || sending) return;
    const userMessage: Message = { id: `${Date.now()}-user`, role: 'user', text };
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setSending(true);
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const wantsTask = /\b(crie|criar|adicione|adicionar|cadastre)\b[\s\S]*\b(tarefa|atividade)\b/i.test(text);
      if (wantsTask) {
        const response = await fetch('/api/ai/task-command', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` }, body: JSON.stringify({ message: text }) });
        const result = (await response.json()) as { draft?: TaskDraft; error?: string };
        if (!response.ok || !result.draft) throw new Error(result.error || 'Não foi possível preparar a tarefa.');
        setPendingTask(result.draft);
        setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: 'assistant', text: 'Preparei esta tarefa com base no seu pedido. Revise os dados e confirme para criar.' }]);
        return;
      }
      const response = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` }, body: JSON.stringify({ message: text }) });
      const result = (await response.json()) as { answer?: string; error?: string; detail?: string };
      if (!response.ok) throw new Error(result.detail ? `${result.error || 'Falha na IA'} (${result.detail})` : result.error || 'Não foi possível consultar a IA.');
      setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: 'assistant', text: result.answer || 'Não encontrei essa informação.' }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar a IA.');
    } finally { setSending(false); }
  }

  async function confirmTask() {
    if (!pendingTask || sending) return;
    setSending(true); setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch('/api/ai/task-confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` }, body: JSON.stringify({ ...pendingTask, confirmed: true }) });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível criar a tarefa.');
      setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: 'assistant', text: 'Tarefa criada com sucesso e vinculada ao projeto.' }]);
      setPendingTask(null); window.dispatchEvent(new Event('progressus:tasks-changed'));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível criar a tarefa.'); }
    finally { setSending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(input); }

  async function testConnection() {
    setTestingConnection(true);
    setConnectionMessage('');
    try {
      const response = await fetch('/api/ai/test', { method: 'POST' });
      const result = (await response.json()) as { response?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'A conexão falhou.');
      setConnectionMessage(result.response || 'Conexão com a IA funcionando.');
    } catch (reason) {
      setConnectionMessage(reason instanceof Error ? reason.message : 'A conexão falhou.');
    } finally { setTestingConnection(false); }
  }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth/login'); }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></main>;

  return <AppShell userName={userName} userInitial={userInitial} onLogout={logout} createLabel="Nova tarefa"><div className="mx-auto flex max-w-4xl flex-col gap-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><PageHeader title="IA" subtitle="Consulte o andamento dos projetos e tarefas que você pode acessar." /><div className="flex flex-col items-start gap-1 sm:items-end"><button type="button" onClick={() => void testConnection()} disabled={testingConnection} className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-60"><Loader2 className={`size-3.5 ${testingConnection ? 'animate-spin' : 'hidden'}`} />Testar conexão</button>{connectionMessage && <span className="max-w-xs text-right text-[11px] text-muted-foreground">{connectionMessage}</span>}</div></div><section className="surface-panel overflow-hidden"><div className="border-b border-border bg-primary/5 p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary"><Sparkles className="size-5" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Assistente Progressus</h2><p className="mt-1 text-sm text-muted-foreground">Consulto os dados permitidos e peço confirmação antes de criar uma tarefa.</p></div></div></div><div className="min-h-[360px] space-y-4 p-5">{messages.length === 0 ? <div className="flex min-h-[280px] flex-col items-center justify-center text-center"><Bot className="size-10 text-primary/70" /><h3 className="mt-4 font-semibold text-foreground">Como posso ajudar?</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">Pergunte sobre seus projetos ou diga: “crie uma tarefa no projeto TCC para revisar a introdução”.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">{suggestion}</button>)}</div></div> : messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><span className={`grid size-8 shrink-0 place-items-center rounded-full ${message.role === 'user' ? 'order-2 bg-primary/15 text-primary' : 'bg-muted text-primary'}`}>{message.role === 'user' ? <UserRound className="size-4" /> : <Bot className="size-4" />}</span><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground'}`}>{message.text}</div></div>)}{pendingTask && <div className="rounded-2xl border border-primary/25 bg-primary/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold text-foreground">Prévia da tarefa</p><p className="mt-1 text-xs text-muted-foreground">{pendingTask.projectName} · {pendingTask.statusName}</p></div><button type="button" onClick={() => setPendingTask(null)} className="text-muted-foreground hover:text-foreground" aria-label="Cancelar prévia"><X className="size-4" /></button></div><p className="mt-3 text-sm font-medium text-foreground">{pendingTask.nome}</p>{pendingTask.descricao && <p className="mt-1 text-xs text-muted-foreground">{pendingTask.descricao}</p>}<div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span className="rounded-full bg-muted px-2 py-1">Prioridade: {pendingTask.prioridade}</span><span className="rounded-full bg-muted px-2 py-1">Prazo: {pendingTask.prazo || 'Sem prazo'}</span></div><button type="button" onClick={() => void confirmTask()} disabled={sending} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Check className="size-4" />Confirmar e criar tarefa</button></div>}{sending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="size-4 text-primary" />A IA está analisando seus dados...<Loader2 className="size-4 animate-spin" /></div>}{error && <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"><TriangleAlert className="size-4" />{error}</div>}</div><form onSubmit={submit} className="flex gap-2 border-t border-border p-4"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pergunte ou peça para criar uma tarefa..." maxLength={2000} disabled={sending} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" /><button type="submit" disabled={sending || !input.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="size-4" />Enviar</button></form></section></div></AppShell>;
}
