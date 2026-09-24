export type UserRole = 'student' | 'professional' | 'admin';

export type LoginFormData = {
  email: string;
  password: string;
};

export type RegisterFormData = {
  name: string;
  email: string;
  password: string;
};

export type ForgotPasswordFormData = {
  email: string;
};

export type UserProfile = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: string;
};

export type AuthResponse = {
  success: boolean;
  message: string;
};
export type ProjectRole = 'owner' | 'member' | 'viewer';

export type Project = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  archivedAt: string | null;
};

export type ProjectMember = {
  projectId: string;
  userId: string;
  role: ProjectRole;
};

export type CreateProjectData = {
  name: string;
  description?: string;
};

export type UpdateProjectData = {
  name?: string;
  description?: string | null;
};
export type InviteRole = 'member' | 'viewer';

export type ProjectOwner = {
  id: string;
  name: string;
};

export type AccessibleProject = Project & {
  myRole: ProjectRole;
  owner: ProjectOwner;
};

export type ProjectParticipant = {
  userId: string;
  name: string;
  email: string;
  role: ProjectRole;
};

export type ProjectInvite = {
  token: string;
  expiresAt: string;
  role: InviteRole;
};
export type TarefaStatus = {
  id_status: string;
  id_projeto: string;
  nome: string;
  ordem: number;
  data_criacao?: string;
};

export type TarefaPrioridade = 'Baixa' | 'Media' | 'Alta';

export type Tarefa = {
  id_tarefa: string;
  id_projeto: string;
  id_status: string | null;
  nome: string;
  descricao: string | null;
  prioridade: TarefaPrioridade | string | null;
  created_at: string;
};

export type CriarTarefaData = {
  id_projeto: string;
  id_status: string;
  nome: string;
  descricao?: string;
  prioridade?: TarefaPrioridade;
};

export type AtualizarTarefaData = {
  id_status?: string;
  nome?: string;
  descricao?: string;
  prioridade?: TarefaPrioridade;
};
