'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useState } from 'react';

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
      setIsSuccess(false);
      setIsSubmitting(false);
      return;
    }

    const response = await register(formData);

    setFeedbackMessage(response.message);
    setIsSuccess(response.success);
    setIsSubmitting(false);

    if (response.success) {
      setTimeout(() => {
        router.push('/auth/login');
      }, 1500);
    }
  }

  return (
    <section className="w-full max-w-[500px] rounded-3xl bg-white px-8 py-9 text-slate-950 shadow-2xl shadow-slate-950/25 sm:px-10">
      <div className="mb-7 flex flex-col items-center text-center">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3b1d7a] text-white shadow-lg shadow-purple-900/30">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M19 8v6" />
            <path d="M22 11h-6" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
          Criar conta
        </h1>

        <p className="mt-2 text-sm text-slate-500">
          Comece a organizar seus projetos no Progressus
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="name" className="mb-2 block text-sm font-medium text-slate-900">
            Nome completo
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21a8 8 0 0 0-16 0" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </span>

            <input
              id="name"
              name="name"
              type="text"
              value={formData.name}
              onChange={handleChange}
              placeholder="Digite seu nome"
              autoComplete="name"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3b1d7a] focus:ring-4 focus:ring-purple-900/10"
            />
          </div>
        </div>

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-900">
            E-mail
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 4h16v16H4z" />
                <path d="m22 6-10 7L2 6" />
              </svg>
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
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-900">
            Senha
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>

            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="Crie uma senha segura"
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3b1d7a] focus:ring-4 focus:ring-purple-900/10"
            />
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-900">
            Confirmar senha
          </label>

          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400">
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </span>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita sua senha"
              autoComplete="new-password"
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
          {isSubmitting ? 'Criando conta...' : 'Criar conta'}
          {!isSubmitting && <span aria-hidden="true">→</span>}
        </button>
      </form>

      <div className="my-7 h-px bg-slate-200" />

      <p className="text-center text-sm text-slate-500">
        Já tem uma conta?{' '}
        <Link href="/auth/login" className="font-medium text-[#3b1d7a] transition hover:text-[#2d145f]">
          Entrar
        </Link>
      </p>

      <p className="mt-4 text-center text-xs text-slate-400">
        Cadastro seguro no ambiente Progressus
      </p>
    </section>
  );
}
