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
  onToggleRightPanel,
  onOpenChatSearch,
  showError,
  showSuccess,
  t,
}) {
  // Обработчик клика по заголовку чата
  const handleHeaderClick = useCallback(
    (e) => {
      // Проверяем, что клик не по кнопке
      if (!e.target.closest("button")) {
        onToggleRightPanel?.();
      }
    },
    [onToggleRightPanel]
  );

  // Обработчик клика по кнопке меню (книга)
  const handleMenuBookClick = useCallback(
    (e) => {
      e.stopPropagation(); // Предотвращаем всплытие события
      onToggleRightPanel?.();
    },
    [onToggleRightPanel]
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

      try {
        setIsDialogueLoading(true);
        await continueGroupDialogue(activeConversation.id);
        showSuccess(t("chat.dialogueContinued"));
      } catch (error) {
        console.error("Failed to continue dialogue:", error);
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
      showError,
      showSuccess,
      t,
    ]
  );

  return {
    handleHeaderClick,
    handleMenuBookClick,
    handleSearchClick,
    handlePlayClick,
  };
}

