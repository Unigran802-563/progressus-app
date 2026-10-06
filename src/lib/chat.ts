import { supabase } from "@/lib/supabase";
import type {
  Chat,
  ChatMessage,
  ChatParticipant,
  ChatFile,
} from "@/types/chat";

export async function getOrCreateProjectChat(projectId: string): Promise<Chat> {
  const { data, error } = await supabase.rpc("get_or_create_project_chat", {
    p_project_id: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Não foi possível obter o chat do projeto.");
  }

  return data as Chat;
}

export async function getOrCreatePrivateChat(
  projectId: string,
  otherUserId: string,
): Promise<Chat> {
  const { data, error } = await supabase.rpc(
    "get_or_create_private_chat",
    {
      p_project_id: projectId,
      p_other_user_id: otherUserId,
    },
  );

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Não foi possível obter o chat privado.");
  }

  return data as Chat;
}

export async function listChatMessages(chatId: string): Promise<ChatMessage[]> {
  const { data, error } = await supabase
    .from("mensagem")
    .select(
      `
      id_mensagem,
      id_chat,
      id_usuario,
      conteudo,
      data_hora,
      arquivo (
        id_arquivo,
        nome,
        tipo,
        tamanho,
        caminho
      )
    `,
    )
    .eq("id_chat", chatId)
    .order("data_hora", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  console.log("MENSAGENS COM ARQUIVOS:", data);

  return (
    (data ?? []) as Array<
      ChatMessage & {
        arquivo?: ChatFile[];
      }
    >
  ).map((message) => ({
    ...message,
    arquivos: message.arquivo ?? [],
  }));
}

export async function sendChatMessage(
  chatId: string,
  userId: string,
  content: string,
): Promise<ChatMessage> {
  const message = content.trim();

  if (!message) {
    throw new Error("Digite uma mensagem.");
  }

  const { data, error } = await supabase
    .from("mensagem")
    .insert({
      id_chat: chatId,
      id_usuario: userId,
      conteudo: message,
    })
    .select(
      `
      id_mensagem,
      id_chat,
      id_usuario,
      conteudo,
      data_hora
    `,
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as ChatMessage;
}

export async function listChatParticipants(
  projectId: string,
): Promise<ChatParticipant[]> {
  const { data, error } = await supabase.rpc("list_project_members", {
    p_project_id: projectId,
  });

  if (error) {
    throw new Error(error.message);
  }

  const participants = (data ?? []) as Array<{
    id_usuario: string;
    nome: string;
    email: string;
    papel: string;
  }>;

  return participants.map((participant) => ({
    id_usuario: participant.id_usuario,
    nome: participant.nome,
    email: participant.email,
    papel: participant.papel,
  }));
}

export async function uploadChatFile(
  projectId: string,
  messageId: string,
  file: File,
): Promise<string> {
  const fileExtension = file.name.includes(".")
    ? file.name.split(".").pop()
    : "";

  const safeFileName = `${crypto.randomUUID()}${
    fileExtension ? `.${fileExtension}` : ""
  }`;

  const filePath = `projetos/${projectId}/mensagens/${messageId}/${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("arquivos")
    .upload(filePath, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: arquivoError } = await supabase.from("arquivo").insert({
    nome: file.name,
    tipo: file.type || null,
    tamanho: file.size,
    id_mensagem: messageId,
    caminho: filePath,
  });

  if (arquivoError) {
    throw new Error(arquivoError.message);
  }

  return filePath;
}
