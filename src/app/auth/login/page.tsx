'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Lock, LogIn, Mail } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import type { LoginFormData } from '@/types';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    email: '',
    password: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setFormData((currentData) => ({
      ...currentData,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setFeedbackMessage('');
    setIsSuccess(false);

    const response = await login(formData);

    setFeedbackMessage(response.message);
    setIsSuccess(response.success);
    setIsSubmitting(false);

    if (response.success) {
      router.push('/');
    }
  }

  return (
    <section className="card-elevated p-6 sm:p-8">
      <header className="mb-7">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <LogIn className="size-5" aria-hidden="true" />
        </span>

        <h1 className="mt-5 font-display text-2xl font-bold text-foreground sm:text-3xl">
          Boas-vindas de volta
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Acesse sua conta para continuar acompanhando seu progresso.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-semibold text-foreground">
            E-mail
          </label>

          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
              required
              className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="password" className="block text-xs font-semibold text-foreground">
              Senha
            </label>
            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-primary transition-opacity hover:opacity-80"
            >
              Esqueci minha senha
            </Link>
          </div>

          <div className="relative">
            <Lock
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              placeholder="Digite sua senha"
              autoComplete="current-password"
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
          className="glow-accent flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Entrando...' : 'Entrar no Progressus'}
          {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
        </button>
      </form>

      <div className="my-7 h-px bg-border" />

      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem uma conta?{' '}
        <Link href="/auth/register" className="font-semibold text-primary transition-opacity hover:opacity-80">
          Criar conta
        </Link>
      </p>

      <p className="mt-4 text-center text-[11px] text-muted-foreground/70">
        Acesso seguro ao ambiente Progressus
      </p>
    </section>
  );
}
