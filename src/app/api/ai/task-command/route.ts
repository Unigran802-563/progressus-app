import { NextRequest, NextResponse } from 'next/server';

import { explicitlyDeclinedDeadline, hasExplicitDeadlineRequest } from '@/lib/ai-task-intent';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 30000;

type Draft = {
  nome: string;
  descricao: string;
  prioridade: 'Baixa' | 'Media' | 'Alta';
  prioridadeValida: boolean;
  prazo: string | null;
  projetoNome: string;
};

type GeminiPayload = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
};

function fail(status: number, error: string, detail?: string) {
  return NextResponse.json({ error, ...(detail ? { detail } : {}) }, { status });
}

function parseDraft(text: string): Draft {
  const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
  const value = JSON.parse(cleaned) as Record<string, unknown>;
  const prioritySpecified = value.prioridade !== undefined && value.prioridade !== null && value.prioridade !== '';
  const prioridadeValida = !prioritySpecified || value.prioridade === 'Baixa' || value.prioridade === 'Media' || value.prioridade === 'Alta';
  const prioridade = value.prioridade === 'Baixa' || value.prioridade === 'Alta' ? value.prioridade : 'Media';
  const nome = typeof value.nome === 'string' ? value.nome.trim() : '';
  const projetoNome = typeof value.projetoNome === 'string' ? value.projetoNome.trim() : '';
  const rawPrazo = typeof value.prazo === 'string' ? value.prazo.trim() : '';
  const prazo = /^\d{4}-\d{2}-\d{2}$/.test(rawPrazo) && isValidDate(rawPrazo) ? rawPrazo : null;
  return {
    nome,
    projetoNome,
    descricao: typeof value.descricao === 'string' ? value.descricao.trim() : '',
    prioridade,
    prioridadeValida,
    prazo,
  };
}

function isValidDate(value: string): boolean {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const todayInBrazil = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  return value >= todayInBrazil;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  const authorization = request.headers.get('authorization');
  if (!apiKey) return fail(500, 'GEMINI_API_KEY não configurada no servidor.');
  if (!authorization?.startsWith('Bearer ')) return fail(401, 'Sessão não informada.');

  let message: string;
  try {
    const body = (await request.json()) as { message?: unknown };
    message = typeof body.message === 'string' ? body.message.trim() : '';
  } catch {
    return fail(400, 'Corpo da requisição inválido.');
  }
  if (!message) return fail(400, 'Informe o comando de criação.');

  try {
    const accessToken = authorization.slice('Bearer '.length).trim();
    const supabase = createServerSupabaseClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return fail(401, 'Sessão inválida ou expirada.');

    const { data: projects, error: projectsError } = await supabase.rpc('list_accessible_projects', { p_incluir_arquivados: false });
    if (projectsError) throw new Error(projectsError.message);
    const projectsAccessible = (projects ?? []) as Array<{ id_projeto: string; nome: string; arquivado_em: string | null; meu_papel: string }>;
    const availableProjects = projectsAccessible.filter((project) => project.meu_papel === 'owner' || project.meu_papel === 'member');
    if (availableProjects.length === 0) return fail(403, 'Você não tem permissão para criar tarefas em nenhum projeto ativo.');

    const currentDateInBrazil = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const prompt = `Você interpreta comandos de criação de tarefas do Progressus. Responda somente JSON válido.
Campos: nome, descricao, prioridade, prazo e projetoNome.
prioridade deve ser Baixa, Media ou Alta. Se não for informada, use Media. prazo deve ser YYYY-MM-DD ou null. Se o usuário mencionar um prazo que você não consiga interpretar com segurança, use null. Se disser hoje, amanhã ou esta semana, calcule usando a data atual ${currentDateInBrazil} no fuso America/Sao_Paulo.
Não invente o nome da tarefa: se o pedido não informar claramente o nome, use uma string vazia. Escolha projetoNome exatamente de uma opção disponível. Não invente projeto. Se o usuário não informar o projeto e houver apenas uma opção disponível, use essa opção. Se houver mais de uma opção e o projeto não puder ser identificado, use projetoNome como string vazia. descricao pode ser vazia. O status será o primeiro status do projeto e o responsável será o usuário autenticado.
Projetos disponíveis: ${JSON.stringify(availableProjects.map((project) => project.nome))}
Comando do usuário: ${message}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });
    const payload = (await response.json().catch(() => ({}))) as GeminiPayload;
    if (!response.ok) return fail(502, 'A API Gemini recusou a solicitação.', payload.error?.message || `HTTP ${response.status}`);

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('') ?? '';
    const draft = parseDraft(text);
    const normalizedProjectName = draft.projetoNome.toLocaleLowerCase('pt-BR');
    const project = normalizedProjectName
      ? availableProjects.find((item) => item.nome.toLocaleLowerCase('pt-BR') === normalizedProjectName)
      : availableProjects.length === 1
        ? availableProjects[0]
        : undefined;
    const questions: string[] = [];
    if (!draft.nome) questions.push('Qual nome devo dar à tarefa?');
    if (draft.nome.length > 160) questions.push('O nome informado é longo demais. Envie um nome com até 160 caracteres.');
    if (draft.descricao.length > 1000) questions.push('A descrição excede 1000 caracteres. Envie uma versão mais curta.');
    if (!draft.prioridadeValida) questions.push('Qual prioridade deseja usar: Baixa, Media ou Alta?');
    if (!project) questions.push(`Em qual projeto ativo deseja criá-la? Escolha entre: ${availableProjects.map((item) => item.nome).join(', ')}.`);
    if (hasExplicitDeadlineRequest(message) && !explicitlyDeclinedDeadline(message) && !draft.prazo) questions.push('Qual é o prazo correto? Não consegui interpretar a data informada.');
    if (questions.length > 0) {
      return NextResponse.json({ success: true, clarification: `Para criar a tarefa, preciso destas informações:\n${questions.map((question) => `• ${question}`).join('\n')}` });
    }

    if (!project) return fail(400, 'Não foi possível identificar um projeto válido para a tarefa.');

    const { data: statuses, error: statusError } = await supabase.from('status').select('id_status, nome, ordem').eq('id_projeto', project.id_projeto).order('ordem', { ascending: true }).limit(20);
    if (statusError) throw new Error(statusError.message);
    const firstStatus = statuses?.[0] as { id_status: string; nome: string } | undefined;
    if (!firstStatus) {
      return NextResponse.json({ success: true, clarification: `O projeto ${project.nome} não possui status para receber tarefas. Escolha outro projeto ativo ou peça ao responsável pelo projeto para cadastrar um status.` });
    }

    const { prioridadeValida: _prioridadeValida, ...validatedDraft } = draft;
    return NextResponse.json({ success: true, draft: { ...validatedDraft, projectId: project.id_projeto, projectName: project.nome, statusId: firstStatus.id_status, statusName: firstStatus.nome, responsibleId: authData.user.id } });
  } catch (error) {
    console.error('Erro ao interpretar comando de tarefa:', error);
    return fail(500, error instanceof Error ? error.message : 'Não foi possível interpretar o comando.');
  }
}
