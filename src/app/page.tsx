'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  MessageCircle,
  Plus,
  Search,
  Settings,
  UserRound,
  UsersRound,
} from 'lucide-react';

import { supabase } from '@/lib/supabase';

type MenuItem = {
  label: string;
  icon: LucideIcon;
  active?: boolean;
};

const menuItems: MenuItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, active: true },
  { label: 'Relatórios', icon: BarChart3 },
  { label: 'Chat', icon: MessageCircle },
  { label: 'Notificações', icon: Bell },
  { label: 'Calendário', icon: CalendarDays },
  { label: 'Equipe', icon: UsersRound },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace('/auth/login');
        return;
      }

      setUser(data.session.user);
      setIsLoading(false);
    }

    checkSession();
  }, [router]);

  const userName = useMemo(() => {
    const metadataName = user?.user_metadata?.nome || user?.user_metadata?.name;

    if (metadataName) {
      return String(metadataName);
    }

    if (user?.email) {
      return user.email.split('@')[0];
    }

    return 'Usuário';
  }, [user]);

  const userInitial = userName.charAt(0).toUpperCase();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace('/auth/login');
  }

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl bg-white px-6 py-5 text-sm font-medium text-slate-600 shadow-xl shadow-slate-200/80">
          Carregando ambiente Progressus...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white text-slate-950">
      <div className="flex min-h-screen">
        <aside className="flex w-[280px] shrink-0 flex-col bg-[#1b0f3a] text-purple-100 shadow-2xl shadow-purple-950/20">
          <div className="flex h-[76px] items-center gap-3 border-b border-white/5 px-5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400 text-[#1b0f3a] shadow-lg shadow-amber-500/20">
              <FolderKanban className="h-5 w-5" aria-hidden="true" />
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-white">Progressus</h1>
              <p className="mt-0.5 text-xs text-purple-200/60">Workspace</p>
            </div>
          </div>

          <div className="px-4 py-4">
            <label htmlFor="sidebar-search" className="sr-only">
              Buscar no menu
            </label>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-purple-200/45" aria-hidden="true" />

              <input
                id="sidebar-search"
                type="search"
                placeholder="Buscar..."
                className="h-10 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-4 text-sm text-white outline-none transition placeholder:text-purple-200/40 focus:border-purple-300/30 focus:bg-white/10"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-3 pb-4">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${
                      item.active
                        ? 'bg-purple-500/25 text-white shadow-lg shadow-purple-950/10'
                        : 'text-purple-200/65 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-8">
              <button
                type="button"
                className="mb-3 flex w-full items-center justify-between px-3 text-left text-xs font-semibold uppercase tracking-[0.16em] text-purple-200/60"
              >
                <span>Projetos</span>
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="space-y-3">
                <p className="px-3 text-sm leading-relaxed text-purple-200/50">
                  Nenhum projeto cadastrado ainda.
                </p>

                <button
                  type="button"
                  className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-purple-200/70 transition hover:bg-white/5 hover:text-white"
                >
                  <Plus className="h-5 w-5" aria-hidden="true" />
                  <span>Novo Projeto</span>
                </button>
              </div>
            </div>
          </nav>

          <div className="border-t border-white/5 px-3 py-4">
            <button
              type="button"
              onClick={handleLogout}
              className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-purple-200/65 transition hover:bg-white/5 hover:text-white"
            >
              <LogOut className="h-5 w-5" aria-hidden="true" />
              <span>Sair</span>
            </button>

            <button
              type="button"
              className="mt-1 flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-purple-200/65 transition hover:bg-white/5 hover:text-white"
            >
              <Settings className="h-5 w-5" aria-hidden="true" />
              <span>Configurações</span>
            </button>
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-white">
          <header className="flex h-[72px] items-center justify-end gap-4 border-b border-slate-100 px-8">
            <label htmlFor="task-search" className="sr-only">
              Buscar tarefas
            </label>

            <div className="relative hidden w-full max-w-[300px] md:block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />

              <input
                id="task-search"
                type="search"
                placeholder="Buscar tarefas..."
                className="h-11 w-full rounded-xl border border-slate-100 bg-slate-100/80 pl-11 pr-4 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-purple-200 focus:bg-white focus:ring-4 focus:ring-purple-900/5"
              />
            </div>

            <button
              type="button"
              className="flex h-11 items-center gap-2 rounded-xl bg-[#3b1d7a] px-5 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 transition hover:bg-[#2d145f]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span>Nova Tarefa</span>
            </button>

            <button
              type="button"
              className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Notificações"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              <span className="absolute right-3 top-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
            </button>

            <button
              type="button"
              className="flex h-11 items-center gap-2 rounded-xl px-1.5 text-slate-600 transition hover:bg-slate-100"
              aria-label="Menu do usuário"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-[#3b1d7a]">
                {userInitial || <UserRound className="h-5 w-5" aria-hidden="true" />}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </button>
          </header>

          
        </section>
      </div>
    </main>
  );
}
