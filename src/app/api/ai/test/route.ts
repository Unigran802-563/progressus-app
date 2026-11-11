import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY não configurada no servidor.' },
      { status: 500 },
    );
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await Promise.race([
      ai.interactions.create({
        model: 'gemini-3.8-flash',
        input:
          'Responda em português brasileiro com uma frase curta confirmando que a conexão foi realizada.',
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo limite excedido ao consultar o Gemini.')), 15000),
      ),
    ]);

    return NextResponse.json({
      success: true,
      response: response.output_text,
    });
  } catch (error) {
    console.error('Erro ao testar a Gemini API:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.includes('Tempo limite')
            ? 'A conexão com o Gemini excedeu 15 segundos. Verifique a chave, o modelo e a disponibilidade da API.'
            : 'Não foi possível consultar a Gemini API.',
      },
      { status: 500 },
    );
  }
}
