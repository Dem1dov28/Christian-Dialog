import { useEffect, useRef } from "react";

/**
 * Хук для управления жизненным циклом чата
 * Обрабатывает очистку sessionStorage, обновление refs, автоматический выбор чата
 */
export function useChatLifecycle({
  activeChatId,
  activeConversation,
  selectConversation,
  mainRef,
  updateMainWidth,
  messages,
  messagesRef,
}) {
  // КРИТИЧНО: Ref для отслеживания активного чата без триггера useEffect
  const activeChatIdRef = useRef(activeChatId);

  // Обновляем ref при изменении activeChatId
  useEffect(() => {
    activeChatIdRef.current = activeChatId;
  }, [activeChatId]);

  // Очищаем session_active и все draft при каждой загрузке страницы
  useEffect(() => {
    // Очищаем session_active
    sessionStorage.removeItem("session_active");

    // Очищаем все draft сообщения из sessionStorage
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith("draft_")) {
          keysToRemove.push(key);
        }
      }
      // Удаляем все найденные draft ключи
      keysToRemove.forEach((key) => sessionStorage.removeItem(key));
      console.log(
        `Cleared ${keysToRemove.length} draft messages from sessionStorage`
      );
    } catch (error) {
      console.error("Error clearing draft messages:", error);
    }
  }, []); // Выполняется только при монтировании компонента

  // Отслеживание ширины main элемента для обновления контекста PanelWidth
  useEffect(() => {
    const mainElement = mainRef.current;
    if (!mainElement) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const width = entry.contentRect.width;
        updateMainWidth(width);
      }
    });

    resizeObserver.observe(mainElement);

    // Также обновляем при изменении размера окна
    const updateRect = () => {
      if (mainElement) {
        const rect = mainElement.getBoundingClientRect();
        updateMainWidth(rect.width);
      }
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateRect);
    };
  }, [mainRef, updateMainWidth]);

  // Храним актуальное состояние сообщений в ref для доступа внутри async функций
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages, messagesRef]);

  // Автоматический выбор чата при изменении activeChatId
  useEffect(() => {
    if (activeChatId && activeChatId !== activeConversation?.id) {
      // Используем функцию selectConversation напрямую с activeChatId
      // Она сама найдет чат в списке conversations
      selectConversation(activeChatId);
    }
  }, [activeChatId, activeConversation?.id, selectConversation]);

  return {
    activeChatIdRef,
  };
}

