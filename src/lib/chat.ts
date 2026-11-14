import { supabase } from "@/lib/supabase";

import type {
  Chat,
  ChatMessage,
  ChatParticipant,
  ChatFile,
  ChatMention,
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
  projectIdOrOtherUserId: string,
  maybeOtherUserId?: string,
): Promise<Chat> {
  const otherUserId = maybeOtherUserId ?? projectIdOrOtherUserId;

  const { data, error } = await supabase.rpc("get_or_create_private_chat", {
    p_other_user_id: otherUserId,
  });

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Não foi possível obter o chat privado.");
  }

  return data as Chat;
}

export type PrivateChatSummary = {
  chatId: string;
  otherUserId: string;
  otherUserName: string;
};

export async function listPrivateChats(
  currentUserId: string,
): Promise<PrivateChatSummary[]> {
  const { data: userChats, error: userChatsError } = await supabase
    .from("chat_usuario")
    .select("id_chat")
    .eq("id_usuario", currentUserId);

  if (userChatsError) {
    throw new Error(userChatsError.message);
  }

  const chatIds = [...new Set((userChats ?? []).map((item) => item.id_chat))];

  if (chatIds.length === 0) return [];

  const { data: privateChats, error: privateChatsError } = await supabase
    .from("chat")
    .select("id_chat, id_projeto")
    .in("id_chat", chatIds)
    .eq("tipo", "individual");

  if (privateChatsError) {
    throw new Error(privateChatsError.message);
  }

  if (!privateChats?.length) return [];

  const orderedChats = [...privateChats].sort((a, b) => {
    const projectOrder =
      Number(a.id_projeto === null) - Number(b.id_projeto === null);

    return projectOrder || a.id_chat.localeCompare(b.id_chat);
  });

  const privateChatIds = orderedChats.map((chat) => chat.id_chat);

  const { data: participants, error: participantsError } = await supabase
    .from("chat_usuario")
    .select("id_chat, id_usuario")
    .in("id_chat", privateChatIds);

  if (participantsError) {
    throw new Error(participantsError.message);
  }

  if (!participants?.length) return [];

  const chatOrder = new Map(privateChatIds.map((id, index) => [id, index]));

  const otherParticipants = participants
    .filter((participant) => participant.id_usuario !== currentUserId)
    .sort(
      (a, b) =>
        (chatOrder.get(a.id_chat) ?? Infinity) -
        (chatOrder.get(b.id_chat) ?? Infinity),
    );

  const uniqueParticipants = new Map<
    string,
    { id_chat: string; id_usuario: string }
  >();

  for (const participant of otherParticipants) {
    if (!uniqueParticipants.has(participant.id_usuario)) {
      uniqueParticipants.set(participant.id_usuario, participant);
    }
  }

  const otherUserIds = [...uniqueParticipants.keys()];

  if (otherUserIds.length === 0) return [];

  const { data: users, error: usersError } = await supabase.rpc(
    "get_private_chat_user_names",
    {
      p_user_ids: otherUserIds,
    },
  );

  if (usersError) {
    throw new Error(usersError.message);
  }

  const userMap = new Map<string, string>(
    (
      (users ?? []) as Array<{
        id_usuario: string;
        nome: string | null;
      }>
    ).map((item) => [item.id_usuario, item.nome ?? ""]),
  );

  return [...uniqueParticipants.values()].map((participant) => ({
    chatId: participant.id_chat,
    otherUserId: participant.id_usuario,
    otherUserName: userMap.get(participant.id_usuario)?.trim() || "Usuário",
  }));
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
      ),
      mensagem_mencao (
      id_mencao,
      id_usuario,
      tipo,
      texto,
      inicio,
      fim
      )
    `,
    )
    .eq("id_chat", chatId)
    .order("data_hora", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (
    (data ?? []) as Array<
      ChatMessage & {
        arquivo?: ChatFile[];
        mensagem_mencao?: ChatMention[];
      }
    >
  ).map((message) => ({
    ...message,
    arquivos: message.arquivo ?? [],
    menções: (message.mensagem_mencao ?? []) as ChatMention[],
  }));
}

export async function sendChatMessage(
  chatId: string,
  userId: string,
  content: string,
): Promise<ChatMessage> {
  const message = content.trim();

  const { data, error } = await supabase
    .from("mensagem")
    .insert({
      id_chat: chatId,
      id_usuario: userId,
      conteudo: message || null,
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

export async function updateChatMessage(
  messageId: string,
  content: string,
): Promise<ChatMessage> {
  const message = content.trim();
  if (!message) throw new Error("A mensagem não pode ficar vazia.");

  const { data, error } = await supabase
    .from("mensagem")
    .update({ conteudo: message })
    .eq("id_mensagem", messageId)
    .select("id_mensagem, id_chat, id_usuario, conteudo, data_hora")
    .single();

  if (error) throw new Error(error.message);
  return data as ChatMessage;
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("mensagem")
    .delete()
    .eq("id_mensagem", messageId);

  if (error) throw new Error(error.message);
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
  chatId: string,
  messageId: string,
  file: File,
): Promise<string> {
  const { data: chat, error: chatError } = await supabase
    .from("chat")
    .select("tipo, id_projeto")
    .eq("id_chat", chatId)
    .single();

  if (chatError || !chat) {
    throw new Error(
      chatError?.message ?? "Não foi possível identificar a conversa.",
    );
  }

  const fileExtension = file.name.includes(".")
    ? file.name.split(".").pop()
    : "";

  const safeFileName = `${crypto.randomUUID()}${
    fileExtension ? `.${fileExtension}` : ""
  }`;

  let filePath: string;

  if (chat.tipo === "individual") {
    filePath = `chats/${chatId}/mensagens/${messageId}/${safeFileName}`;
  } else if (chat.tipo === "grupo" && chat.id_projeto) {
    filePath = `projetos/${chat.id_projeto}/mensagens/${messageId}/${safeFileName}`;
  } else {
    throw new Error("Não foi possível identificar o destino do arquivo.");
  }

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

export type UnreadChatCounts = Record<string, number>;

export async function markChatMessagesAsRead(
  messageIds: string[],
  userId: string,
): Promise<void> {
  if (!messageIds.length) return;

  const records = messageIds.map((messageId) => ({
    id_mensagem: messageId,
    id_usuario: userId,
  }));

  const { error } = await supabase.from("mensagem_leitura").upsert(records, {
    onConflict: "id_mensagem,id_usuario",
    ignoreDuplicates: true,
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listUnreadChatCounts(
  chatIds: string[],
  userId: string,
): Promise<UnreadChatCounts> {
  const counts: UnreadChatCounts = {};

  for (const chatId of chatIds) {
    counts[chatId] = 0;
  }

  if (!chatIds.length) return counts;

  const { data: messages, error: messagesError } = await supabase
    .from("mensagem")
    .select("id_mensagem, id_chat")
    .in("id_chat", chatIds)
    .or(`id_usuario.is.null,id_usuario.neq.${userId}`);

  if (messagesError) {
    throw new Error(messagesError.message);
  }

  if (!messages?.length) return counts;

  const messageIds = messages.map((message) => message.id_mensagem);
  const readIds = new Set<string>();

  for (let i = 0; i < messageIds.length; i += 500) {
    const batch = messageIds.slice(i, i + 500);

    const { data: reads, error: readsError } = await supabase
      .from("mensagem_leitura")
      .select("id_mensagem")
      .eq("id_usuario", userId)
      .in("id_mensagem", batch);

    if (readsError) {
      throw new Error(readsError.message);
    }

    for (const read of reads ?? []) {
      readIds.add(read.id_mensagem);
    }
  }

  for (const message of messages) {
    if (!readIds.has(message.id_mensagem)) {
      counts[message.id_chat] = (counts[message.id_chat] ?? 0) + 1;
    }
  }

  return counts;
}
