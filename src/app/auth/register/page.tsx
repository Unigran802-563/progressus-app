'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useState } from 'react';
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';
import type { RegisterFormData } from '@/types';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [formData, setFormData] = useState<RegisterFormData>({
    name: '',
    email: '',
    password: '',
  });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

    if (formData.password !== confirmPassword) {
      setFeedbackMessage('As senhas não coincidem. Verifique os campos e tente novamente.');
      setIsSubmitting(false);
      return;
    }

    const response = await register(formData);

    setFeedbackMessage(response.message);
    setIsSuccess(response.success);
    setIsSubmitting(false);

    if (response.success) {
      window.setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
    }
  }

  return (
    <section className="card-elevated p-5 sm:p-6">
      <header className="mb-5">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <UserPlus className="size-[18px]" aria-hidden="true" />
        </span>

        <h1 className="mt-3 font-display text-2xl font-bold text-foreground">Crie sua conta</h1>
        <p className="mt-1 text-sm leading-5 text-muted-foreground">
          Organize seus projetos acadêmicos em um único ambiente.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div className="grid gap-3.5 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="name" className="block text-xs font-semibold text-foreground">
              Nome completo
            </label>
            <div className="relative">
              <User
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange}
                placeholder="Digite seu nome"
                autoComplete="name"
                required
                className="h-10 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>

          <div className="space-y-1">
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
                className="h-10 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-3 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-xs font-semibold text-foreground">
            Senha
          </label>
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
              placeholder="Crie uma senha segura"
              autoComplete="new-password"
              required
              className="h-10 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-11 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
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
          <p className="text-[11px] leading-4 text-muted-foreground">
            Mínimo de 8 caracteres, uma maiúscula, um número e um caractere especial.
          </p>
        </div>

        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="block text-xs font-semibold text-foreground">
            Confirmar senha
          </label>
          <div className="relative">
            <Check
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita sua senha"
              autoComplete="new-password"
              required
              className="h-10 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-11 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
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
            className={`rounded-xl border px-3 py-2.5 text-sm leading-5 ${
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
          className="glow-accent flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-px active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
          {!isSubmitting && <ArrowRight className="size-4" aria-hidden="true" />}
        </button>
      </form>

      <div className="my-5 h-px bg-border" />

      <p className="text-center text-sm text-muted-foreground">
        Já tem uma conta?{' '}
        <Link href="/auth/login" className="font-semibold text-primary transition-opacity hover:opacity-80">
          Entrar
        </Link>
      </p>
    </section>
  );
}
