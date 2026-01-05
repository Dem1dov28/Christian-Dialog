import { useCallback, useState } from "react";

/**
 * Хук для управления ref контейнера чата
 * Обрабатывает установку ref и инициализацию скролла
 */
export function useContainerRef({
  containerRef,
  isInlineLibraryOpen,
  activeChatId,
  isChannelChat,
}) {
  const [chatContainerRect, setChatContainerRect] = useState(null);

  // Callback ref для установки скролла сразу при создании элемента
  const containerRefCallback = useCallback(
    (node) => {
      containerRef.current = node;
      if (!node) {
        return;
      }

      try {
        const rect = node.getBoundingClientRect();
        setChatContainerRect(rect);
      } catch {
        // ignore
      }

      if (isInlineLibraryOpen) {
        node.scrollTop = 0;
        return;
      }

      // Для каналов не скроллим сразу, чтобы дождаться загрузки сообщений
      if (activeChatId !== null && !isChannelChat) {
        requestAnimationFrame(() => {
          if (node && node.scrollHeight > 0) {
            node.scrollTop = node.scrollHeight;
          }
        });
      }
    },
    [containerRef, isInlineLibraryOpen, activeChatId, isChannelChat]
  );

  return {
    containerRefCallback,
    chatContainerRect,
  };
}

