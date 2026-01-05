import { useEffect } from "react";

/**
 * Хук для различных эффектов чата (сброс состояния при смене чата, обработка событий и т.д.)
 */
export function useChatEffects({
  activeConversation,
  activeChatId,
  isInlineLibraryOpen,
  containerRef,
  scrollToMessageLocal,
  setCurrentPinIndex,
  clearSelection,
  pinnedMessagesArray,
  currentPinIndex,
  highlightTimeoutRef,
  suppressTopLoadTimeoutRef,
  suppressTopLoadRef,
  setInputValue,
  setReplyToMessage,
  setIsDateVisible,
  dateHideTimeoutRef,
  loadDraftMessage,
  resetTextareaHeight,
  textareaRef,
  saveDraftMessage,
  inputValue,
}) {
  // Сбрасываем индекс закрепа при смене чата
  useEffect(() => {
    setCurrentPinIndex(0);
  }, [activeConversation?.id, setCurrentPinIndex]);

  // Сбрасываем выбор при смене чата
  useEffect(() => {
    clearSelection();
  }, [activeConversation?.id, clearSelection]);

  // Валидируем индекс закрепа при изменении количества закрепов
  useEffect(() => {
    if (
      currentPinIndex >= pinnedMessagesArray.length &&
      pinnedMessagesArray.length > 0
    ) {
      setCurrentPinIndex(0);
    }
  }, [pinnedMessagesArray.length, currentPinIndex, setCurrentPinIndex]);

  // Очищаем таймер при размонтировании
  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
        highlightTimeoutRef.current = null;
      }
      if (suppressTopLoadTimeoutRef.current) {
        clearTimeout(suppressTopLoadTimeoutRef.current);
        suppressTopLoadTimeoutRef.current = null;
      }
      suppressTopLoadRef.current = false;
    };
  }, [highlightTimeoutRef, suppressTopLoadTimeoutRef, suppressTopLoadRef]);

  // Восстанавливаем draft при смене чата
  useEffect(() => {
    // Восстанавливаем draft при смене чата
    if (activeConversation?.id) {
      const draft = loadDraftMessage(activeConversation.id);
      setInputValue(draft);

      // Обновляем высоту textarea если есть draft
      if (draft && textareaRef.current) {
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            const minHeight = window.innerWidth < 640 ? 20 : 24;
            textareaRef.current.style.height =
              Math.min(textareaRef.current.scrollHeight, 200) + "px";
          }
        }, 0);
      } else {
        resetTextareaHeight();
      }
    } else {
      setInputValue("");
      resetTextareaHeight();
    }

    setReplyToMessage(null);

    // Сбрасываем видимость даты при смене чата
    setIsDateVisible(false);

    // Очищаем таймер скрытия при смене чата
    if (dateHideTimeoutRef.current) {
      clearTimeout(dateHideTimeoutRef.current);
      dateHideTimeoutRef.current = null;
    }
  }, [
    activeChatId,
    activeConversation?.id,
    isInlineLibraryOpen,
    loadDraftMessage,
    setInputValue,
    resetTextareaHeight,
    setReplyToMessage,
    setIsDateVisible,
    dateHideTimeoutRef,
    textareaRef,
  ]);

  // Сброс скролла при открытии встроенной библиотеки
  useEffect(() => {
    if (!isInlineLibraryOpen) return;
    const el = containerRef.current;
    if (el) {
      el.scrollTop = 0;
    }
  }, [isInlineLibraryOpen, containerRef]);

  // Автосохранение draft сообщения при изменении inputValue с задержкой 100ms
  useEffect(() => {
    if (activeConversation?.id && inputValue !== undefined) {
      const timeoutId = setTimeout(() => {
        saveDraftMessage(activeConversation.id, inputValue);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [inputValue, activeConversation?.id, saveDraftMessage]);

  // Принимаем события скролла с правой панели (и других источников)
  useEffect(() => {
    const handler = (evt) => {
      try {
        const { conversationId, messageId } = evt.detail || {};
        if (!messageId) {
          return;
        }

        if (activeConversation?.id && conversationId === activeConversation.id) {
          scrollToMessageLocal(messageId);
        }
      } catch (error) {
        console.error("📍 [CHAT EVENT] Ошибка в обработчике:", error);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("chat-scroll-to-message", handler);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("chat-scroll-to-message", handler);
      }
    };
  }, [activeConversation?.id, scrollToMessageLocal]);
}

