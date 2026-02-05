import { useCallback } from "react";
import apiClient from "../../services/api";
import { useAgents } from "../../contexts/AgentsContext";

/**
 * Хук для обработчиков модальных окон чата
 */
export function useChatModalHandlers({
  onToggleRightPanel,
  setIsReportModalOpen,
  setIsClearChatModalOpen,
  activeConversation,
  messages,
  clearConversationMessages,
  onDeleteChat,
  activeChatId,
  isAuthenticated,
  systemChat,
  selectConversation,
  onChatSelect,
  showError,
  showSuccess,
  t,
}) {
  const { getAgent } = useAgents();

  /**
   * Обработчик показа профиля (открывает правую панель)
   */
  const handleShowProfile = useCallback(() => {
    if (onToggleRightPanel) {
      onToggleRightPanel();
    }
  }, [onToggleRightPanel]);

  /**
   * Обработчик открытия модального окна жалобы
   */
  const handleOpenReportModal = useCallback(() => {
    setIsReportModalOpen(true);
  }, [setIsReportModalOpen]);


  /**
   * Обработчик очистки истории чата
   */
  const handleClearHistory = useCallback(() => {
    if (!activeConversation?.id) {
      showError(t("chat.noChatToClear"));
      return;
    }

    if (!messages || messages.length === 0) {
      showError(t("chat.noMessages"));
      return;
    }

    setIsClearChatModalOpen(true);
  }, [
    activeConversation?.id,
    messages,
    setIsClearChatModalOpen,
    showError,
    t,
  ]);

  /**
   * Обработчик подтверждения очистки истории
   */
  const handleConfirmClearHistory = useCallback(async () => {
    if (!activeConversation?.id) {
      showError(t("chat.noChatToClear"));
      return;
    }

    try {
      await clearConversationMessages(activeConversation.id);
      showSuccess(t("chat.historyCleared"));
      setIsClearChatModalOpen(false);
    } catch (error) {
      console.error("Clear chat error:", error);
      const errorDetail =
        error?.message ||
        error?.response?.data?.detail ||
        error?.response?.data?.message ||
        "";

      if (errorDetail) {
        showError(`${t("chat.clearHistoryError")}: ${errorDetail}`);
      } else {
        showError(t("chat.clearHistoryError"));
      }
    }
  }, [
    activeConversation?.id,
    clearConversationMessages,
    setIsClearChatModalOpen,
    showError,
    showSuccess,
    t,
  ]);

  /**
   * Обработчик закрытия модального окна очистки истории
   */
  const handleCloseClearChatModal = useCallback(() => {
    setIsClearChatModalOpen(false);
  }, [setIsClearChatModalOpen]);

  /**
   * Обработчик удаления чата
   */
  const handleDeleteChat = useCallback(() => {
    if (!activeConversation?.id) {
      showError(t("chat.noChatToDelete"));
      return;
    }

    if (!isAuthenticated) {
      showError(t("chat.needLogin"));
      return;
    }

    // Вызываем функцию из пропсов для открытия модального окна
    if (onDeleteChat) {
      const conversationId = activeConversation.id;
      const agentId = activeConversation.agent_id;
      const chatId = activeChatId;
      onDeleteChat({ chatId, agentId, conversationId });
    }
  }, [
    activeConversation?.id,
    activeConversation?.agent_id,
    activeChatId,
    isAuthenticated,
    onDeleteChat,
    showError,
    t,
  ]);

  /**
   * Обработчик открытия сохраненных сообщений
   */
  const handleSavedMessages = useCallback(async () => {

    if (systemChat && onChatSelect) {
      console.log("Opening Saved Messages chat:", systemChat);
      try {
        await selectConversation(systemChat.id);
        console.log("selectConversation completed");
        onChatSelect(systemChat.id);
        console.log("onChatSelect called");
      } catch (error) {
        console.error("Error in handleSavedMessages:", error);
      }
    } else {
      console.log("System chat not available or onChatSelect not provided");
      console.log("systemChat available:", !!systemChat);
      console.log("onChatSelect available:", !!onChatSelect);
    }
    console.log("=== handleSavedMessages END ===");
  }, [systemChat, onChatSelect, selectConversation]);

  /**
   * Обработчик закрытия модального окна жалобы
   */
  const handleCloseReportModal = useCallback(() => {
    setIsReportModalOpen(false);
  }, [setIsReportModalOpen]);


  /**
   * Обработчик отправки жалобы
   */
  const handleSubmitReport = useCallback(
    async (reportData) => {
      try {
        // Определяем правильный ID чата (для групповых чатов он может быть строкой "group-123")
        let chatIdToSend = activeChatId;

        // Если есть activeConversation и в нем есть real_id (для групповых чатов), используем его
        if (activeConversation?.real_id) {
          chatIdToSend = activeConversation.real_id;
        } else if (typeof activeChatId === "string" && activeChatId.startsWith("group-")) {
          // Fallback: пробуем извлечь числовой ID из строки
          const numericPart = activeChatId.replace("group-", "");
          const parsedId = parseInt(numericPart, 10);
          if (!isNaN(parsedId)) {
            chatIdToSend = parsedId;
          }
        }

        // Подготавливаем текст жалобы
        let reportText = reportData.description;

        // Если это групповой чат, добавляем информацию о составе группы
        if (activeConversation?.is_group) {
          const agentIds = activeConversation.group_agent_ids || [];
          const agentNames = agentIds
            .map((id) => {
              const agent = getAgent(id);
              return agent ? agent.name : `Agent ${id}`;
            })
            .filter(Boolean)
            .join(", ");

          reportText += `\n\n[Информация о группе]\nЭто групповой чат.\nУчастники: ${agentNames}`;
        }

        // Отправляем жалобу через API
        await apiClient.createReport({
          text: reportText,
          category: reportData.category,
          chat_id: chatIdToSend,
        });

        // Показываем уведомление об успехе
        showSuccess(t("chat.complaintSent"));
      } catch (error) {
        console.error("Ошибка при отправке жалобы:", error);
        showError(t("chat.complaintError"));
      }
    },
    [activeChatId, activeConversation, showError, showSuccess, t, getAgent]
  );


  return {
    handleShowProfile,
    handleOpenReportModal,
    handleClearHistory,
    handleConfirmClearHistory,
    handleCloseClearChatModal,
    handleDeleteChat,
    handleSavedMessages,
    handleCloseReportModal,
    handleSubmitReport,
  };
}

