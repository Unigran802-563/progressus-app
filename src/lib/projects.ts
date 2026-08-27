import { supabase } from '@/lib/supabase';
import type {
  CreateProjectData,
  Project,
  ProjectMember,
  UpdateProjectData,
} from '@/types';

type ProjectRow = {
  id_projeto: string;
  nome: string;
  descricao: string | null;
  created_at: string;
  arquivado_em: string | null;
};

type ProjectMemberRow = {
  id_projeto: string;
  id_usuario: string;
  papel: ProjectMember['role'];
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

function mapProjectMember(row: ProjectMemberRow): ProjectMember {
  return {
    projectId: row.id_projeto,
    userId: row.id_usuario,
    role: row.papel,
  };
}

export async function listProjects(
  options: ListProjectsOptions = {},
): Promise<Project[]> {
  const { includeArchived = false } = options;

  let query = supabase
    .from('projeto')
    .select('id_projeto, nome, descricao, created_at, arquivado_em');

  if (!includeArchived) {
    query = query.is('arquivado_em', null);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ProjectRow[]).map(mapProject);
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
