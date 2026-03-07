import { useCallback } from "react";

/**
 * Хук для управления обработчиками заголовка чата
 * Включает обработчики кликов по заголовку, кнопкам меню, поиска и воспроизведения диалога
 */
export function useChatHeaderHandlers({
  activeConversation,
  isLoading,
  setIsDialogueLoading,
  continueGroupDialogue,
  checkMessageLimit,
  setShowUpgradeModal,
  onShowAgentProfile,
  onOpenChatSearch,
  showError,
  showSuccess,
  t,
}) {
  // Обработчик клика по заголовку чата (при клике на аватар/имя — открывает карточку агента)
  const handleHeaderClick = useCallback(
    (e) => {
      if (!e.target.closest("button")) {
        onShowAgentProfile?.();
      }
    },
    [onShowAgentProfile]
  );

  // Обработчик клика по кнопке поиска
  const handleSearchClick = useCallback(
    (e) => {
      e.stopPropagation(); // Предотвращаем всплытие события
      // Открываем поиск по текущему чату
      if (onOpenChatSearch) {
        onOpenChatSearch();
      }
    },
    [onOpenChatSearch]
  );

  // Обработчик клика по кнопке воспроизведения диалога (только для групповых чатов)
  const handlePlayClick = useCallback(
    async (e) => {
      e.stopPropagation(); // Предотвращаем всплытие события

      if (!activeConversation?.is_group) {
        showError(t("chat.groupChatOnly"));
        return;
      }

      if (isLoading) {
        showError(t("chat.waitForSending"));
        return;
      }

      // Проверяем лимит сообщений перед продолжением диалога
      const canSend = await checkMessageLimit();
      if (!canSend) {
        setShowUpgradeModal(true);
        return;
      }

      try {
        setIsDialogueLoading(true);
        await continueGroupDialogue(activeConversation.id);
        showSuccess(t("chat.dialogueContinued"));
      } catch (error) {
        console.error("Failed to continue dialogue:", error);
        
        // Проверяем, является ли это ошибкой лимита сообщений
        const isMessageLimitError =
          error.status === 429 ||
          error.message?.includes("Message limit exceeded") ||
          error.message?.includes("limit exceeded");

        if (isMessageLimitError) {
          setShowUpgradeModal(true);
          return;
        }
        
        showError(t("chat.continueDialogueError"));
      } finally {
        setIsDialogueLoading(false);
      }
    },
    [
      activeConversation?.id,
      activeConversation?.is_group,
      isLoading,
      setIsDialogueLoading,
      continueGroupDialogue,
      checkMessageLimit,
      setShowUpgradeModal,
      showError,
      showSuccess,
      t,
    ]
  );

  return {
    handleHeaderClick,
    handleSearchClick,
    handlePlayClick,
  };
}

