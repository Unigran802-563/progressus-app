'use client';

import { useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import type {
  AuthResponse,
  ForgotPasswordFormData,
  LoginFormData,
  RegisterFormData,
} from '@/types';

type UseAuthReturn = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  login: (data: LoginFormData) => Promise<AuthResponse>;
  register: (data: RegisterFormData) => Promise<AuthResponse>;
  forgotPassword: (data: ForgotPasswordFormData) => Promise<AuthResponse>;
  logout: () => Promise<AuthResponse>;
};

function isValidPassword(password: string): boolean {
  const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

  return passwordRegex.test(password);
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadSession() {
      const { data } = await supabase.auth.getSession();

      setSession(data.session);
      setUser(data.session?.user ?? null);
      setIsLoading(false);
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function login(data: LoginFormData): Promise<AuthResponse> {
    const { email, password } = data;

    if (!email || !password) {
      return {
        success: false,
        message: 'Informe seu e-mail e sua senha para acessar o Progressus.',
      };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return {
        success: false,
        message: 'E-mail ou senha inválidos. Verifique os dados e tente novamente.',
      };
    }

    return {
      success: true,
      message: 'Login realizado com sucesso.',
    };
  }

  async function register(data: RegisterFormData): Promise<AuthResponse> {
    const { name, email, password } = data;

    if (!name || !email || !password) {
      return {
        success: false,
        message: 'Preencha nome, e-mail e senha para criar sua conta.',
      };
    }

    if (!isValidPassword(password)) {
      return {
        success: false,
        message:
          'A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, um número e um caractere especial.',
      };
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'student',
        },
      },
    });

    if (error) {
  console.error('Erro ao cadastrar usuário no Supabase:', error);

  return {
    success: false,
    message: error.message,
  };
}

    return {
      success: true,
      message: 'Cadastro realizado com sucesso. Verifique seu e-mail, se a confirmação estiver ativada.',
    };
  }

  async function forgotPassword(data: ForgotPasswordFormData): Promise<AuthResponse> {
    const { email } = data;

    if (!email) {
      return {
        success: false,
        message: 'Informe seu e-mail para recuperar a senha.',
      };
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/login`,
    });

    if (error) {
      return {
        success: false,
        message: 'Não foi possível enviar o e-mail de recuperação. Tente novamente.',
      };
    }

    return {
      success: true,
      message: 'Enviamos um link de recuperação para o seu e-mail.',
    };
  }

  async function logout(): Promise<AuthResponse> {
    const { error } = await supabase.auth.signOut();

    if (error) {
      return {
        success: false,
        message: 'Não foi possível sair da conta. Tente novamente.',
      };
    }

    return {
      success: true,
      message: 'Logout realizado com sucesso.',
    };
  }

  return {
    user,
    session,
    isLoading,
    login,
    register,
    forgotPassword,
    logout,
  };
}
