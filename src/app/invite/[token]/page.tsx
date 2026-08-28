'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowRight,
  CheckCircle2,
  Link2,
  Loader2,
  LogIn,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

import { acceptProjectInvite } from '@/lib/projects';
import { supabase } from '@/lib/supabase';

type InviteState = 'checking' | 'ready' | 'needs-login' | 'accepting' | 'error';

export default function InvitePage() {
  const params = useParams<{ token: string | string[] }>();
  const router = useRouter();
  const token = typeof params.token === 'string' ? params.token : '';

  const [state, setState] = useState<InviteState>('checking');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      if (!token) {
        if (isMounted) {
          setErrorMessage('O link de convite é inválido.');
          setState('error');
        }
        return;
      }

      const { data, error } = await supabase.auth.getSession();

      if (!isMounted) return;

      if (error || !data.session) {
        setState('needs-login');
        return;
      }

      setState('ready');
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleAcceptInvite() {
    try {
      setState('accepting');
      setErrorMessage('');

      const projectId = await acceptProjectInvite(token);
      router.replace(`/projects/${projectId}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Não foi possível aceitar este convite.',
      );
      setState('error');
    }
  }

  const loginHref = `/auth/login?next=${encodeURIComponent(`/invite/${token}`)}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <section className="w-full max-w-[30rem] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl shadow-black/40">
        <div className="border-b border-border px-6 py-5 text-center sm:px-8">
          <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Link2 className="size-6" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-display text-2xl font-bold text-foreground">
            Convite para projeto
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Você recebeu um convite para participar de um projeto no Progressus.
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          {state === 'checking' && (
            <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              Verificando convite...
            </div>
          )}

          {state === 'needs-login' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm leading-6 text-muted-foreground">
                Para proteger o projeto, entre na sua conta antes de aceitar o convite.
              </div>

              <Link
                href={loginHref}
                className="glow-accent inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <LogIn className="size-4" aria-hidden="true" />
                Entrar para aceitar
              </Link>

              <p className="text-center text-xs leading-5 text-muted-foreground">
                Ainda não possui uma conta? Crie-a e volte a abrir este mesmo link de convite.
              </p>
            </div>
          )}

          {state === 'ready' && (
            <div className="space-y-5">
              <div className="rounded-xl border border-success/25 bg-success/10 px-4 py-3 text-sm leading-6 text-muted-foreground">
                <div className="flex gap-2.5">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                  <p>
                    Você está autenticado. Ao aceitar, será adicionado ao projeto com a permissão definida pelo proprietário.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void handleAcceptInvite()}
                className="glow-accent inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground"
              >
                <CheckCircle2 className="size-4" aria-hidden="true" />
                Aceitar convite
              </button>
            </div>
          )}

          {state === 'accepting' && (
            <div className="flex flex-col items-center gap-3 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
              Adicionando você ao projeto...
            </div>
          )}

          {state === 'error' && (
            <div className="space-y-5">
              <div
                className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm leading-6 text-danger"
                role="alert"
              >
                <div className="flex gap-2.5">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <p>{errorMessage}</p>
                </div>
              </div>

              <Link
                href="/projects"
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Ir para meus projetos
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
