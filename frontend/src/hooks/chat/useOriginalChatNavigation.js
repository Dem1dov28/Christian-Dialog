import { useCallback } from "react";

/**
 * Хук для навигации к оригинальному чату из системного чата
 * Обрабатывает клики по ссылкам на оригинальные сообщения
 */
export function useOriginalChatNavigation({
  conversations,
  agents,
  selectConversation,
  onChatSelect,
  scrollToMessageLocal,
  showError,
  t,
}) {
  const handleOriginalChatClick = useCallback(
    async (originalChatName, originalAgentName, originalMessageId, originalChatId) => {
      try {
        console.log(
          "Navigating to original chat:",
          originalChatName,
          originalAgentName,
          originalMessageId,
          originalChatId
        );

        // Если есть original_chat_id, используем его для поиска чата
        let targetConversation = null;

        console.log(
          "Available conversations:",
          conversations.map((conv) => ({
            id: conv.id,
            title: conv.title,
            agent_id: conv.agent_id,
          }))
        );

        if (originalChatId) {
          console.log(
            "Searching by original_chat_id:",
            originalChatId,
            "type:",
            typeof originalChatId
          );
          // Попробуем найти как по строке, так и по числу
          targetConversation = conversations.find(
            (conv) =>
              conv.id === originalChatId ||
              conv.id === parseInt(originalChatId) ||
              conv.id === String(originalChatId)
          );
          console.log("Found by ID:", targetConversation);

          // Если не найден, попробуем более детальный поиск
          if (!targetConversation) {
            console.log("Detailed search - checking all conversations:");
            conversations.forEach((conv) => {
              console.log(
                `Conv ID: ${
                  conv.id
                } (${typeof conv.id}) vs Original: ${originalChatId} (${typeof originalChatId})`
              );
            });
          }
        }

        // Если не найден по ID, ищем по названию (fallback)
        if (!targetConversation) {
          console.log("Searching by title:", originalChatName);

          // Улучшенный поиск по названию чата
          // Извлекаем имя агента и номер из originalChatName (например, "Платон (2)")
          const match = originalChatName.match(/^(.+?)\s*\((\d+)\)$/);
          if (match) {
            const agentName = match[1].trim();
            const chatNumber = parseInt(match[2]);

            console.log(
              "Extracted agent name:",
              agentName,
              "chat number:",
              chatNumber
            );

            // Ищем все чаты с этим агентом
            const agentConversations = conversations.filter((conv) => {
              // Получаем агента по agent_id
              const agent = agents.find((a) => a.id === conv.agent_id);
              return agent && agent.name === agentName;
            });

            console.log("Found agent conversations:", agentConversations);

            if (agentConversations.length > 0) {
              // Сортируем по времени создания (как в chatTitle логике)
              const sortedConversations = agentConversations.sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
              );

              console.log("Sorted conversations:", sortedConversations);

              // Выбираем чат по номеру (chatNumber - 1, так как номера начинаются с 1)
              if (chatNumber <= sortedConversations.length) {
                targetConversation = sortedConversations[chatNumber - 1];
                console.log("Found conversation by number:", targetConversation);
              }
            }
          }

          // Если не найден по улучшенной логике, пробуем точное совпадение
          if (!targetConversation) {
            const matchingConversations = conversations.filter(
              (conv) => conv.title === originalChatName
            );
            console.log(
              "All matching conversations (exact match):",
              matchingConversations
            );

            if (matchingConversations.length > 0) {
              targetConversation = matchingConversations[0];
              console.log("Found by exact title match:", targetConversation);
            }
          }
        }

        // Дополнительная проверка: если у нас есть original_message_id,
        // можем попытаться найти чат, содержащий это сообщение
        if (targetConversation && originalMessageId) {
          console.log(
            "Verifying message exists in target conversation:",
            originalMessageId
          );
          // Здесь можно добавить проверку, что сообщение действительно существует в найденном чате
          // Но пока оставим как есть, так как это требует дополнительного API вызова
        }

        if (targetConversation) {
          console.log("Found target conversation:", targetConversation);

          // Переключаемся на найденный чат
          await selectConversation(targetConversation.id);

          // Уведомляем родительский компонент о смене чата
          if (onChatSelect) {
            onChatSelect(targetConversation.id);
          }

          // Если есть original_message_id, пытаемся прокрутить к сообщению
          if (originalMessageId) {
            console.log("Found original message ID:", originalMessageId);

            // Ждем немного, чтобы чат успел загрузиться
            setTimeout(() => {
              scrollToMessageLocal(originalMessageId);
            }, 500);
          }
        } else {
          console.log("Conversation not found:", originalChatName);
          showError(t("chat.chatNotFound", { name: originalChatName }));
        }
      } catch (error) {
        console.error("Error navigating to original chat:", error);
        showError(t("chat.goToChatError"));
      }
    },
    [
      conversations,
      agents,
      selectConversation,
      onChatSelect,
      scrollToMessageLocal,
      showError,
      t,
    ]
  );

  return { handleOriginalChatClick };
}

