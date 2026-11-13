import { supabase } from '@/lib/supabase';
import { listAccessibleProjects } from '@/lib/projects';

export type GlobalSearchResult = {
  id: string;
  title: string;
  description: string;
  kind: 'project' | 'task' | 'message';
  href: string;
  meta?: string;
};

function searchPattern(value: string) {
  return `%${value.replace(/[%,()]/g, ' ').trim()}%`;
}

export async function searchGlobal(value: string): Promise<GlobalSearchResult[]> {
  const term = value.trim();
  if (term.length < 2) return [];
  const pattern = searchPattern(term);

  const [projects, taskResult, messageResult] = await Promise.all([
    listAccessibleProjects(),
    supabase
      .from('tarefa')
      .select('id_tarefa, id_projeto, nome, descricao, prazo, projeto:id_projeto(nome)')
      .or(`nome.ilike.${pattern},descricao.ilike.${pattern}`)
      .order('created_at', { ascending: false })
      .limit(8),
    supabase
      .from('mensagem')
      .select('id_mensagem, id_chat, conteudo, data_hora')
      .ilike('conteudo', pattern)
      .order('data_hora', { ascending: false })
      .limit(8),
  ]);

  if (taskResult.error) throw new Error(taskResult.error.message);
  if (messageResult.error) throw new Error(messageResult.error.message);

  const accessibleProjectIds = new Set(projects.map((project) => project.id));
  const projectResults: GlobalSearchResult[] = projects
    .filter((project) => `${project.name} ${project.description ?? ''}`.toLocaleLowerCase('pt-BR').includes(term.toLocaleLowerCase('pt-BR')))
    .slice(0, 8)
    .map((project) => ({
      id: project.id,
      title: project.name,
      description: project.description || 'Projeto acadêmico',
      kind: 'project',
      href: `/projects/${project.id}`,
      meta: 'Projeto',
    }));

  const taskRows = (taskResult.data ?? []) as Array<{
    id_tarefa: string;
    id_projeto: string;
    nome: string;
    descricao: string | null;
    prazo: string | null;
    projeto?: { nome?: string } | Array<{ nome?: string }> | null;
  }>;
  const taskResults: GlobalSearchResult[] = taskRows
    .filter((task) => accessibleProjectIds.has(task.id_projeto))
    .map((task) => {
      const project = Array.isArray(task.projeto) ? task.projeto[0]?.nome : task.projeto?.nome;
      return {
        id: task.id_tarefa,
        title: task.nome,
        description: task.descricao || project || 'Tarefa',
        kind: 'task' as const,
        href: `/projects/${task.id_projeto}?task=${task.id_tarefa}`,
        meta: project ? `Tarefa · ${project}` : 'Tarefa',
      };
    });

  const messageRows = (messageResult.data ?? []) as Array<{
    id_mensagem: string;
    id_chat: string;
    conteudo: string | null;
    data_hora: string | null;
  }>;
  const chatIds = [...new Set(messageRows.map((message) => message.id_chat))];
  const chats = chatIds.length
    ? await supabase.from('chat').select('id_chat, id_projeto, tipo').in('id_chat', chatIds)
    : { data: [], error: null };
  if (chats.error) throw new Error(chats.error.message);
  const chatMap = new Map((chats.data ?? []).map((chat) => [chat.id_chat, chat]));
  const messageResults: GlobalSearchResult[] = messageRows.flatMap((message) => {
    const chat = chatMap.get(message.id_chat);
    if (!chat || (chat.id_projeto && !accessibleProjectIds.has(chat.id_projeto))) return [];
    return [{
      id: message.id_mensagem,
      title: message.conteudo?.trim() || 'Mensagem com anexo',
      description: chat.tipo === 'grupo' ? 'Mensagem em chat de projeto' : 'Mensagem privada',
      kind: 'message' as const,
      href: chat.id_projeto ? `/chat?projectId=${chat.id_projeto}` : `/chat?chatId=${message.id_chat}`,
      meta: chat.id_projeto ? 'Mensagem · Projeto' : 'Mensagem privada',
    }];
  });

  return [...projectResults, ...taskResults, ...messageResults].slice(0, 12);
}
