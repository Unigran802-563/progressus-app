import { supabase } from '@/lib/supabase';
import { hydrateTaskResponsibles } from '@/lib/task-responsibles';
import {
  AtualizarTarefaData,
  CriarTarefaData,
  Tarefa,
  TarefaStatus,
} from '@/types';

function throwIfError(error: { message: string } | null) {
  if (error) throw new Error(error.message);
}

type NamedRelation = { nome: string } | { nome: string }[] | null;

function relatedName(relation: NamedRelation | undefined): string | undefined {
  return Array.isArray(relation) ? relation[0]?.nome : relation?.nome;
}

const tarefaSelect = `
  id_tarefa,
  id_projeto,
  id_status,
  id_usuario,
  id_criador,
  nome,
  descricao,
  prioridade,
  prazo,
  created_at
`;

export type MinhaTarefa = Tarefa & {
  projeto_nome: string;
  status_nome: string;
};

export type TaskMetrics = {
  abertas: number;
  emProgresso: number;
  concluidas: number;
  atrasadas: number;
};

const defaultStatuses = [
  { nome: 'A fazer', ordem: 0 },
  { nome: 'Em andamento', ordem: 1 },
  { nome: 'Em revisão', ordem: 2 },
  { nome: 'Concluído', ordem: 3 },
] as const;

export function notifyTasksChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('progressus:tasks-changed'));
  }
}

export async function obterMetricasTarefas(): Promise<TaskMetrics> {
  const { data, error } = await supabase
    .from('tarefa')
    .select('id_status, prazo, status:id_status (nome)');
  throwIfError(error);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const rows = (data ?? []) as Array<{
    id_status: string | null;
    prazo: string | null;
    status: NamedRelation;
  }>;
  const metrics: TaskMetrics = { abertas: 0, emProgresso: 0, concluidas: 0, atrasadas: 0 };

  for (const row of rows) {
    const statusName = relatedName(row.status)?.toLocaleLowerCase('pt-BR') ?? '';
    const concluida = statusName.includes('concl');
    const emProgresso = statusName.includes('andamento') || statusName.includes('progresso');
    if (concluida) {
      metrics.concluidas += 1;
    } else {
      metrics.abertas += 1;
      if (emProgresso) metrics.emProgresso += 1;
      if (row.prazo && new Date(`${row.prazo}T00:00:00`) < hoje) metrics.atrasadas += 1;
    }
  }
  return metrics;
}

export async function listarStatus(idProjeto: string): Promise<TarefaStatus[]> {
  const { data, error } = await supabase
    .from('status')
    .select('id_status, id_projeto, nome, ordem, data_criacao')
    .eq('id_projeto', idProjeto)
    .order('ordem', { ascending: true });
  throwIfError(error);
  return (data ?? []) as TarefaStatus[];
}

export async function listarOuCriarStatus(idProjeto: string): Promise<TarefaStatus[]> {
  const existing = await listarStatus(idProjeto);
  if (existing.length > 0) return existing;

  const { error: insertError } = await supabase.from('status').insert(
    defaultStatuses.map((status) => ({
      id_projeto: idProjeto,
      nome: status.nome,
      ordem: status.ordem,
    })),
  );
  if (insertError) {
    const afterInsert = await listarStatus(idProjeto);
    if (afterInsert.length > 0) return afterInsert;
    throwIfError(insertError);
  }

  return listarStatus(idProjeto);
}

export async function listarTarefas(idProjeto: string): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('tarefa')
    .select(tarefaSelect)
    .eq('id_projeto', idProjeto)
    .order('created_at', { ascending: false });
  throwIfError(error);
  return hydrateTaskResponsibles((data ?? []) as Tarefa[]);
}

export async function listarMinhasTarefas(userId: string, options: { includeCreated?: boolean } = {}): Promise<MinhaTarefa[]> {
  const query = supabase
    .from('tarefa')
    .select(`
      id_tarefa, id_projeto, id_status, id_usuario, id_criador, nome, descricao, prioridade, prazo, created_at,
      projeto:id_projeto (nome), status:id_status (nome)
    `);
  const scopedQuery = options.includeCreated
    ? query.or(`id_usuario.eq.${userId},id_criador.eq.${userId}`)
    : query.eq('id_usuario', userId);
  const { data, error } = await scopedQuery
    .order('prazo', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });
  throwIfError(error);

  const tasks = ((data ?? []) as Array<Tarefa & {
    projeto: NamedRelation;
    status: NamedRelation;
  }>).map((item) => ({
    ...item,
    projeto_nome: relatedName(item.projeto) ?? 'Projeto sem nome',
    status_nome: relatedName(item.status) ?? 'Sem status',
  }));
  return hydrateTaskResponsibles(tasks);
}

export async function buscarTarefa(idTarefa: string): Promise<Tarefa | null> {
  const { data, error } = await supabase
    .from('tarefa')
    .select(tarefaSelect)
    .eq('id_tarefa', idTarefa)
    .maybeSingle();
  throwIfError(error);
  if (!data) return null;
  return (await hydrateTaskResponsibles([data as Tarefa]))[0];
}

export async function criarTarefa(dados: CriarTarefaData): Promise<Tarefa> {
  const { data, error } = await supabase
    .from('tarefa')
    .insert({
      id_projeto: dados.id_projeto,
      id_status: dados.id_status,
      id_usuario: dados.id_usuario ?? null,
      nome: dados.nome.trim(),
      descricao: dados.descricao?.trim() || null,
      prioridade: dados.prioridade ?? 'Media',
      prazo: dados.prazo ?? null,
    })
    .select(tarefaSelect)
    .single();
  throwIfError(error);
  notifyTasksChanged();
  return data as Tarefa;
}

export async function atualizarTarefa(idTarefa: string, dados: AtualizarTarefaData): Promise<Tarefa> {
  const payload: Record<string, unknown> = {};
  if (dados.id_status !== undefined) payload.id_status = dados.id_status;
  if (dados.id_usuario !== undefined) payload.id_usuario = dados.id_usuario;
  if (dados.nome !== undefined) {
    if (!dados.nome.trim()) throw new Error('Informe o nome da tarefa.');
    payload.nome = dados.nome.trim();
  }
  if (dados.descricao !== undefined) payload.descricao = dados.descricao.trim() || null;
  if (dados.prioridade !== undefined) {
    if (!['Baixa', 'Media', 'Alta'].includes(dados.prioridade)) throw new Error('Selecione uma prioridade válida.');
    payload.prioridade = dados.prioridade;
  }
  if (dados.prazo !== undefined) payload.prazo = dados.prazo;

  const { data, error } = await supabase
    .from('tarefa')
    .update(payload)
    .eq('id_tarefa', idTarefa)
    .select(tarefaSelect)
    .single();
  if (error?.code === 'PGRST116' || error?.code === '42501') {
    throw new Error('Não foi possível salvar: a tarefa não está disponível ou você não tem permissão para editá-la.');
  }
  throwIfError(error);
  notifyTasksChanged();
  return data as Tarefa;
}

export async function alterarStatusTarefa(idTarefa: string, idStatus: string): Promise<Tarefa> {
  return atualizarTarefa(idTarefa, { id_status: idStatus });
}

export async function excluirTarefa(idTarefa: string): Promise<void> {
  const { error } = await supabase.from('tarefa').delete().eq('id_tarefa', idTarefa);
  throwIfError(error);
  notifyTasksChanged();
}
