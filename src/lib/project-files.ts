import { supabase } from '@/lib/supabase';

export type ProjectFile = {
  id: string;
  name: string;
  type: string | null;
  size: number | null;
  path: string;
  source: 'project' | 'chat';
  messageId: string | null;
  createdAt: string;
};

type FileRow = {
  id_arquivo: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  caminho: string;
  id_projeto: string | null;
  id_mensagem: string | null;
  created_at?: string | null;
};

function mapFile(row: FileRow, source: ProjectFile['source']): ProjectFile {
  return {
    id: row.id_arquivo,
    name: row.nome,
    type: row.tipo,
    size: row.tamanho,
    path: row.caminho,
    source,
    messageId: row.id_mensagem,
    createdAt: row.created_at ?? new Date(0).toISOString(),
  };
}

export async function listProjectFiles(projectId: string): Promise<ProjectFile[]> {
  const { data: direct, error: directError } = await supabase
    .from('arquivo')
    .select('id_arquivo, nome, tipo, tamanho, caminho, id_projeto, id_mensagem, created_at')
    .eq('id_projeto', projectId)
    .order('created_at', { ascending: false });
  if (directError) throw new Error(directError.message);

  const { data: chats, error: chatsError } = await supabase
    .from('chat')
    .select('id_chat')
    .eq('id_projeto', projectId)
    .eq('tipo', 'grupo');
  if (chatsError) throw new Error(chatsError.message);

  const chatIds = (chats ?? []).map((chat) => chat.id_chat as string);
  let chatFiles: FileRow[] = [];
  if (chatIds.length) {
    const { data: messages, error: messagesError } = await supabase
      .from('mensagem')
      .select('id_mensagem')
      .in('id_chat', chatIds);
    if (messagesError) throw new Error(messagesError.message);

    const messageIds = (messages ?? []).map((message) => message.id_mensagem as string);
    if (messageIds.length) {
      const { data, error } = await supabase
        .from('arquivo')
        .select('id_arquivo, nome, tipo, tamanho, caminho, id_projeto, id_mensagem, created_at')
        .in('id_mensagem', messageIds)
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      chatFiles = (data ?? []) as FileRow[];
    }
  }

  return [
    ...(direct ?? []).map((row) => mapFile(row as FileRow, 'project')),
    ...chatFiles.map((row) => mapFile(row, 'chat')),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function uploadProjectFile(projectId: string, file: File): Promise<ProjectFile> {
  const safeName = `${crypto.randomUUID()}${file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''}`;
  const path = `projetos/${projectId}/diretos/${safeName}`;
  const { error: uploadError } = await supabase.storage.from('arquivos').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('arquivo')
    .insert({ nome: file.name, tipo: file.type || null, tamanho: file.size, id_projeto: projectId, caminho: path })
    .select('id_arquivo, nome, tipo, tamanho, caminho, id_projeto, id_mensagem, created_at')
    .single();
  if (error) throw new Error(error.message);
  return mapFile(data as FileRow, 'project');
}

export async function createProjectFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('arquivos').createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Não foi possível abrir o arquivo.');
  return data.signedUrl;
}
