import { supabase } from '@/lib/supabase';
import type { TarefaPrioridade } from '@/types';

export type SuggestedTask = {
  nome: string;
  descricao: string;
  prioridade: TarefaPrioridade;
};

type SuggestTasksResponse = {
  success: boolean;
  suggestions?: SuggestedTask[];
  error?: string;
};

export async function sugerirTarefasComIA(
  projectId: string,
): Promise<SuggestedTask[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    throw new Error('Sua sessão expirou. Faça login novamente.');
  }

  const response = await fetch('/api/ai/suggest-tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ projectId }),
  });

  const result =
    (await response.json()) as SuggestTasksResponse;

  if (!response.ok) {
    throw new Error(
      result.error ?? 'Não foi possível gerar sugestões de tarefas.',
    );
  }

  return result.suggestions ?? [];
}
