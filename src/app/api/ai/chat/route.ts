import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';
type ChatBody = { message?: string };

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return NextResponse.json({ error: 'Sessão não informada.' }, { status: 401 });
  const accessToken = authorization.slice('Bearer '.length).trim();
  if (!accessToken) return NextResponse.json({ error: 'Token de sessão inválido.' }, { status: 401 });

  let body: ChatBody;
  try { body = (await request.json()) as ChatBody; } catch { return NextResponse.json({ error: 'Corpo inválido.' }, { status: 400 }); }
  const message = body.message?.trim();
  if (!message || message.length > 2000) return NextResponse.json({ error: 'Envie uma pergunta entre 1 e 2000 caracteres.' }, { status: 400 });

  try {
    const supabase = createServerSupabaseClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) return NextResponse.json({ error: 'Sessão inválida ou expirada.' }, { status: 401 });
    const [{ data: projects, error: projectsError }, { data: tasks, error: tasksError }] = await Promise.all([
      supabase.from('projeto').select('id_projeto, nome, descricao, created_at, arquivado_em').order('created_at', { ascending: false }).limit(100),
      supabase.from('tarefa').select('id_tarefa, id_projeto, id_status, id_usuario, nome, descricao, prioridade, prazo, created_at, projeto:id_projeto(nome), status:id_status(nome)').order('prazo', { ascending: true, nullsFirst: false }).limit(300),
    ]);
    if (projectsError) throw new Error(projectsError.message);
    if (tasksError) throw new Error(tasksError.message);

    const prompt = `Você é o assistente do Progressus, um sistema de projetos acadêmicos. Responda em português do Brasil, de forma objetiva e útil.
Use exclusivamente os dados reais abaixo. Se a resposta não puder ser obtida desses dados, diga claramente que não encontrei essa informação. Nunca invente projetos, tarefas, prazos, responsáveis ou status. Considere que o contexto já foi filtrado pelas permissões do usuário.
Dados disponíveis:
${JSON.stringify({ usuario: { id: authData.user.id, email: authData.user.email ?? '' }, projetos_acessiveis: projects ?? [], tarefas_acessiveis: tasks ?? [] })}
Pergunta do usuário:
${message}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(60000),
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }] }),
    });
    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string } };
    if (!response.ok) return NextResponse.json({ error: 'A API Gemini recusou a solicitação.', detail: payload.error?.message || `HTTP ${response.status}` }, { status: 502 });
    const answer = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    return NextResponse.json({ success: true, answer: answer || 'Não consegui encontrar uma resposta com os dados disponíveis.' });
  } catch (error) {
    console.error('Erro no chat da IA:', error);
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return NextResponse.json({ error: timedOut ? 'A API Gemini excedeu 20 segundos.' : 'Não foi possível consultar a IA agora.', detail: error instanceof Error ? error.message : 'Erro desconhecido na API Gemini.' }, { status: 504 });
  }
}
