import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
const TIMEOUT_MS = 30000;

type Draft = {
  nome: string;
  descricao: string;
  prioridade: 'Baixa' | 'Media' | 'Alta';
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
  const prioridade = value.prioridade === 'Baixa' || value.prioridade === 'Alta' ? value.prioridade : 'Media';
  const nome = String(value.nome ?? '').trim();
  const projetoNome = String(value.projetoNome ?? '').trim();
  if (!nome || !projetoNome) throw new Error('A IA não conseguiu identificar o nome da tarefa e do projeto.');
  return {
    nome,
    projetoNome,
    descricao: String(value.descricao ?? '').trim(),
    prioridade,
    prazo: typeof value.prazo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.prazo) ? value.prazo : null,
  };
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
    const availableProjects = (projects ?? []) as Array<{ id_projeto: string; nome: string; arquivado_em: string | null; meu_papel: string }>;
    if (availableProjects.length === 0) return fail(400, 'Você ainda não possui projetos ativos para receber uma tarefa.');

    const prompt = `Você interpreta comandos de criação de tarefas do Progressus. Responda somente JSON válido.
Campos obrigatórios: nome, descricao, prioridade, prazo, projetoNome.
prioridade deve ser Baixa, Media ou Alta. prazo deve ser YYYY-MM-DD ou null. Se o usuário disser hoje, amanhã ou esta semana, calcule usando a data atual ${new Date().toISOString().slice(0, 10)}.
Escolha projetoNome exatamente de uma opção disponível. Não invente projeto. Se faltar informação, use null apenas para descricao e prazo; nome e projetoNome são obrigatórios.
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
    const project = availableProjects.find((item) => item.nome.toLocaleLowerCase('pt-BR') === draft.projetoNome.toLocaleLowerCase('pt-BR'));
    if (!project) return fail(400, 'Não consegui associar o comando a um projeto ativo permitido. Informe o nome exato do projeto.');

    const { data: statuses, error: statusError } = await supabase.from('status').select('id_status, nome, ordem').eq('id_projeto', project.id_projeto).order('ordem', { ascending: true }).limit(20);
    if (statusError) throw new Error(statusError.message);
    const firstStatus = statuses?.[0] as { id_status: string; nome: string } | undefined;
    if (!firstStatus) return fail(400, 'O projeto não possui status inicial para receber a tarefa.');

    return NextResponse.json({ success: true, draft: { ...draft, projectId: project.id_projeto, projectName: project.nome, statusId: firstStatus.id_status, statusName: firstStatus.nome, responsibleId: authData.user.id } });
  } catch (error) {
    console.error('Erro ao interpretar comando de tarefa:', error);
    return fail(500, error instanceof Error ? error.message : 'Não foi possível interpretar o comando.');
  }
}
