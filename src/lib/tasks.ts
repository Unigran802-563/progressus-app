import { supabase } from '@/lib/supabase';
import {
  AtualizarTarefaData,
  CriarTarefaData,
  Tarefa,
  TarefaStatus,
} from '@/types';

function throwIfError(error: { message: string } | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function listarStatus(
  idProjeto: string
): Promise<TarefaStatus[]> {
  const { data, error } = await supabase
    .from('status')
    .select('id_status, id_projeto, nome, ordem, data_criacao')
    .eq('id_projeto', idProjeto)
    .order('ordem', { ascending: true });

  throwIfError(error);

  return (data ?? []) as TarefaStatus[];
}

export async function listarTarefas(
  idProjeto: string
): Promise<Tarefa[]> {
  const { data, error } = await supabase
    .from('tarefa')
    .select(`
      id_tarefa,
      id_projeto,
      id_status,
      nome,
      descricao,
      prioridade,
      created_at
    `)
    .eq('id_projeto', idProjeto)
    .order('created_at', { ascending: false });

  throwIfError(error);

  return (data ?? []) as Tarefa[];
}

export async function buscarTarefa(
  idTarefa: string
): Promise<Tarefa | null> {
  const { data, error } = await supabase
    .from('tarefa')
    .select(`
      id_tarefa,
      id_projeto,
      id_status,
      nome,
      descricao,
      prioridade,
      created_at
    `)
    .eq('id_tarefa', idTarefa)
    .maybeSingle();

  throwIfError(error);

  return data as Tarefa | null;
}

export async function criarTarefa(
  dados: CriarTarefaData
): Promise<Tarefa> {
  const { data, error } = await supabase
    .from('tarefa')
    .insert({
      id_projeto: dados.id_projeto,
      id_status: dados.id_status,
      nome: dados.nome.trim(),
      descricao: dados.descricao?.trim() || null,
      prioridade: dados.prioridade ?? 'Media',
    })
    .select(`
      id_tarefa,
      id_projeto,
      id_status,
      nome,
      descricao,
      prioridade,
      created_at
    `)
    .single();

  throwIfError(error);

  return data as Tarefa;
}

export async function atualizarTarefa(
  idTarefa: string,
  dados: AtualizarTarefaData
): Promise<Tarefa> {
  const payload: Record<string, unknown> = {};

  if (dados.id_status !== undefined) {
    payload.id_status = dados.id_status;
  }

  if (dados.nome !== undefined) {
    payload.nome = dados.nome.trim();
  }

  if (dados.descricao !== undefined) {
    payload.descricao = dados.descricao.trim() || null;
  }

  if (dados.prioridade !== undefined) {
    payload.prioridade = dados.prioridade;
  }

  const { data, error } = await supabase
    .from('tarefa')
    .update(payload)
    .eq('id_tarefa', idTarefa)
    .select(`
      id_tarefa,
      id_projeto,
      id_status,
      nome,
      descricao,
      prioridade,
      created_at
    `)
    .single();

  throwIfError(error);

  return data as Tarefa;
}

export async function alterarStatusTarefa(
  idTarefa: string,
  idStatus: string
): Promise<Tarefa> {
  const { data, error } = await supabase
    .from('tarefa')
    .update({
      id_status: idStatus,
    })
    .eq('id_tarefa', idTarefa)
    .select(`
      id_tarefa,
      id_projeto,
      id_status,
      nome,
      descricao,
      prioridade,
      created_at
    `)
    .single();

  throwIfError(error);

  return data as Tarefa;
}

export async function excluirTarefa(
  idTarefa: string
): Promise<void> {
  const { error } = await supabase
    .from('tarefa')
    .delete()
    .eq('id_tarefa', idTarefa);

  throwIfError(error);
}
