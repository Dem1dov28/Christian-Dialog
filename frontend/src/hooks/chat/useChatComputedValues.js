import { useMemo } from "react";
import { getIconComponent } from "../../utils/iconUtils";
import { MdNotifications, MdStar } from "react-icons/md";

/**
 * Хук для вычисления различных значений для чата
 * Включает заголовки, плейсхолдеры, иконки, цвета и другие вычисляемые значения
 */
export function useChatComputedValues({
  activeConversation,
  conversations,
  currentAgent,
  currentAgentId,
  agents,
  translateAgent,
  isGroupChat,
  isChannelChat,
  canWriteChannel,
  language,
  promptsByLanguage,
  cyclingPromptIndex,
  t,
  EMPTY_CHAT_PROMPTS,
}) {
  // Название чата для модального окна очистки
  const clearChatModalChatName = useMemo(() => {
    if (!activeConversation) {
      return t("common.chat");
    }

    if (activeConversation.is_system_chat) {
      return activeConversation.title || t("chat.savedMessages");
    }

    if (activeConversation.is_group) {
      return activeConversation.title || t("chat.groupChat");
    }

    const translatedAgent = currentAgent ? translateAgent(currentAgent) : null;
    const baseName =
      translatedAgent?.name || currentAgent?.name || t("common.chat");
    const agentId = activeConversation.agent_id;

    if (!agentId || !Array.isArray(conversations)) {
      return baseName;
    }

    const agentConversations = conversations.filter(
      (conv) => conv.agent_id === agentId && !conv.is_group
    );

    if (agentConversations.length <= 1) {
      return baseName;
    }

    const sorted = agentConversations
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const idx = sorted.findIndex((conv) => conv.id === activeConversation.id);

    if (idx === -1) {
      return baseName;
    }

    return `${baseName} (${idx + 1})`;
  }, [activeConversation, conversations, currentAgent, translateAgent, t]);

  // Иконка агента для модального окна очистки
  const clearChatModalAgentIcon = useMemo(() => {
    if (!activeConversation || activeConversation.is_system_chat) {
      return null;
    }

    if (activeConversation.is_group) {
      return activeConversation.group_avatar || "group";
    }

    return currentAgent?.icon_name || null;
  }, [activeConversation, currentAgent]);

  // Цвет агента для модального окна очистки
  const clearChatModalAgentColor = useMemo(() => {
    if (!activeConversation) {
      return "purple-500";
    }

    if (activeConversation.is_system_chat) {
      return "gray-500";
    }

    if (activeConversation.is_group) {
      return "purple-500";
    }

    const cc = currentAgent?.color_class || "purple-500";
    return (
      cc.replace(/^bg-/, "").replace(/dark:bg-/, "").split(" ")[0] || "purple-500"
    );
  }, [activeConversation, currentAgent]);

  // Изображение агента для модального окна очистки
  const clearChatModalAgentImage = useMemo(
    () =>
      currentAgent?.image_url || currentAgent?.avatar_url || null,
    [currentAgent]
  );

  // Плейсхолдер для поля ввода сообщения
  const messagePlaceholder = useMemo(() => {
    if (isChannelChat) {
      return canWriteChannel
        ? t("chat.channelOwnerPlaceholder")
        : t("chat.channelReadOnlyPlaceholder");
    }
    return t("chat.typeMessage");
  }, [isChannelChat, canWriteChannel, t]);

  // Пустое состояние промпта
  const emptyStatePrompt = useMemo(() => {
    if (promptsByLanguage.length > 0) {
      return promptsByLanguage[cyclingPromptIndex % promptsByLanguage.length];
    }
    return language === "ru"
      ? "Начните новый диалог — чат ждёт ваше сообщение."
      : "Start a new dialogue—the chat is waiting for your message.";
  }, [promptsByLanguage, cyclingPromptIndex, language]);

  // Имена агентов группы
  const groupAgentNames = useMemo(() => {
    console.log("[useChatComputedValues] Computing groupAgentNames:", {
      isGroupChat,
      group_agent_ids: activeConversation?.group_agent_ids,
      group_agent_ids_length: activeConversation?.group_agent_ids?.length,
      conversationId: activeConversation?.id
    });
    
    if (!isGroupChat || !activeConversation?.group_agent_ids) {
      return "";
    }

    const agentNames = activeConversation.group_agent_ids
      .map((agentId) => {
        // Сначала ищем в массиве agents, если он передан
        let agent = null;
        if (agents && Array.isArray(agents)) {
          agent = agents.find((a) => a.id === agentId);
        }
        // Если не нашли, ищем в conversations
        if (!agent) {
          agent = conversations
            .map((c) => c.agent)
            .find((a) => a?.id === agentId);
        }
        if (agent) {
          const translatedAgent = translateAgent(agent);
          return translatedAgent.name;
        }
        return `Агент ${agentId}`;
      })
      .join(", ");

    return agentNames;
  }, [
    isGroupChat,
    activeConversation?.group_agent_ids,
    agents,
    conversations,
    translateAgent,
  ]);

  // Динамический заголовок чата
  const chatTitle = useMemo(() => {
    if (!activeConversation) {
      return t("chat.selectChat");
    }

    // Проверяем, является ли это системным чатом
    if (activeConversation.is_system_chat) {
      return activeConversation.title || t("chat.savedMessages");
    }

    if (isChannelChat) {
      return (
        activeConversation.title ||
        t("chat.channelTitleFallback")
      );
    }

    if (isGroupChat) {
      return activeConversation.title || t("chat.groupChat");
    }

    if (!currentAgent) {
      return t("chat.selectAgent");
    }

    // Если у разговора есть сохраненное название, используем его
    if (activeConversation.title && activeConversation.title.trim()) {
      return activeConversation.title;
    }

    // Находим все разговоры с этим агентом
    const agentConversations = conversations.filter(
      (conv) => conv.agent_id === currentAgentId
    );

    const translatedAgent = translateAgent(currentAgent);
    
    // Проверяем, является ли название стандартным "Чат с ..." или "Chat with ..."
    const isDefaultTitle = activeConversation.title && (
      activeConversation.title.startsWith("Чат с ") || 
      activeConversation.title.startsWith("Chat with ")
    );

    if (activeConversation.title && activeConversation.title.trim() && !isDefaultTitle) {
      return activeConversation.title;
    }

    if (agentConversations.length <= 1) {
      return translatedAgent.name;
    }

    // Находим индекс текущего разговора среди всех разговоров с агентом
    // Номера чатов определяются по времени создания (фиксированные номера)
    // Используем ту же логику, что и в Sidebar: сортировка по возрастанию времени создания
    const sortedConversations = agentConversations.sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    const conversationIndex = sortedConversations.findIndex(
      (conv) => conv.id === activeConversation.id
    );

    const title = `${translatedAgent.name} (${conversationIndex + 1})`;

    return title;
  }, [
    activeConversation,
    isGroupChat,
    currentAgent,
    currentAgentId,
    conversations,
    translateAgent,
    isChannelChat,
    t,
  ]);

  return {
    clearChatModalChatName,
    clearChatModalAgentIcon,
    clearChatModalAgentColor,
    clearChatModalAgentImage,
    messagePlaceholder,
    emptyStatePrompt,
    groupAgentNames,
    chatTitle,
  };
}


