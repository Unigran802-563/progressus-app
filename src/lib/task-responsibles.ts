import { supabase } from '@/lib/supabase';
import type { Tarefa } from '@/types';

type TaskResponsibleRow = {
  id_tarefa: string;
  responsavel_nome: string;
  responsavel_excluido: boolean;
};

// O RPC só retorna tarefas de projetos acessíveis à sessão atual.
// O ID original do responsável continua salvo; não apagamos o histórico.
export async function hydrateTaskResponsibles<T extends Tarefa>(tasks: T[]): Promise<T[]> {
  if (tasks.length === 0) return tasks;
  const projectIds = [...new Set(tasks.map((task) => task.id_projeto))];
  const responsibleByTask = new Map<string, TaskResponsibleRow>();

  // Limitar chamadas simultâneas para não sobrecarregar o plano gratuito.
  for (let index = 0; index < projectIds.length; index += 4) {
    const batches = await Promise.all(projectIds.slice(index, index + 4).map(async (projectId) => {
      const { data, error } = await supabase.rpc('list_project_task_responsibles', { p_project_id: projectId });
      if (error) throw new Error(error.message);
      return (data ?? []) as TaskResponsibleRow[];
    }));
    for (const rows of batches) {
      for (const row of rows) responsibleByTask.set(row.id_tarefa, row);
    }
  }

  return tasks.map((task) => {
    const responsible = responsibleByTask.get(task.id_tarefa);
    return responsible ? {
      ...task,
      responsavel_nome: responsible.responsavel_nome,
      responsavel_excluido: responsible.responsavel_excluido,
    } : task;
  });
}

export function getTaskResponsibleName(task: Tarefa): string {
  if (task.responsavel_excluido) return 'Usuário excluído';
  return task.responsavel_nome?.trim() || (task.id_usuario ? 'Usuário' : 'Sem responsável');
}
