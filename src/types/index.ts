// Tipos do usuário
export interface Usuario {
  id_usuario: string;
  nome: string;
  email: string;
  senha?: string;
}

// Tipos do projeto
export interface Projeto {
  id_projeto: string;
  nome: string;
  descricao?: string;
  id_owner: string;
  status: 'active' | 'archived' | 'completed';
  data_criacao: string;
  data_atualizacao: string;
}

// Tipos de tarefa
export interface Tarefa {
  id_tarefa: string;
  id_projeto: string;
  titulo: string;
  descricao?: string;
  prioridade: 'baixa' | 'media' | 'alta';
  status: 'a_fazer' | 'em_progresso' | 'concluida';
  id_responsavel?: string;
  data_criacao: string;
  data_atualizacao: string;
}

// Tipos de mensagem
export interface Mensagem {
  id_mensagem: string;
  id_remetente: string;
  id_projeto?: string;
  id_destinatario?: string;
  conteudo: string;
  tipo: 'grupo' | 'direto';
  data_criacao: string;
}

// Tipos de notificação
export interface Notificacao {
  id_notificacao: string;
  id_usuario: string;
  tipo: string;
  titulo: string;
  corpo?: string;
  lida: boolean;
  data_criacao: string;
}

// Tipos de resposta da API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
