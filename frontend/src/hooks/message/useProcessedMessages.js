import { useMemo } from "react";

/**
 * Возвращает ключ даты (YYYY-MM-DD) для группировки сообщений по дням
 */
function getDateKey(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Хук для обработки и преобразования сообщений в формат для отображения
 * Преобразует сырые сообщения из API в формат, понятный компонентам сообщений
 * Добавляет разделители дат (Сегодня, Вчера, 6 марта и т.д.)
 */
export function useProcessedMessages({
  messages,
  isGroupChat,
  activeConversation,
  formatTime,
  formatDateHeader,
  language = "ru",
  t,
  currentAgentName = null, // Имя персонажа для одиночного чата (для копирования и отображения)
}) {
  const visibleMessages = useMemo(() => {
    if (!messages || messages.length === 0) return [];

    const processedMessages = messages.map((msg) => ({
      id: msg.id,
      type: msg.is_from_user ? "right" : "left",
      text: msg.content,
      time: formatTime(msg.created_at),
      created_at: msg.created_at,
      read: true, // Пока все сообщения считаем прочитанными
      // Для групповых чатов — agent_name из сообщения; для одиночного — имя текущего персонажа
      agentName: !msg.is_from_user
        ? (isGroupChat ? msg.agent_name : currentAgentName)
        : null,
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

    // Вставляем разделители дат между сообщениями разных дней
    const result = [];
    let lastDateKey = "";

    for (const msg of processedMessages) {
      const dateKey = getDateKey(msg.created_at);
      if (dateKey && dateKey !== lastDateKey) {
        const dateLabel = formatDateHeader ? formatDateHeader(msg.created_at, language) : "";
        if (dateLabel) {
          result.push({
            id: `day-${msg.id}`,
            type: "day-separator",
            text: dateLabel,
          });
        }
        lastDateKey = dateKey;
      }
      result.push(msg);
    }

    return result;

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
    formatDateHeader,
    language,
    t,
    currentAgentName,
  ]);

  return { visibleMessages };
}

