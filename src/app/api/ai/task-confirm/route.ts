import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type ConfirmBody = {
  confirmed?: boolean;
  projectId?: string;
  statusId?: string;
  responsibleId?: string | null;
  nome?: string;
  descricao?: string;
  prioridade?: 'Baixa' | 'Media' | 'Alta';
  prazo?: string | null;
};

function fail(status: number, error: string) {
  return NextResponse.json({ error }, { status });
}

export async function POST(request: NextRequest) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return fail(401, 'Sessão não informada.');

  let body: ConfirmBody;
  try {
    body = (await request.json()) as ConfirmBody;
  } catch {
    return fail(400, 'Corpo da requisição inválido.');
  }

  if (body.confirmed !== true) return fail(400, 'Confirmação obrigatória para criar a tarefa.');
  if (!body.projectId || !body.statusId || !body.nome?.trim()) return fail(400, 'Projeto, status e nome da tarefa são obrigatórios.');
  if (body.prazo && !/^\d{4}-\d{2}-\d{2}$/.test(body.prazo)) return fail(400, 'Prazo inválido.');

  try {
    const supabase = createServerSupabaseClient(authorization.slice('Bearer '.length).trim());
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return fail(401, 'Sessão inválida ou expirada.');

    const { data: member, error: memberError } = await supabase.from('usuario_projeto').select('papel').eq('id_projeto', body.projectId).eq('id_usuario', authData.user.id).maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member || member.papel === 'viewer') return fail(403, 'Você não tem permissão para criar tarefas neste projeto.');

    const { data: status, error: statusError } = await supabase.from('status').select('id_status').eq('id_status', body.statusId).eq('id_projeto', body.projectId).maybeSingle();
    if (statusError) throw new Error(statusError.message);
    if (!status) return fail(400, 'O status selecionado não pertence ao projeto.');

    const responsibleId = body.responsibleId || authData.user.id;
    const { data: responsible, error: responsibleError } = await supabase.from('usuario_projeto').select('id_usuario').eq('id_projeto', body.projectId).eq('id_usuario', responsibleId).maybeSingle();
    if (responsibleError) throw new Error(responsibleError.message);
    if (!responsible) return fail(400, 'O responsável selecionado não pertence ao projeto.');

    const { data: task, error: insertError } = await supabase.from('tarefa').insert({
      id_projeto: body.projectId,
      id_status: body.statusId,
      id_usuario: responsibleId,
      nome: body.nome.trim(),
      descricao: body.descricao?.trim() || null,
      prioridade: body.prioridade ?? 'Media',
      prazo: body.prazo ?? null,
    }).select('id_tarefa, id_projeto, id_status, id_usuario, nome, descricao, prioridade, prazo, created_at').single();
    if (insertError) throw new Error(insertError.message);

    return NextResponse.json({ success: true, task });
  } catch (error) {
    console.error('Erro ao confirmar criação de tarefa pela IA:', error);
    return fail(500, error instanceof Error ? error.message : 'Não foi possível criar a tarefa.');
  }
}
