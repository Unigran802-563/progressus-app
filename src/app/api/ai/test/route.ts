import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite';

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY não configurada no servidor.' }, { status: 500 });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(60000),
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: 'Responda em português brasileiro com uma frase curta confirmando que a conexão foi realizada.' }] }],
        }),
      },
    );

    const payload = (await response.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>; error?: { message?: string; status?: string } };
    if (!response.ok) {
      return NextResponse.json({ error: 'A API Gemini recusou a solicitação.', detail: payload.error?.message || `HTTP ${response.status} (${payload.error?.status || 'erro desconhecido'})` }, { status: 502 });
    }

    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim();
    return NextResponse.json({ success: true, response: text || 'Conexão realizada, mas a API não retornou texto.' });
  } catch (error) {
    console.error('Erro ao testar a Gemini API:', error);
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return NextResponse.json({
      error: timedOut ? 'A API Gemini excedeu 15 segundos.' : 'Não foi possível conectar à Gemini API.',
      detail: error instanceof Error ? error.message : 'Erro desconhecido na conexão.',
    }, { status: 504 });
  }
}
