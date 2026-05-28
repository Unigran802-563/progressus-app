'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChangeEvent, FormEvent, useState } from 'react';
import { Check, Eye, EyeOff, Lock, Mail, User, UserPlus } from 'lucide-react';

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
          <UserPlus className="h-7 w-7" aria-hidden="true" />
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
              <User className="h-5 w-5" aria-hidden="true" />
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
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-900">
            Senha
          </label>

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
              placeholder="Crie uma senha segura"
              autoComplete="new-password"
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
              <Check className="h-5 w-5" aria-hidden="true" />
            </span>

            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repita sua senha"
              autoComplete="new-password"
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#3b1d7a] focus:ring-4 focus:ring-purple-900/10"
            />

            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-400 transition hover:text-[#3b1d7a]"
              aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
            >
              {showConfirmPassword ? (
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
