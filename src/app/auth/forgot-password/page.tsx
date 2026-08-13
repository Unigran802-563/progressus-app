'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, KeyRound, Mail, Send } from 'lucide-react';

import { useAuth } from '@/hooks/useAuth';

export default function ForgotPasswordPage() {
  const { forgotPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setFeedbackMessage('');
    setIsSuccess(false);

    const response = await forgotPassword({ email });

    setFeedbackMessage(response.message);
    setIsSuccess(response.success);
    setIsSubmitting(false);
  }

  return (
    <section className="card-elevated p-6 sm:p-8">
      <header className="mb-7">
        <span className="grid size-11 place-items-center rounded-xl bg-primary/15 text-primary ring-1 ring-primary/25">
          <KeyRound className="size-5" aria-hidden="true" />
        </span>

        <h1 className="mt-5 font-display text-2xl font-bold text-foreground sm:text-3xl">
          Recuperar acesso
        </h1>
        <p className="mt-1.5 text-sm leading-6 text-muted-foreground">
          Informe seu e-mail e enviaremos um link seguro para redefinir sua senha.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-semibold text-foreground">
            E-mail da conta
          </label>
          <div className="relative">
            <Mail
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
              required
              className="h-11 w-full rounded-xl border border-border bg-surface-2 pl-10 pr-4 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-ring/40"
            />
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
          {isSubmitting ? 'Enviando link...' : 'Enviar link de recuperação'}
          {!isSubmitting && <Send className="size-4" aria-hidden="true" />}
        </button>
      </form>

      <div className="my-7 h-px bg-border" />

      <Link
        href="/auth/login"
        className="flex items-center justify-center gap-2 text-sm font-semibold text-primary transition-opacity hover:opacity-80"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Voltar para o login
      </Link>
    </section>
  );
}
