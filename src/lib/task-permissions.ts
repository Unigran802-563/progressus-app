import type { ProjectRole, Tarefa } from '@/types';

// O vínculo ativo é obrigatório: ser criador não mantém acesso após sair do projeto.
// O proprietário conserva sua permissão administrativa nas tarefas antigas e novas.
export function canEditTask(task: Tarefa, userId: string, projectRole: ProjectRole | null): boolean {
  if (!userId || (projectRole !== 'owner' && projectRole !== 'member')) return false;
  return projectRole === 'owner' || task.id_criador === userId || task.id_usuario === userId;
}
