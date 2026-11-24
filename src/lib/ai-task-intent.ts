const TASK_CREATION_ACTION = /\b(?:cria|criar|crie|adicione|adiciona|adicionar|cadastre|cadastra|cadastrar|registre|registra|registrar|inclua|inclui|incluir|faca|faz|fazer)\b/;
const TASK_NOUN = /\b(?:tarefas?|atividades?)\b/;
const INFORMATION_QUESTION = /^\s*(?:como|quando|onde|por que|porque|qual|quais|o que|posso)\b/;
export const TASK_CLARIFICATION_PREFIX = 'Para criar a tarefa, preciso destas informações:';

export function isTaskInformationQuestion(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  return INFORMATION_QUESTION.test(normalized);
}

export function isTaskCreationRequest(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

  return !isTaskInformationQuestion(normalized) && TASK_CREATION_ACTION.test(normalized) && TASK_NOUN.test(normalized);
}

export function isTaskClarificationMessage(value: string): boolean {
  return value.trimStart().startsWith(TASK_CLARIFICATION_PREFIX);
}

export function isTaskCancellationMessage(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');
  return /\b(?:cancelar|cancele|desistir|desisto|esquece|deixa\s+(?:pra|para)\s+la)\b/.test(normalized);
}

export function hasExplicitDeadlineRequest(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

  return /\b(?:prazo|data|dia|ate|hoje|amanha|segunda|terca|quarta|quinta|sexta|sabado|domingo|vencimento|vence|entrega|semana|mes)\b/.test(normalized)
    || /\b\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?\b/.test(normalized)
    || /\b\d{4}-\d{2}-\d{2}\b/.test(normalized);
}

export function explicitlyDeclinedDeadline(value: string): boolean {
  const normalized = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR');

  return /\b(?:sem\s+(?:prazo|data)|nao\s+(?:precisa|necessita)\s+de\s+prazo)\b/.test(normalized);
}
