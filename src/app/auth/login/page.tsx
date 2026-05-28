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
    <section className="w-full max-w-[460px] rounded-3xl bg-white px-8 py-9 text-slate-950 shadow-2xl shadow-slate-950/25 sm:px-10">
      <div className="mb-7 flex flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3b1d7a] text-white shadow-lg shadow-purple-900/30">
          <LogIn className="h-7 w-7" aria-hidden="true" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Entrar
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Acesse sua conta para continuar no Progressus
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-900">
            E-mail
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Mail className="h-5 w-5" aria-hidden="true" />
            </span>

            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="seuemail@exemplo.com"
              autoComplete="email"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3b1d7a] focus:ring-4 focus:ring-purple-900/10"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between gap-4">
            <label htmlFor="password" className="block text-sm font-medium text-slate-900">
              Senha
            </label>

            <Link
              href="/auth/forgot-password"
              className="text-xs font-medium text-[#3b1d7a] transition hover:text-[#2d145f]"
            >
              Esqueci minha senha
            </Link>
          </div>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <Lock className="h-5 w-5" aria-hidden="true" />
            </span>

            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={formData.password}
              onChange={handleChange}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3b1d7a] focus:ring-4 focus:ring-purple-900/10"
            />

            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-[#3b1d7a]"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Eye className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
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
          {isSubmitting ? 'Entrando...' : 'Entrar'}
          {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </button>
      </form>

      <div className="my-7 h-px bg-slate-200" />

      <p className="text-center text-sm text-slate-500">
        Ainda não tem uma conta?{' '}
        <Link href="/auth/register" className="font-medium text-[#3b1d7a] transition hover:text-[#2d145f]">
          Criar conta
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-slate-400">
        Acesso seguro ao ambiente Progressus
      </p>
    </section>
  );
}
