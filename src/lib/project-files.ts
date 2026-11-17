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

export type TaskFile = ProjectFile & { taskId: string };

type FileRow = {
  id_arquivo: string;
  nome: string;
  tipo: string | null;
  tamanho: number | null;
  caminho: string;
  id_projeto: string | null;
  id_mensagem: string | null;
  created_at?: string | null;
  id_tarefa?: string | null;
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

export async function deleteProjectFile(file: ProjectFile): Promise<void> {
  const { error: storageError } = await supabase.storage.from('arquivos').remove([file.path]);
  if (storageError) throw new Error(storageError.message);

  const { error: rowError } = await supabase.from('arquivo').delete().eq('id_arquivo', file.id);
  if (rowError) throw new Error(rowError.message);
}

export const MAX_TASK_FILE_SIZE = 10 * 1024 * 1024;
const TASK_FILE_COLUMNS = 'id_arquivo, nome, tipo, tamanho, caminho, id_projeto, id_mensagem, id_tarefa, created_at';

function mapTaskFile(row: FileRow, taskId: string): TaskFile {
  if (!row?.id_arquivo || !row.caminho || row.id_tarefa !== taskId) {
    throw new Error('Não foi possível confirmar o vínculo do anexo com esta tarefa. Atualize a lista antes de tentar novamente.');
  }
  return { ...mapFile(row, 'project'), taskId: row.id_tarefa };
}

/** The signed response forces a download even when the storage URL is cross-origin. */
export async function createProjectFileDownloadUrl(path: string, name: string): Promise<string> {
  const { data, error } = await supabase.storage.from('arquivos').createSignedUrl(path, 60 * 10, { download: name });
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'Não foi possível gerar o link para baixar o arquivo.');
  return data.signedUrl;
}

export async function listTaskFiles(taskId: string): Promise<TaskFile[]> {
  if (!taskId.trim()) throw new Error('A tarefa precisa estar salva para carregar os anexos.');
  const { data, error } = await supabase
    .from('arquivo')
    .select(TASK_FILE_COLUMNS)
    .eq('id_tarefa', taskId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as FileRow[]).map((row) => mapTaskFile(row, taskId));
}

export async function uploadTaskFile(projectId: string, taskId: string, file: File): Promise<TaskFile> {
  if (!projectId.trim() || !taskId.trim()) throw new Error('Salve a tarefa em um projeto antes de anexar arquivos.');
  if (file.size > MAX_TASK_FILE_SIZE) throw new Error('O arquivo deve ter no máximo 10 MB.');
  const safeName = `${crypto.randomUUID()}${file.name.includes('.') ? `.${file.name.split('.').pop()}` : ''}`;
  const path = `projetos/${projectId}/tarefas/${taskId}/${safeName}`;
  const { error: uploadError } = await supabase.storage.from('arquivos').upload(path, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (uploadError) throw new Error(`Não foi possível enviar o arquivo: ${uploadError.message}`);

  const { data, error } = await supabase
    .from('arquivo')
    .insert({ nome: file.name, tipo: file.type || null, tamanho: file.size, id_projeto: projectId, id_tarefa: taskId, caminho: path })
    .select(TASK_FILE_COLUMNS)
    .single();
  if (error) {
    // Storage and the metadata table are not one transaction. Surface cleanup
    // failures instead of silently leaving an unlisted object in the bucket.
    let cleanupFailed = false;
    try {
      const { error: cleanupError } = await supabase.storage.from('arquivos').remove([path]);
      cleanupFailed = Boolean(cleanupError);
    } catch {
      cleanupFailed = true;
    }
    throw new Error(`Não foi possível registrar o anexo na tarefa: ${error.message}${cleanupFailed ? ' O arquivo enviado também não pôde ser removido do armazenamento; contate o suporte antes de reenviar.' : ''}`);
  }

  const row = data as FileRow | null;
  // Never manufacture taskId from the argument or announce success without a
  // persisted row identifying both its task and the actual uploaded object.
  if (!row || row.id_projeto !== projectId || row.caminho !== path) {
    // An ambiguous response may already have persisted metadata: do not remove
    // the storage object and leave a confirmed database row pointing nowhere.
    throw new Error('O arquivo foi enviado, mas não foi possível confirmar seu registro na tarefa. Atualize a lista antes de tentar novamente.');
  }
  return mapTaskFile(row, taskId);
}

export async function deleteTaskFile(file: TaskFile): Promise<void> {
  // Confirm the task-scoped record before deleting any storage object.
  const { data: row, error: lookupError } = await supabase
    .from('arquivo')
    .select('id_arquivo, caminho')
    .eq('id_arquivo', file.id)
    .eq('id_tarefa', file.taskId)
    .single();
  if (lookupError) throw new Error(lookupError.message);
  if (!row || row.caminho !== file.path) throw new Error('O anexo mudou ou já foi excluído. Atualize a lista antes de tentar novamente.');

  const { error: storageError } = await supabase.storage.from('arquivos').remove([file.path]);
  if (storageError) throw new Error(`Não foi possível excluir o arquivo: ${storageError.message}`);

  const { data: deleted, error: rowError } = await supabase
    .from('arquivo')
    .delete()
    .eq('id_arquivo', file.id)
    .eq('id_tarefa', file.taskId)
    .select('id_arquivo')
    .single();
  if (rowError || !deleted?.id_arquivo) {
    throw new Error(`O arquivo foi removido do armazenamento, mas não foi possível confirmar a exclusão do registro da tarefa. Atualize a lista e tente excluir o registro novamente.${rowError ? ` ${rowError.message}` : ''}`);
  }
}
