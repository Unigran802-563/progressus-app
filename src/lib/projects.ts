import { supabase } from '@/lib/supabase';
import type {
  AccessibleProject,
  CreateProjectData,
  InviteRole,
  Project,
  ProjectInvite,
  ProjectMember,
  ProjectParticipant,
  UpdateProjectData,
} from '@/types';

type ProjectRow = {
  id_projeto: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  arquivado_em: string | null;
};

type AccessibleProjectRow = ProjectRow & {
  meu_papel: AccessibleProject['myRole'];
  id_proprietario: string;
  nome_proprietario: string;
};

type ProjectMemberRow = {
  id_projeto: string;
  id_usuario: string;
  papel: ProjectMember['role'];
};

type ProjectParticipantRow = {
  id_usuario: string;
  nome: string;
  email: string;
  papel: ProjectParticipant['role'];
};

type ProjectInviteRow = {
  token: string;
  expira_em: string;
  papel: InviteRole;
};

type ListProjectsOptions = {
  includeArchived?: boolean;
};

function mapProject(row: ProjectRow): Project {
  return {
    id: row.id_projeto,
    name: row.nome,
    description: row.descricao,
    createdAt: row.created_at,
    archivedAt: row.arquivado_em,
  };
}

function mapAccessibleProject(row: AccessibleProjectRow): AccessibleProject {
  return {
    ...mapProject(row),
    myRole: row.meu_papel,
    owner: {
      id: row.id_proprietario,
      name: row.nome_proprietario,
    },
  };
}

function mapProjectMember(row: ProjectMemberRow): ProjectMember {
  return {
    projectId: row.id_projeto,
    userId: row.id_usuario,
    role: row.papel,
  };
}

function mapProjectParticipant(row: ProjectParticipantRow): ProjectParticipant {
  return {
    userId: row.id_usuario,
    name: row.nome,
    email: row.email,
    role: row.papel,
  };
}

export async function listAccessibleProjects(
  options: ListProjectsOptions = {},
): Promise<AccessibleProject[]> {
  const { includeArchived = false } = options;

  const { data, error } = await supabase.rpc('list_accessible_projects', {
    p_incluir_arquivados: includeArchived,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as AccessibleProjectRow[]).map(mapAccessibleProject);
}

export async function listProjects(
  options: ListProjectsOptions = {},
): Promise<Project[]> {
  const projects = await listAccessibleProjects(options);

  return projects.map(
    ({ myRole: _myRole, owner: _owner, ...project }) => project,
  );
}

export async function getProject(projectId: string): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projeto')
    .select('id_projeto, nome, descricao, created_at, arquivado_em')
    .eq('id_projeto', projectId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapProject(data as ProjectRow) : null;
}

export async function getProjectMember(
  projectId: string,
  userId: string,
): Promise<ProjectMember | null> {
  const { data, error } = await supabase
    .from('usuario_projeto')
    .select('id_projeto, id_usuario, papel')
    .eq('id_projeto', projectId)
    .eq('id_usuario', userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapProjectMember(data as ProjectMemberRow) : null;
}

export async function listProjectParticipants(
  projectId: string,
): Promise<ProjectParticipant[]> {
  const { data, error } = await supabase.rpc('list_project_members', {
    p_project_id: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ProjectParticipantRow[]).map(mapProjectParticipant);
}

export async function createProject(
  input: CreateProjectData,
): Promise<Project> {
  const name = input.name.trim();
  const description = input.description?.trim() || null;

  if (!name) {
    throw new Error('Informe o nome do projeto.');
  }

  const { data, error } = await supabase.rpc('create_project', {
    p_nome: name,
    p_descricao: description,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapProject(data as ProjectRow);
}

export async function updateProject(
  projectId: string,
  input: UpdateProjectData,
): Promise<Project> {
  const updateData: { nome?: string; descricao?: string | null } = {};

  if (input.name !== undefined) {
    const name = input.name.trim();

    if (!name) {
      throw new Error('Informe o nome do projeto.');
    }

    updateData.nome = name;
  }

  if (input.description !== undefined) {
    updateData.descricao = input.description?.trim() || null;
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('Nenhuma alteração foi informada.');
  }

  const { data, error } = await supabase
    .from('projeto')
    .update(updateData)
    .eq('id_projeto', projectId)
    .select('id_projeto, nome, descricao, created_at, arquivado_em')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapProject(data as ProjectRow);
}

export async function archiveProject(projectId: string): Promise<Project> {
  const { data, error } = await supabase.rpc('archive_project', {
    p_project_id: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapProject(data as ProjectRow);
}

export async function createProjectInvite(
  projectId: string,
  role: InviteRole,
): Promise<ProjectInvite> {
  const { data, error } = await supabase.rpc('create_project_invite', {
    p_project_id: projectId,
    p_papel: role,
  });

  if (error) {
    throw new Error(error.message);
  }

  const invite = (data as ProjectInviteRow[] | null)?.[0];

  if (!invite) {
    throw new Error('Não foi possível gerar o convite.');
  }

  return {
    token: invite.token,
    expiresAt: invite.expira_em,
    role: invite.papel,
  };
}

export async function acceptProjectInvite(token: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_project_invite', {
    p_token: token.trim(),
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as string;
}
