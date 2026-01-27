import { useCallback } from "react";

/**
 * Хук для обработчиков действий с сообщениями (reply, pin, unpin, bulk save)
 */
export function useMessageHandlers({
  messages,
  setReplyToMessage,
  activeConversation,
  pinMessageInChat,
  unpinMessageFromChat,
  isAuthenticated,
  scrollToMessageLocal,
  handleSave,
  selectedIds,
  clearSelection,
  loadMessages,
  updateMessagesForConversation,
  systemChat,
  pinnedMessagesArray,
  currentPinIndex,
  setCurrentPinIndex,
  highlightTimeoutRef,
  setHighlightedMessageId,
  ensureMessagesAfterPinnedLoaded,
  showError,
  showSuccess,
  t,
}) {

  /**
   * Обработчик ответа на сообщение
   */
  const handleReply = useCallback(
    (messageId) => {
      const message = messages.find((msg) => msg.id === messageId);
      if (message) {
        setReplyToMessage(message);
      }
    },
    [messages, setReplyToMessage]
  );

  /**
   * Обработчик закрепления сообщения
   */
  const handlePin = useCallback(
    async (messageId) => {
      if (!isAuthenticated) {
        showError(t("chat.needLogin"));
        return;
      }

      if (!activeConversation) return;

      try {
        await pinMessageInChat(activeConversation.id, messageId);
        showSuccess(t("chat.messagePinned"));
      } catch (error) {
        console.error("Pin error:", error);
        showError(t("chat.messagePinError") + ": " + error.message);
      }
    },
    [
      isAuthenticated,
      activeConversation,
      pinMessageInChat,
      showError,
      showSuccess,
      t,
    ]
  );

  /**
   * Обработчик открепления сообщения
   */
  const handleUnpin = useCallback(
    async (messageId) => {
      if (!activeConversation) return;

      try {
        await unpinMessageFromChat(activeConversation.id, messageId);
        showSuccess(t("chat.messageUnpinned"));
      } catch (error) {
        showError(t("chat.messageUnpinError"));
      }
    },
    [activeConversation, unpinMessageFromChat, showError, showSuccess, t]
  );

  /**
   * Обработчик массового сохранения сообщений
   */
  const handleBulkSave = useCallback(
    async (messageId = null) => {
      // Игнорируем messageId, используем selectedIds из замыкания
      if (!selectedIds.length) return;
      try {
        const results = await Promise.all(
          selectedIds.map((id) => handleSave(id, { silent: true }))
        );
        const savedCount = results.filter(Boolean).length;
        const alreadyCount = selectedIds.length - savedCount;
        if (savedCount > 0) {
          showSuccess(t("chat.savedCount", {
            saved: savedCount,
            already: alreadyCount
              ? t("chat.alreadySaved", { count: alreadyCount })
              : "",
          }));
        } else if (alreadyCount > 0) {
          showSuccess(t("chat.allAlreadySaved", { count: alreadyCount }));
        }

        // Обновляем Saved Messages после массового сохранения без полной перезагрузки
        if (systemChat?.id && updateMessagesForConversation) {
          const newMessages = results.filter(msg => msg && typeof msg === 'object');
          if (newMessages.length > 0) {
            updateMessagesForConversation(systemChat.id, (prev) => {
              const existingIds = new Set(prev.map(m => m.id));
              const filteredNew = newMessages.filter(m => !existingIds.has(m.id));
              return [...prev, ...filteredNew];
            });
          }
        }

        clearSelection();
      } catch (e) {
        // ошибки подавлены в silent режиме
        console.error("Bulk save error:", e);
      }
    },
    [
      selectedIds,
      handleSave,
      systemChat,
      loadMessages,
      clearSelection,
      showSuccess,
      t,
    ]
  );

  /**
   * Обработчик клика по закрепленному сообщению
   */
  const handlePinnedMessageClick = useCallback(async () => {
    const message = pinnedMessagesArray[currentPinIndex];
    if (!message) return;

    // 1. Отменяем предыдущую анимацию подсветки
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = null;
    }

    // 2. Очищаем текущую подсветку
    setHighlightedMessageId(null);

    // 3. Переключаем на следующий закреп (циклически)
    setCurrentPinIndex(
      (prevIndex) => (prevIndex + 1) % pinnedMessagesArray.length
    );

    try {
      // 4. Подгружаем все сообщения после закрепленного перед скроллом
      console.log(
        `[PINNED CLICK] Начинаем загрузку сообщений после закрепленного ${message.id}`
      );
      const loaded = await ensureMessagesAfterPinnedLoaded(message);

      if (loaded) {
        console.log(
          `[PINNED CLICK] Сообщения загружены, выполняем скролл к ${message.id}`
        );
        // Небольшая задержка перед установкой новой подсветки
        // чтобы предыдущая успела очиститься
        setTimeout(() => {
          scrollToMessageLocal(message.id);
        }, 50);
      } else {
        console.log(
          `[PINNED CLICK] Сообщения не загружены, выполняем скролл к ${message.id}`
        );
        scrollToMessageLocal(message.id);
      }
    } catch (error) {
      console.error("Error scrolling to pinned message:", error);
      showError(t("chat.scrollToMessageError"));
    }
  }, [
    pinnedMessagesArray,
    currentPinIndex,
    setCurrentPinIndex,
    highlightTimeoutRef,
    setHighlightedMessageId,
    ensureMessagesAfterPinnedLoaded,
    scrollToMessageLocal,
    showError,
    t,
  ]);

  return {
    handleReply,
    handlePin,
    handleUnpin,
    handleBulkSave,
    handlePinnedMessageClick,
  };
}

