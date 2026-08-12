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
      <section className="w-full max-w-[460px] rounded-3xl bg-white px-8 py-9 text-center text-sm text-slate-500 shadow-2xl shadow-slate-950/25 sm:px-10">
        Validando link de recuperação...
      </section>
    );
  }

  if (!isValidLink) {
    return (
      <section className="w-full max-w-[460px] rounded-3xl bg-white px-8 py-9 text-center text-slate-950 shadow-2xl shadow-slate-950/25 sm:px-10">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <KeyRound className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold">Link inválido ou expirado</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Solicite um novo link de recuperação de senha para continuar.
        </p>
        <Link
          href="/auth/forgot-password"
          className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[#3b1d7a] px-5 text-sm font-semibold text-white transition hover:bg-[#2d145f]"
        >
          Solicitar novo link
        </Link>
      </section>
    );
  }

  return (
    <section className="w-full max-w-[460px] rounded-3xl bg-white px-8 py-9 text-slate-950 shadow-2xl shadow-slate-950/25 sm:px-10">
      <div className="mb-7 text-center">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3b1d7a] text-white shadow-lg shadow-purple-900/30">
          <KeyRound className="h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Criar nova senha</h1>
        <p className="mt-2 text-sm text-slate-500">Escolha uma senha segura para acessar sua conta.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-900">
            Nova senha
          </label>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#3b1d7a] focus:ring-4 focus:ring-purple-900/10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              className="absolute inset-y-0 right-0 px-4 text-slate-400 transition hover:text-[#3b1d7a]"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Mínimo de 8 caracteres, uma letra maiúscula, um número e um caractere especial.
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-900">
            Confirmar nova senha
          </label>
          <div className="relative">
            <Check className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              id="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              required
              className="h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#3b1d7a] focus:ring-4 focus:ring-purple-900/10"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((current) => !current)}
              className="absolute inset-y-0 right-0 px-4 text-slate-400 transition hover:text-[#3b1d7a]"
              aria-label={showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {feedbackMessage && (
          <div className={`rounded-xl border px-4 py-3 text-sm leading-6 ${isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
            {feedbackMessage}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#3b1d7a] px-4 text-sm font-semibold text-white shadow-lg shadow-purple-900/20 transition hover:bg-[#2d145f] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Atualizando...' : 'Redefinir senha'}
        </button>
      </form>
    </section>
  );
}
