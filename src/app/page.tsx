"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

type MenuItem = {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
};

const menuItems: MenuItem[] = [
  { label: "Dashboard", icon: <DashboardIcon />, active: true },
  { label: "Relatórios", icon: <ReportsIcon /> },
  { label: "Chat", icon: <ChatIcon /> },
  { label: "Notificações", icon: <BellIcon /> },
  { label: "Calendário", icon: <CalendarIcon /> },
  { label: "Equipe", icon: <TeamIcon /> },
];

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function checkSession() {
      const { data, error } = await supabase.auth.getSession();

      if (error || !data.session) {
        router.replace("/auth/login");
        return;
      }

      setUser(data.session.user);
      setIsLoading(false);
    }

    checkSession();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.replace("/auth/login");
  }

  const userInitial = user?.email?.charAt(0).toUpperCase() ?? "A";

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-700" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen bg-white text-slate-900">
      <aside className="flex w-64 shrink-0 flex-col bg-[#1f1238] text-white shadow-2xl">
        <div className="flex h-16 items-center gap-3 border-b border-white/5 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-yellow-400 text-[#1f1238] shadow-lg shadow-yellow-500/20">
            <WorkspaceIcon />
          </div>

          <div>
            <h1 className="text-sm font-semibold leading-tight">
              Minha Empresa
            </h1>
            <p className="text-xs text-purple-200/70">Workspace</p>
          </div>
        </div>

        <div className="px-3 py-4">
          <label className="relative block">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-purple-200/60">
              <SearchIcon />
            </span>
            <input
              type="text"
              placeholder="Buscar..."
              className="h-10 w-full rounded-xl border border-white/5 bg-white/5 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-purple-200/50 focus:border-purple-300/40 focus:bg-white/10"
            />
          </label>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-3">
          {menuItems.map((item) => (
            <button
              key={item.label}
              type="button"
              className={`flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm transition ${
                item.active
                  ? "bg-white/10 text-white"
                  : "text-purple-200/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="h-5 w-5">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          <div className="pt-8">
            <div className="mb-3 flex items-center justify-between px-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-200/70">
                Projetos
              </p>
              <ChevronDownIcon />
            </div>

            <div className="space-y-3">
              <p className="px-3 text-sm leading-relaxed text-purple-200/50">
                Nenhum projeto cadastrado ainda.
              </p>

              <button
                type="button"
                className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-purple-200/70 transition hover:bg-white/5 hover:text-white"
              >
                <PlusIcon />
                <span>Novo Projeto</span>
              </button>
            </div>
          </div>
        </nav>

        <div className="space-y-1 border-t border-white/5 px-3 py-4">
          <button
            type="button"
            onClick={handleLogout}
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-purple-200/70 transition hover:bg-white/5 hover:text-white"
          >
            <LogoutIcon />
            <span>Tela de Login</span>
          </button>

          <button
            type="button"
            className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-purple-200/70 transition hover:bg-white/5 hover:text-white"
          >
            <SettingsIcon />
            <span>Configurações</span>
          </button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col bg-white">
        <header className="flex h-16 items-center justify-end border-b border-slate-100 bg-white px-6">
          <div className="flex items-center gap-4">
            <label className="relative hidden sm:block">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                type="text"
                placeholder="Buscar tarefas..."
                className="h-10 w-64 rounded-xl border border-slate-100 bg-slate-100 pl-10 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-purple-200 focus:bg-white focus:ring-4 focus:ring-purple-100"
              />
            </label>

            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-xl bg-[#3b1b72] px-4 text-sm font-medium text-white shadow-lg shadow-purple-900/20 transition hover:bg-[#4c2491]"
            >
              <PlusIcon />
              <span>Nova Tarefa</span>
            </button>

            <button
              type="button"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Notificações"
            >
              <BellIcon />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
            </button>

            <button
              type="button"
              className="flex h-10 items-center gap-2 rounded-xl px-2 transition hover:bg-slate-100"
              aria-label="Menu do usuário"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-purple-100 text-sm font-semibold text-purple-800">
                {userInitial}
              </span>
              <ChevronDownIcon className="text-slate-400" />
            </button>
          </div>
        </header>

        <div className="flex-1 bg-white" />
      </section>
    </main>
  );
}

function WorkspaceIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5 8.5h14v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 8.5V6.8A1.8 1.8 0 0 1 9.8 5h4.4A1.8 1.8 0 0 1 16 6.8v1.7"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h6v6h-6v-6Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}

function ReportsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5 19V9m7 10V5m7 14v-7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M4 19h16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5 18.5v-9A4.5 4.5 0 0 1 9.5 5h5A4.5 4.5 0 0 1 19 9.5v2A4.5 4.5 0 0 1 14.5 16H9l-4 2.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M18 10a6 6 0 1 0-12 0c0 7-2 7-2 8h16c0-1-2-1-2-8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M10 20a2 2 0 0 0 4 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M7 4v3m10-3v3M5 9h14M6.5 6h11A1.5 1.5 0 0 1 19 7.5v10A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5v-10A1.5 1.5 0 0 1 6.5 6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function TeamIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M8.5 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3.5 19a5 5 0 0 1 10 0m1.5-.5a4 4 0 0 1 5.5 0"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="m20 20-4.2-4.2M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 5v14m7-7H5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-4 w-4 ${className}`}
      aria-hidden="true"
    >
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M10 6H6.5A1.5 1.5 0 0 0 5 7.5v9A1.5 1.5 0 0 0 6.5 18H10m5-4 3-3m0 0-3-3m3 3H9"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M19 12a7.2 7.2 0 0 0-.1-1.2l2-1.5-2-3.4-2.4 1a7.4 7.4 0 0 0-2.1-1.2L14 3h-4l-.4 2.7a7.4 7.4 0 0 0-2.1 1.2l-2.4-1-2 3.4 2 1.5A7.2 7.2 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-1a7.4 7.4 0 0 0 2.1 1.2L10 21h4l.4-2.7a7.4 7.4 0 0 0 2.1-1.2l2.4 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
