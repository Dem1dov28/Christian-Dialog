import { useMemo } from "react";

/**
 * Хук для обработки и преобразования сообщений в формат для отображения
 * Преобразует сырые сообщения из API в формат, понятный компонентам сообщений
 */
export function useProcessedMessages({
  messages,
  isGroupChat,
  activeConversation,
  formatTime,
  t,
}) {
  const visibleMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const processedMessages = messages.map((msg) => ({
      id: msg.id,
      type: msg.is_from_user ? "right" : "left",
      text: msg.content,
      time: formatTime(msg.created_at),
      read: true, // Пока все сообщения считаем прочитанными
      // Для групповых чатов добавляем информацию об агенте
      agentName: isGroupChat && !msg.is_from_user ? msg.agent_name : null,
      agentId: isGroupChat && !msg.is_from_user ? msg.agent_id : null,
      // Для системного чата добавляем информацию об оригинальном чате
      originalChatName: activeConversation?.is_system_chat
        ? msg.original_chat_name
        : null,
      originalAgentName: activeConversation?.is_system_chat
        ? msg.original_agent_name
        : null,
      original_message_id: activeConversation?.is_system_chat
        ? msg.original_message_id
        : null,
      original_chat_id: activeConversation?.is_system_chat
        ? msg.original_chat_id
        : null,
      // Добавляем информацию о состоянии сообщения для анимаций
      // Для системного чата используем упрощенное состояние
      state: activeConversation?.is_system_chat
        ? msg.state === "sending"
          ? "sending"
          : "received"
        : msg.state || "received",
      is_thinking: msg.is_thinking || false,
      estimated_duration: msg.estimated_duration || 2000,
      // Данные о цитируемом сообщении (reply) - автоматически извлекаются из HTML в RightMessage
      reply: msg.reply_to
        ? {
            authorName:
              msg.reply_to.author_name ||
              msg.reply_to.agent_name ||
              t("chat.user"),
            text: msg.reply_to.content || "",
            // КРИТИЧНО: Для системного чата используем original_message_id, если есть
            messageId: msg.reply_to.original_message_id || msg.reply_to.id,
          }
        : null,
      // Файловые вложения
      file_attachments: msg.file_attachments || [],
    }));

    return processedMessages;

    // Логируем для отладки
    if (activeConversation?.is_system_chat && messages.length > 0) {
      console.log(
        "System chat messages with original data:",
        messages.map((msg) => ({
          id: msg.id,
          content: msg.content.substring(0, 50) + "...",
          original_message_id: msg.original_message_id,
          original_chat_id: msg.original_chat_id,
          original_chat_name: msg.original_chat_name,
          original_agent_name: msg.original_agent_name,
          agent_id: msg.agent_id,
          agent_name: msg.agent_name,
        }))
      );
    }
  }, [
    messages,
    isGroupChat,
    activeConversation?.is_system_chat,
    activeConversation?.id,
    formatTime,
    t,
  ]);

  return { visibleMessages };
}

