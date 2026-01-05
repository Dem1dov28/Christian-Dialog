import { useState, useMemo, useCallback } from "react";

/**
 * Хук для управления закрепленными сообщениями в чате
 * Включает состояние и обработчики для работы с закрепленными сообщениями
 */
export function usePinnedMessages({ pinnedMessages, activeConversation }) {
  const [currentPinIndex, setCurrentPinIndex] = useState(0);

  // Массив закрепленных сообщений для текущего чата
  const pinnedMessagesArray = useMemo(() => {
    if (
      !activeConversation?.id ||
      !pinnedMessages ||
      !pinnedMessages[activeConversation.id]?.length
    ) {
      return [];
    }
    return pinnedMessages[activeConversation.id].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
  }, [activeConversation?.id, pinnedMessages]);

  const currentPinnedMessage = pinnedMessagesArray[currentPinIndex] || null;

  // Переключение на следующий закреп (циклически)
  const nextPin = useCallback(() => {
    if (pinnedMessagesArray.length === 0) return;
    setCurrentPinIndex((prevIndex) => (prevIndex + 1) % pinnedMessagesArray.length);
  }, [pinnedMessagesArray.length]);

  // Переключение на предыдущий закреп (циклически)
  const prevPin = useCallback(() => {
    if (pinnedMessagesArray.length === 0) return;
    setCurrentPinIndex((prevIndex) => 
      (prevIndex - 1 + pinnedMessagesArray.length) % pinnedMessagesArray.length
    );
  }, [pinnedMessagesArray.length]);

  // Сброс индекса при смене чата
  const resetPinIndex = useCallback(() => {
    setCurrentPinIndex(0);
  }, []);

  return {
    currentPinIndex,
    setCurrentPinIndex,
    pinnedMessagesArray,
    currentPinnedMessage,
    nextPin,
    prevPin,
    resetPinIndex,
  };
}

