"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type AppShellProps = {
  children: ReactNode;
  userName: string;
  userInitial: string;
  onLogout: () => Promise<void> | void;
};

const navigation = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/", available: true },
  {
    label: "Projetos",
    icon: FolderKanban,
    href: "/projects",
    available: false,
  },
  {
    label: "Minhas tarefas",
    icon: ListChecks,
    href: "/tasks",
    available: false,
  },
  {
    label: "Calendário",
    icon: CalendarDays,
    href: "/calendar",
    available: false,
  },
  { label: "Chat", icon: MessageSquare, href: "/chat", available: false },
  { label: "Inteligência", icon: Sparkles, href: "/ai", available: false },
  {
    label: "Notificações",
    icon: Bell,
    href: "/notifications",
    available: false,
  },
  {
    label: "Configurações",
    icon: Settings,
    href: "/settings",
    available: false,
  },
] as const;

function UserAvatar({
  initial,
  className = "",
}: {
  initial: string;
  className?: string;
}) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary ring-1 ring-primary/25 ${className}`}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

export default function AppShell({
  children,
  userName,
  userInitial,
  onLogout,
}: AppShellProps) {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [notice, setNotice] = useState("");

  function showUnavailableFeature() {
    setNotice(
      "Esta funcionalidade será disponibilizada nas próximas etapas do Progressus.",
    );
    window.setTimeout(() => setNotice(""), 3200);
  }

  async function handleLogout() {
    setIsUserMenuOpen(false);
    await onLogout();
  }

  function SidebarContent({ mobile = false }: { mobile?: boolean }) {
    return (
      <div className="flex h-full flex-col px-3 py-4">
        <div className="flex items-center justify-between px-2">
          <Link
            href="/"
            onClick={() => setIsMobileMenuOpen(false)}
            className="flex items-center gap-3 rounded-xl"
          >
            <span className="grid size-10 place-items-center overflow-hidden rounded-xl bg-[#0e0c17]">
              <img
                src="/brand/progressus-logo.png"
                alt="Logo Progressus"
                className="size-full object-contain p-1"
              />
            </span>

            <span className="font-display text-sm font-bold tracking-tight text-foreground">
              Progressus
            </span>
          </Link>

          {mobile && (
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(false)}
              className="grid size-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-accent hover:text-foreground"
              aria-label="Fechar menu"
            >
              <X className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <nav
          className="mt-8 flex flex-col gap-0.5"
          aria-label="Navegação principal"
        >
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = item.available && pathname === item.href;

            if (!item.available) {
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={showUnavailableFeature}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                >
                  <Icon className="size-[18px] shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              );
            }

            return (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-primary/12 font-semibold text-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <Icon
                  className={`size-[18px] shrink-0 ${isActive ? "text-primary" : ""}`}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto px-1 pb-1">
          <button
            type="button"
            onClick={showUnavailableFeature}
            className="glow-accent flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
          >
            <Plus className="size-4" aria-hidden="true" />
            Novo projeto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[270px] border-r border-border bg-sidebar lg:block">
        <SidebarContent />
      </aside>

      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            aria-label="Fechar menu"
          />
          <aside className="relative h-full w-[280px] border-r border-border bg-sidebar shadow-2xl">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-col lg:pl-[270px]">
        <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-xl">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="grid size-10 shrink-0 place-items-center rounded-xl border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="size-[18px]" aria-hidden="true" />
            </button>

            <div className="relative min-w-0 flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Buscar projetos, tarefas e pessoas…"
                aria-label="Busca global"
                className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/80 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40 lg:max-w-md"
              />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={showUnavailableFeature}
                className="hidden h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-medium text-foreground transition hover:bg-accent sm:flex"
              >
                <Plus className="size-4 text-primary" aria-hidden="true" />
                Criar
              </button>

              <button
                type="button"
                onClick={showUnavailableFeature}
                className="grid size-10 place-items-center rounded-xl border border-border bg-surface text-muted-foreground transition hover:bg-accent hover:text-foreground"
                aria-label="Notificações"
              >
                <Bell className="size-[18px]" aria-hidden="true" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((current) => !current)}
                  className="flex h-10 items-center gap-2 rounded-xl border border-border bg-surface p-1.5 pr-2 text-foreground transition hover:bg-accent"
                  aria-label="Menu do usuário"
                  aria-expanded={isUserMenuOpen}
                >
                  <UserAvatar initial={userInitial} className="size-7" />
                  <ChevronDown
                    className="size-3.5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>

                {isUserMenuOpen && (
                  <div className="absolute right-0 top-12 z-40 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/30">
                    <div className="border-b border-border px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {userName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={showUnavailableFeature}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <UserRound className="size-4" aria-hidden="true" />
                      Perfil
                    </button>
                    <button
                      type="button"
                      onClick={showUnavailableFeature}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition hover:bg-accent hover:text-foreground"
                    >
                      <Settings className="size-4" aria-hidden="true" />
                      Preferências
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-danger transition hover:bg-danger/10"
                    >
                      <LogOut className="size-4" aria-hidden="true" />
                      Sair
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {notice && (
          <div className="fixed bottom-5 right-5 z-50 max-w-sm rounded-xl border border-border bg-surface px-4 py-3 text-sm text-foreground shadow-2xl shadow-black/30">
            {notice}
          </div>
        )}

        <main className="flex-1 px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
