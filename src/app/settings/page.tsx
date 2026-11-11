'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Save, TriangleAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';

import AppShell from '@/components/layout/AppShell';
import { PageHeader } from '@/components/ui/progressus-ui';
import { supabase } from '@/lib/supabase';

const preferenceOptions = [['messages', 'Novas mensagens'], ['assignments', 'Atribuição de tarefas'], ['dueSoon', 'Tarefas próximas do vencimento'], ['overdue', 'Tarefas atrasadas'], ['statusChanges', 'Mudanças de status']] as const;
type Preferences = Record<(typeof preferenceOptions)[number][0], boolean>;
const defaultPreferences: Preferences = { messages: true, assignments: true, dueSoon: true, overdue: true, statusChanges: true };

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace('/auth/login'); return; }
      const current = data.session.user;
      setUser(current);
      setName(String(current.user_metadata?.nome || current.user_metadata?.name || ''));
      setAvatar(String(current.user_metadata?.avatar_url || ''));
      try { const saved = localStorage.getItem(`progressus:preferences:${current.id}`); if (saved) setPreferences({ ...defaultPreferences, ...JSON.parse(saved) }); } catch { /* usa padrões */ }
      setLoading(false);
    });
  }, [router]);

  const userName = useMemo(() => name || user?.email?.split('@')[0] || 'Usuário', [name, user]);
  const userInitial = userName.charAt(0).toUpperCase() || 'U';

  async function save() {
    if (!user) return;
    setSaving(true); setFeedback(''); setError('');
    try {
      const { error: updateError } = await supabase.auth.updateUser({ data: { nome: name.trim(), avatar_url: avatar.trim() || null } });
      if (updateError) throw updateError;
      localStorage.setItem(`progressus:preferences:${user.id}`, JSON.stringify(preferences));
      setFeedback('Configurações salvas com sucesso.');
      window.setTimeout(() => setFeedback(''), 3000);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível salvar as configurações.'); } finally { setSaving(false); }
  }
  async function logout() { await supabase.auth.signOut(); router.replace('/auth/login'); }
  if (loading) return <main className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="size-6 animate-spin text-primary" /></main>;

  return <AppShell userName={userName} userInitial={userInitial} onLogout={logout}><div className="mx-auto flex max-w-3xl flex-col gap-6"><PageHeader title="Configurações" subtitle="Atualize seu perfil e escolha quais notificações deseja receber." /><section className="surface-panel p-5 sm:p-6"><h2 className="font-display text-lg font-semibold text-foreground">Perfil</h2><p className="mt-1 text-sm text-muted-foreground">Esses dados são usados no seu perfil do Progressus.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><label className="text-sm font-medium text-foreground" htmlFor="settings-name">Nome</label><input id="settings-name" value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" /></div><div className="space-y-2"><label className="text-sm font-medium text-foreground">E-mail</label><input value={user?.email ?? ''} disabled className="h-11 w-full rounded-xl border border-border bg-muted/40 px-3 text-sm text-muted-foreground" /></div><div className="space-y-2"><label className="text-sm font-medium text-foreground" htmlFor="settings-avatar">URL do avatar (opcional)</label><input id="settings-avatar" value={avatar} onChange={(event) => setAvatar(event.target.value)} placeholder="https://..." className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary/50" /></div></div></section><section className="surface-panel p-5 sm:p-6"><h2 className="font-display text-lg font-semibold text-foreground">Notificações</h2><p className="mt-1 text-sm text-muted-foreground">Escolha quais eventos devem aparecer no centro de notificações.</p><div className="mt-5 divide-y divide-border">{preferenceOptions.map(([key, label]) => <label key={key} className="flex items-center justify-between gap-4 py-3 text-sm text-foreground"><span>{label}</span><input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences((current) => ({ ...current, [key]: event.target.checked }))} className="size-4 accent-primary" /></label>)}</div></section>{error && <p className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3 py-2.5 text-sm text-danger"><TriangleAlert className="size-4" />{error}</p>}{feedback && <p className="flex items-center gap-2 rounded-xl border border-success/30 bg-success/10 px-3 py-2.5 text-sm text-success"><Check className="size-4" />{feedback}</p>}<button type="button" onClick={() => void save()} disabled={saving} className="inline-flex h-11 w-fit items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-60"><Save className="size-4" />{saving ? 'Salvando...' : 'Salvar configurações'}</button></div></AppShell>;
}
