import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

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

    const context = {
      usuario: { id: authData.user.id, email: authData.user.email ?? '' },
      projetos_acessiveis: projects ?? [],
      tarefas_acessiveis: tasks ?? [],
    };

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.interactions.create({
      model: 'gemini-3.8-flash',
      input: [{ type: 'user_input', content: [{ type: 'text', text: `Você é o assistente do Progressus, um sistema de projetos acadêmicos. Responda em português do Brasil, de forma objetiva e útil.

Use exclusivamente os dados reais abaixo. Se a resposta não puder ser obtida desses dados, diga claramente que não encontrei essa informação. Nunca invente projetos, tarefas, prazos, responsáveis ou status. Não revele IDs internos, tokens ou dados que não ajudem o usuário. Considere que o contexto já foi filtrado pelas permissões do usuário.

Dados disponíveis:
${JSON.stringify(context)}

Pergunta do usuário:
${message}` }] }],
    });

    return NextResponse.json({ success: true, answer: response.output_text?.trim() || 'Não consegui encontrar uma resposta com os dados disponíveis.' });
  } catch (error) {
    console.error('Erro no chat da IA:', error);
    return NextResponse.json({
      error: 'Não foi possível consultar a IA agora.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido na API Gemini.',
    }, { status: 500 });
  }
}
