import { useEffect, useCallback } from "react";

/**
 * Хук для глобальных обработчиков событий чата
 * Включает обработчики для закрытия меню, кликов на reply-блоки и т.д.
 */
export function useChatGlobalHandlers({
  contextMenu,
  setContextMenu,
  setActiveMessageId,
  messages,
  scrollToMessageLocal,
  activeConversation,
  selectionActive,
  activeMessageId,
  closeMenu,
  openMenuAtEvent,
  containerRef,
  isSelecting,
  setIsSelecting,
}) {
  // Глобальный обработчик кликов для закрытия меню Actions
  useEffect(() => {
    if (!contextMenu.visible) return;

    const handleGlobalClick = (event) => {
      // Проверяем, что клик был НЕ на кнопке внутри меню Actions
      const isButtonClick = event.target.closest("button");
      const actionsMenu = document.querySelector("[data-actions-menu]");

      if (isButtonClick && actionsMenu && actionsMenu.contains(isButtonClick)) {
        // Не закрываем меню при клике на кнопки внутри меню
        return;
      }

      // НЕ закрываем меню при клике на любое сообщение (контент или контейнер)
      if (event.target.closest("[data-message-id]")) {
        return;
      }

      setContextMenu({ ...contextMenu, visible: false });
      setActiveMessageId(null);
    };

    // Глобальный обработчик для мобильных устройств (touchend)
    const handleGlobalTouchEnd = (event) => {
      const actionsMenu = document.querySelector("[data-actions-menu]");

      // Проверяем, что клик НЕ был внутри самого меню Actions
      if (actionsMenu && actionsMenu.contains(event.target)) {
        return;
      }

      // Проверяем, что клик был НЕ на кнопке внутри меню Actions
      const isButtonClick = event.target.closest("button");
      if (isButtonClick && actionsMenu && actionsMenu.contains(isButtonClick)) {
        return;
      }

      // Закрываем меню при клике в любое место, включая сообщения
      // Логика закрытия при клике на то же сообщение обрабатывается в handleMessageTouchEnd
      setContextMenu((prev) => ({ ...prev, visible: false }));
      setActiveMessageId(null);
    };

    // КРИТИЧНО: Используем ТОЛЬКО click БЕЗ capture для избежания блокировки выделения текста
    document.addEventListener("click", handleGlobalClick);
    // Для мобильных устройств используем touchend
    document.addEventListener("touchend", handleGlobalTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("click", handleGlobalClick);
      document.removeEventListener("touchend", handleGlobalTouchEnd);
    };
  }, [contextMenu.visible, contextMenu, setContextMenu, setActiveMessageId]);

  // Обработчик клика на reply-блоки для скролла к исходному сообщению
  useEffect(() => {
    const handleReplyBlockClick = async (event) => {
      const replyBlock = event.target.closest(".reply-block");
      if (!replyBlock) return;

      const replyToId = Number(replyBlock.dataset.replyToId);

      if (replyToId) {
        event.preventDefault();
        event.stopPropagation();

        // КРИТИЧНО: Проверяем, есть ли сообщение с таким ID в текущем чате
        const directMessage = messages.find((m) => m.id === replyToId);

        if (directMessage) {
          // Сообщение найдено напрямую - скроллим к нему
          scrollToMessageLocal(replyToId);
          return;
        }

        // СЛУЧАЙ 1: Мы в Saved Messages, ищем по original_message_id
        if (activeConversation?.is_system_chat) {
          const messageWithOriginalId = messages.find(
            (m) => m.original_message_id === replyToId
          );

          if (messageWithOriginalId) {
            scrollToMessageLocal(messageWithOriginalId.id);
            return;
          }
        }

        // СЛУЧАЙ 2: Мы в обычном чате, но reply-блок содержит ID из Saved Messages (старый баг)
        // Это происходит, когда ответили на сообщение из Saved Messages и отправили в обычный чат
        // В этом случае нужно найти сообщение, которое было цитатой на это сообщение

        // Ищем сообщения, у которых reply_to.id == replyToId
        const messageReplyingToThis = messages.find(
          (m) => m.reply_to && m.reply_to.id === replyToId
        );

        if (messageReplyingToThis) {
          // Скроллим к сообщению, которое цитирует нужное сообщение
          // (это не идеально, но лучше, чем ничего)
          scrollToMessageLocal(messageReplyingToThis.id);
        } else {
          // Последняя попытка: может быть, сообщение просто не загружено
          await scrollToMessageLocal(replyToId);
        }
      }
    };

    document.addEventListener("click", handleReplyBlockClick);

    return () => {
      document.removeEventListener("click", handleReplyBlockClick);
    };
  }, [messages, scrollToMessageLocal, activeConversation]);

  // Обертка для openMenuAtEvent с дополнительными проверками
  const openMenuAtEventWithChecks = useCallback(
    (event, messageId) => {
      // Не открываем меню при активном выделении
      if (selectionActive) {
        return;
      }

      // Не открываем меню, если пользователь выделяет текст
      const selection = window.getSelection();
      if (selection && selection.toString().trim().length > 0) {
        return;
      }

      // Toggle if re-invoked for the same message while visible
      if (contextMenu.visible && activeMessageId === messageId) {
        closeMenu();
        return;
      }

      openMenuAtEvent(event, messageId, containerRef);
    },
    [
      selectionActive,
      contextMenu.visible,
      activeMessageId,
      closeMenu,
      openMenuAtEvent,
      containerRef,
    ]
  );

  // Глобальный mouseup завершает режим выделения
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isSelecting) {
        setIsSelecting(false);
      }
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [isSelecting, setIsSelecting]);

  return {
    openMenuAtEventWithChecks,
  };
}

