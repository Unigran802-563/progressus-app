export type ChatType = 'grupo' | 'individual';

export type Chat = {
  id_chat: string;
  id_projeto: string | null;
  tipo: ChatType;
};

export type ChatFile = {
  id_arquivo: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  caminho: string;
};

export type ChatMessage = {
  id_mensagem: string;
  id_chat: string;
  id_usuario: string | null;
  conteudo: string | null;
  data_hora: string;
  arquivos?: ChatFile[];
  menções?: ChatMention[];
};

export type ChatParticipant = {
  id_usuario: string;
  nome: string;
  email: string;
  papel: string;
};

export type ChatMentionDraft = {
  id_usuario: string | null;
  tipo: "usuario" | "todos" | "ia";
  texto: string;
  inicio: number;
  fim: number;
};

export type ChatMention = {
  id_mencao: string;
  id_usuario: string | null;
  tipo: "usuario" | "todos" | "ia";
  texto: string | null;
  inicio: number | null;
  fim: number | null;
};