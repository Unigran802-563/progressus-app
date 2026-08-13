'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';

import { supabase } from '@/lib/supabase';

function isValidPassword(password: string): boolean {
  return /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isValidLink, setIsValidLink] = useState<boolean | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    async function checkRecoverySession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      setIsValidLink(Boolean(session));
    }

    checkRecoverySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsValidLink(Boolean(session));
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedbackMessage('');
    setIsSuccess(false);

    if (password !== confirmPassword) {
      setFeedbackMessage('As senhas não coincidem.');
      return;
    }

    if (!isValidPassword(password)) {
      setFeedbackMessage(
        'A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.'
      );
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      const isSamePassword =
        error.code === 'same_password' ||
        error.message.toLowerCase().includes('same as the old password') ||
        error.message.toLowerCase().includes('different from the old password');

      setFeedbackMessage(
        isSamePassword
          ? 'A nova senha não pode ser igual à senha anterior. Escolha uma senha diferente.'
          : 'Não foi possível atualizar a senha. Solicite um novo link e tente novamente.'
      );
      setIsSubmitting(false);
      return;
    }

    setIsSuccess(true);
    setFeedbackMessage('Senha atualizada com sucesso. Redirecionando para o Progressus...');

    window.setTimeout(() => {
      router.replace('/');
    }, 1500);
  }

  if (isValidLink === null) {
    return (
      <section className="card-elevated p-6 text-center sm:p-8">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <p className="mt-4 text-sm text-muted-foreground">Validando link de recuperação...</p>
      </section>
    );
  }

  if (!isValidLink) {
    return (
      <section className="card-elevated p-6 text-center sm:p-8">
        <span className="mx-auto grid size-11 place-items-center rounded-xl bg-danger/15 text-danger ring-1 ring-danger/25">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-foreground">
          Link inválido ou expirado
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Solicite um novo link de recuperação para continuar com segurança.
        </p>
        <Link
          href="/auth/forgot-password"
          className="glow-accent mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px"
        >
          Solicitar novo link
        </Link>
      </section>
    );
  }

  return (
    <section className="card-elevated p-6 sm:p-8">
      <header className="mb-7">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-5 font-display text-2xl font-bold text-foreground sm:text-3xl">
          Criar nova senha
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Escolha uma senha segura para recuperar o acesso à sua conta.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-semibold text-foreground">
            Nova senha
          </label>
          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-11 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-xl text-muted-foreground transition hover:text-foreground"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">
            Mínimo de 8 caracteres, uma letra maiúscula, um número e um caractere especial.
          </p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="confirmPassword" className="block text-xs font-semibold text-foreground">
            Confirmar nova senha
          </label>
          <div className="relative">
            <Check
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-11 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-xl text-muted-foreground transition hover:text-foreground"
              aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
            >
              {showConfirmPassword ? (
                <EyeOff className="size-4" aria-hidden="true" />
              ) : (
                <Eye className="size-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {feedbackMessage && (
          <div
            role="status"
            className={`rounded-xl border px-3.5 py-3 text-sm leading-5 ${
              isSuccess
                ? 'border-success/35 bg-success/10 text-success'
                : 'border-danger/35 bg-danger/10 text-danger'
            }`}
          >
            {feedbackMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="glow-accent flex h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Atualizando senha...' : 'Redefinir senha'}
        </button>
      </form>
    </section>
  );
}
