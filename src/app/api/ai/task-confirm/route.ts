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

function validTaskDeadline(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const todayInBrazil = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return value >= todayInBrazil;
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
  if (typeof body.projectId !== 'string' || !body.projectId || typeof body.statusId !== 'string' || !body.statusId || typeof body.nome !== 'string' || !body.nome.trim()) return fail(400, 'Projeto, status e nome da tarefa são obrigatórios.');
  if (body.nome.trim().length > 160) return fail(400, 'O nome da tarefa excede o limite permitido de 160 caracteres.');
  if (body.descricao !== undefined && body.descricao !== null && (typeof body.descricao !== 'string' || body.descricao.trim().length > 1000)) return fail(400, 'A descrição deve conter no máximo 1000 caracteres.');
  if (body.prioridade !== undefined && !['Baixa', 'Media', 'Alta'].includes(body.prioridade)) return fail(400, 'Prioridade inválida.');
  if (body.prazo !== undefined && body.prazo !== null && (typeof body.prazo !== 'string' || !validTaskDeadline(body.prazo))) return fail(400, 'Prazo inválido ou anterior à data de hoje.');

  try {
    const supabase = createServerSupabaseClient(authorization.slice('Bearer '.length).trim());
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return fail(401, 'Sessão inválida ou expirada.');

    const { data: member, error: memberError } = await supabase.from('usuario_projeto').select('papel').eq('id_projeto', body.projectId).eq('id_usuario', authData.user.id).maybeSingle();
    if (memberError) throw new Error(memberError.message);
    if (!member || !['owner', 'member'].includes(member.papel)) return fail(403, 'Você não tem permissão para criar tarefas neste projeto.');

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
