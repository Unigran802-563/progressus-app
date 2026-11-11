'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, TriangleAlert, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import AppShell from '@/components/layout/AppShell';
import { EmptyState, PageHeader } from '@/components/ui/progressus-ui';
import { supabase } from '@/lib/supabase';

type Message = { id: string; role: 'user' | 'assistant'; text: string };
const suggestions = ['Quais tarefas estão atrasadas?', 'O que vence esta semana?', 'Como está o andamento dos meus projetos?'];

export default function AiPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

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
      const response = await fetch('/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session?.access_token ?? ''}` }, body: JSON.stringify({ message: text }) });
      const result = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok) throw new Error(result.error || 'Não foi possível consultar a IA.');
      setMessages((current) => [...current, { id: `${Date.now()}-assistant`, role: 'assistant', text: result.answer || 'Não encontrei essa informação.' }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível consultar a IA.');
    } finally { setSending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); void ask(input); }

  async function logout() { await supabase.auth.signOut(); router.replace('/auth/login'); }

  if (loading) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></main>;

  return <AppShell userName={userName} userInitial={userInitial} onLogout={logout} createLabel="Nova tarefa"><div className="mx-auto flex max-w-4xl flex-col gap-6"><PageHeader title="IA" subtitle="Consulte o andamento dos projetos e tarefas que você pode acessar." /><section className="surface-panel overflow-hidden"><div className="border-b border-border bg-primary/5 p-5"><div className="flex items-start gap-3"><span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary"><Sparkles className="size-5" /></span><div><h2 className="font-display text-lg font-semibold text-foreground">Assistente Progressus</h2><p className="mt-1 text-sm text-muted-foreground">Respondo com base nos dados reais dos seus projetos. Não crio ou altero informações.</p></div></div></div><div className="min-h-[360px] space-y-4 p-5">{messages.length === 0 ? <div className="flex min-h-[280px] flex-col items-center justify-center text-center"><Bot className="size-10 text-primary/70" /><h3 className="mt-4 font-semibold text-foreground">Como posso ajudar?</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">Escolha uma pergunta rápida ou pergunte sobre seus projetos, tarefas e prazos.</p><div className="mt-5 flex flex-wrap justify-center gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted-foreground transition hover:border-primary/40 hover:text-primary">{suggestion}</button>)}</div></div> : messages.map((message) => <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}><span className={`grid size-8 shrink-0 place-items-center rounded-full ${message.role === 'user' ? 'order-2 bg-primary/15 text-primary' : 'bg-muted text-primary'}`}>{message.role === 'user' ? <UserRound className="size-4" /> : <Bot className="size-4" />}</span><div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted/60 text-foreground'}`}>{message.text}</div></div>)}{sending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="size-4 text-primary" />A IA está analisando seus dados...<Loader2 className="size-4 animate-spin" /></div>}{error && <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"><TriangleAlert className="size-4" />{error}</div>}</div><form onSubmit={submit} className="flex gap-2 border-t border-border p-4"><input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Pergunte sobre seus projetos..." maxLength={2000} disabled={sending} className="h-11 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" /><button type="submit" disabled={sending || !input.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-50"><Send className="size-4" />Enviar</button></form></section></div></AppShell>;
}
