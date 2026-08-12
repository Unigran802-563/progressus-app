'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { ArrowLeft, Mail, Send } from 'lucide-react';

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
    <section className="w-full max-w-[460px] rounded-3xl bg-white px-8 py-9 text-slate-950 shadow-2xl shadow-slate-950/25 sm:px-10">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3b1d7a] text-white shadow-lg shadow-purple-900/30">
          <Mail className="h-7 w-7" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Recuperar senha
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Informe seu e-mail para receber o link de redefinição de senha.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-900">
            E-mail
          </label>

          <div className="relative">
            <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
              required
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3b1d7a] focus:ring-4 focus:ring-purple-900/10"
            />
          </div>
        </div>

        {feedbackMessage && (
          <div
            className={`rounded-xl border px-4 py-3 text-sm leading-6 ${
              isSuccess
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}
          >
            {feedbackMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3b1d7a] px-4 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 transition hover:bg-[#2d145f] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Enviando...' : 'Enviar link de recuperação'}
          {!isSubmitting && <Send className="h-4 w-4" aria-hidden="true" />}
        </button>
      </form>

      <div className="my-7 h-px bg-slate-200" />

      <Link
        href="/auth/login"
        className="flex items-center justify-center gap-2 text-sm font-medium text-[#3b1d7a] transition hover:text-[#2d145f]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar para o login
      </Link>
    </section>
  );
}
