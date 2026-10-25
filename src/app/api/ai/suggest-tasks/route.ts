import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

type SuggestTasksBody = {
  projectId?: string;
};

type SuggestedTask = {
  nome: string;
  descricao: string;
  prioridade: 'Baixa' | 'Media' | 'Alta';
};

function isValidProjectId(projectId: unknown): projectId is string {
  return (
    typeof projectId === 'string' &&
    projectId.trim().length > 0 &&
    projectId.length <= 100
  );
}

function extractJson(text: string): SuggestedTask[] {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const parsed: unknown = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error('A IA não retornou uma lista de tarefas.');
  }

  return parsed
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === 'object' && item !== null,
    )
    .map((item): SuggestedTask => {
      const prioridade: SuggestedTask['prioridade'] =
        item.prioridade === 'Baixa' ||
        item.prioridade === 'Alta' ||
        item.prioridade === 'Media'
          ? item.prioridade
          : 'Media';

      return {
        nome: String(item.nome ?? '').trim(),
        descricao: String(item.descricao ?? '').trim(),
        prioridade,
      };
    })
    .filter((item) => item.nome.length > 0)
    .slice(0, 5);
}


export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY não configurada no servidor.' },
      { status: 500 },
    );
  }

  const authorization = request.headers.get('authorization');

  if (!authorization?.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Sessão não informada.' },
      { status: 401 },
    );
  }

  const accessToken = authorization.slice('Bearer '.length).trim();

  if (!accessToken) {
    return NextResponse.json(
      { error: 'Token de sessão inválido.' },
      { status: 401 },
    );
  }

  let body: SuggestTasksBody;

  try {
    body = (await request.json()) as SuggestTasksBody;
  } catch {
    return NextResponse.json(
      { error: 'Corpo da requisição inválido.' },
      { status: 400 },
    );
  }

  if (!isValidProjectId(body.projectId)) {
    return NextResponse.json(
      { error: 'projectId é obrigatório.' },
      { status: 400 },
    );
  }

  try {
    const supabase = createServerSupabaseClient(accessToken);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sessão inválida ou expirada.' },
        { status: 401 },
      );
    }

    const { data: member, error: memberError } = await supabase
      .from('usuario_projeto')
      .select('papel')
      .eq('id_projeto', body.projectId)
      .eq('id_usuario', user.id)
      .maybeSingle();

    if (memberError) {
      throw new Error(memberError.message);
    }

    if (!member) {
      return NextResponse.json(
        { error: 'Você não tem acesso a este projeto.' },
        { status: 403 },
      );
    }

    const { data: project, error: projectError } = await supabase
      .from('projeto')
      .select('id_projeto, nome, descricao')
      .eq('id_projeto', body.projectId)
      .maybeSingle();

    if (projectError) {
      throw new Error(projectError.message);
    }

    if (!project) {
      return NextResponse.json(
        { error: 'Projeto não encontrado.' },
        { status: 404 },
      );
    }

    const { data: tasks, error: tasksError } = await supabase
      .from('tarefa')
      .select('nome, descricao, prioridade')
      .eq('id_projeto', body.projectId)
      .order('created_at', { ascending: false })
      .limit(30);

    if (tasksError) {
      throw new Error(tasksError.message);
    }

    const context = {
      projeto: {
        nome: project.nome,
        descricao: project.descricao ?? '',
      },
      tarefas_existentes: tasks ?? [],
    };

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.interactions.create({
      model: 'gemini-3.8-flash',
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: `Analise o contexto acadêmico abaixo e sugira até 5 tarefas úteis que ainda não estejam cadastradas.

Regras:
- Responda somente com um array JSON válido.
- Cada item deve possuir: nome, descricao e prioridade.
- prioridade deve ser exatamente "Baixa", "Media" ou "Alta".
- Não invente informações específicas que não estejam no contexto.
- Não repita tarefas existentes.
- Não crie tarefas automaticamente no banco.

Contexto:
${JSON.stringify(context)}`,
            },
          ],
        },
      ],
    });

    const suggestions = extractJson(response.output_text ?? '');

    return NextResponse.json({
      success: true,
      suggestions,
    });
  } catch (error) {
    console.error('Erro ao gerar sugestões de tarefas:', error);

    return NextResponse.json(
      { error: 'Não foi possível gerar sugestões de tarefas.' },
      { status: 500 },
    );
  }
}
