import { useEffect } from "react";

/**
 * Хук для инициализации даты при загрузке сообщений
 */
export function useChatDateInitialization({
  isInlineLibraryOpen,
  containerRef,
  isUserScrollingUpRef,
  windowedMessages,
  messages,
  topVisibleDate,
  setTopVisibleDate,
  formatDateHeader,
  language,
  visibleMessages,
  scrollToBottom,
  getScrollPosition,
}) {
  useEffect(() => {
    if (isInlineLibraryOpen) {
      return;
    }
    const el = containerRef.current;
    if (!el) return;

    // НЕ скроллим автоматически вниз, если пользователь скроллит вверх
    if (isUserScrollingUpRef.current) {
      // Инициализируем дату при загрузке сообщений (только если дата еще не установлена)
      if (windowedMessages.length > 0 && !topVisibleDate && messages?.length > 0) {
        // Берем первое сообщение из windowedMessages (самое старое в окне)
        const firstMessage = windowedMessages[0];
        const originalMessage = messages.find((msg) => msg.id === firstMessage.id);
        if (originalMessage?.created_at) {
          const formattedDate = formatDateHeader(originalMessage.created_at, language);
          setTopVisibleDate(formattedDate);
        }
      }
      return;
    }

    const scrollPos = getScrollPosition(true);
    // Скроллим вниз только если пользователь действительно внизу и не скроллит вверх
    if (scrollPos.distanceFromBottom < 200) {
      scrollToBottom();
    }

    // Инициализируем дату при загрузке сообщений (только если дата еще не установлена)
    if (windowedMessages.length > 0 && !topVisibleDate && messages?.length > 0) {
      // Берем первое сообщение из windowedMessages (самое старое в окне)
      const firstMessage = windowedMessages[0];
      const originalMessage = messages.find((msg) => msg.id === firstMessage.id);
      if (originalMessage?.created_at) {
        const formattedDate = formatDateHeader(originalMessage.created_at, language);
        setTopVisibleDate(formattedDate);
      }
    }
  }, [
    visibleMessages,
    isInlineLibraryOpen,
    windowedMessages,
    messages,
    topVisibleDate,
    scrollToBottom,
    getScrollPosition,
    containerRef,
    isUserScrollingUpRef,
    setTopVisibleDate,
    formatDateHeader,
    language,
  ]);
}

