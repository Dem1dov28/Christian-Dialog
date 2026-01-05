import { useCallback, useEffect } from "react";

/**
 * Хук для управления позиционированием элементов чата (дата, кнопка скролла)
 */
export function useChatPositioning({
  containerRef,
  setDatePosition,
  setScrollButtonPosition,
  activeChatId,
  isInlineLibraryOpen,
  isChannelChat,
}) {
  // Функция для обновления позиции даты относительно контейнера чата
  const updateDatePosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    setDatePosition({
      top: rect.top + 16, // 16px от верха контейнера
      left: rect.left + rect.width / 2, // Центр контейнера
      width: rect.width,
    });
  }, [containerRef, setDatePosition]);

  // Функция для обновления позиции кнопки скролла относительно контейнера чата
  const updateScrollButtonPosition = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    // Позиционируем кнопку справа от контейнера, на уровне контейнера ввода (внизу)
    // Примерно там же, где находится кнопка в контейнере ввода
    setScrollButtonPosition({
      top: rect.bottom - 56, // 56px от низа контейнера (высота контейнера ввода примерно 56px)
      right: window.innerWidth - rect.right + 12, // 12px от правого края контейнера
    });
  }, [containerRef, setScrollButtonPosition]);

  // Обновляем позицию даты при изменении размера окна или скролле
  useEffect(() => {
    updateDatePosition();

    const handleResize = () => updateDatePosition();
    const handleScroll = () => updateDatePosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    // Обновляем позицию при скролле контейнера чата
    const el = containerRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      if (el) {
        el.removeEventListener("scroll", handleScroll);
      }
    };
  }, [updateDatePosition, activeChatId, isInlineLibraryOpen]);

  // Обновляем позицию кнопки скролла при изменении размера окна или скролле
  useEffect(() => {
    if (!isChannelChat) return; // Только для каналов

    updateScrollButtonPosition();

    const handleResize = () => updateScrollButtonPosition();
    const handleScroll = () => updateScrollButtonPosition();

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    // Обновляем позицию при скролле контейнера чата
    const el = containerRef.current;
    if (el) {
      el.addEventListener("scroll", handleScroll, { passive: true });
    }

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
      if (el) {
        el.removeEventListener("scroll", handleScroll);
      }
    };
  }, [
    updateScrollButtonPosition,
    activeChatId,
    isInlineLibraryOpen,
    isChannelChat,
  ]);

  return {
    updateDatePosition,
    updateScrollButtonPosition,
  };
}

