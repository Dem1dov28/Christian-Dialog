import { useCallback, useRef } from "react";

/**
 * Хук для управления touch-событиями на сообщениях
 * Обрабатывает долгое нажатие, свайпы и другие touch-жесты
 */
export function useMessageTouchHandlers({
  messageTouchHandlersRef,
  selectedMessagesSet,
  setSelectedMessagesSet,
  setIsSelecting,
  setIsContainerDragSelecting,
  setDragSelectionMode,
  contextMenu,
  activeMessageId,
  setContextMenu,
  setActiveMessageId,
  selectionActive,
  isSelecting,
  openMenuAtEventWithChecks,
}) {
  // Обработчик долгого нажатия на сообщение — открывает модалку с действиями
  const handleMessageLongPress = useCallback(
    (e, messageId, clientX, clientY) => {
      // Если сообщение уже выделено — при долгом нажатии запускаем режим выделения
      if (selectedMessagesSet.has(messageId)) {
        e.preventDefault();
        e.stopPropagation();
        setSelectedMessagesSet((prev) => {
          const next = new Set(prev);
          next.add(messageId);
          requestAnimationFrame(() => {
            setIsSelecting(true);
            setIsContainerDragSelecting(true);
            setDragSelectionMode("add");
          });
          return next;
        });
        return;
      }

      // Предотвращаем стандартное поведение
      e.preventDefault();
      e.stopPropagation();

      // Вибрация для обратной связи
      if (navigator.vibrate) {
        try {
          navigator.vibrate(50);
        } catch (err) {
          // Игнорируем ошибки вибрации
        }
      }

      // Открываем модалку с действиями (pin, copy и т.д.)
      const syntheticEvent = {
        clientX: clientX ?? e.touches?.[0]?.clientX ?? 0,
        clientY: clientY ?? e.touches?.[0]?.clientY ?? 0,
        target: e.target,
        preventDefault: () => {},
        stopPropagation: () => {},
      };
      openMenuAtEventWithChecks(syntheticEvent, messageId);
    },
    [selectedMessagesSet, setSelectedMessagesSet, setIsSelecting, setIsContainerDragSelecting, setDragSelectionMode, openMenuAtEventWithChecks]
  );

  // Обработчик начала touch-события на сообщении
  const handleMessageTouchStart = useCallback(
    (e, messageId) => {
      const touch = e.touches[0];
      const target = e.currentTarget;
      const content = target.querySelector(".message-content"); // Находим пузырь сообщения

      // Если сообщение уже выделено - разрешаем нативное выделение текста
      const isAlreadySelected = selectedMessagesSet.has(messageId);

      let originalUserSelect = "";
      let originalWebkitUserSelect = "";
      let originalTouchCallout = "";
      let originalContentUserSelect = "";
      let originalContentWebkitUserSelect = "";
      let originalContentTouchCallout = "";

      // Временно отключаем выделение текста ТОЛЬКО если сообщение НЕ выделено
      // Если сообщение выделено - разрешаем нативное выделение текста
      if (!isAlreadySelected) {
        originalUserSelect = target.style.userSelect;
        originalWebkitUserSelect = target.style.webkitUserSelect;
        originalTouchCallout = target.style.webkitTouchCallout; // For iOS
        target.style.userSelect = "none";
        target.style.webkitUserSelect = "none";
        target.style.webkitTouchCallout = "none";

        // Также отключаем на самом пузыре, так как там может быть user-select: auto
        if (content) {
          originalContentUserSelect = content.style.userSelect;
          originalContentWebkitUserSelect = content.style.webkitUserSelect;
          originalContentTouchCallout = content.style.webkitTouchCallout;
          content.style.userSelect = "none";
          content.style.webkitUserSelect = "none";
          content.style.webkitTouchCallout = "none";
        }
      }

      // Запускаем таймер для long press ТОЛЬКО если сообщение НЕ выделено
      // Если сообщение выделено - не запускаем таймер, разрешаем нативное выделение
      let timer = null;
      if (!isAlreadySelected) {
        timer = setTimeout(() => {
          const handler = messageTouchHandlersRef.current.get(messageId);
          if (handler && !handler.moved) {
            handler.longPressed = true;

            // Очищаем любое нативное выделение, которое могло возникнуть
            if (window.getSelection) {
              window.getSelection().removeAllRanges();
            }

            handleMessageLongPress(e, messageId, handler.startX, handler.startY);
          }
        }, 500);
      }

      // КРИТИЧНО: Проверяем, открыто ли меню для этого сообщения НА МОМЕНТ touchStart
      // Сохраняем этот флаг, чтобы использовать его в touchEnd для решения о закрытии меню
      const shouldCloseMenu = contextMenu.visible && activeMessageId === messageId;

      messageTouchHandlersRef.current.set(messageId, {
        startX: touch.clientX,
        startY: touch.clientY,
        moved: false,
        longPressed: false,
        shouldCloseMenu, // Сохраняем флаг для использования в touchEnd
        timer,
        restoreStyles: () => {
          // Восстанавливаем стили только если они были изменены
          if (!isAlreadySelected) {
            target.style.userSelect = originalUserSelect;
            target.style.webkitUserSelect = originalWebkitUserSelect;
            target.style.webkitTouchCallout = originalTouchCallout;
            if (content) {
              content.style.userSelect = originalContentUserSelect;
              content.style.webkitUserSelect = originalContentWebkitUserSelect;
              content.style.webkitTouchCallout = originalContentTouchCallout;
            }
          }
        },
      });
    },
    [
      handleMessageLongPress,
      selectedMessagesSet,
      contextMenu.visible,
      activeMessageId,
      messageTouchHandlersRef,
    ]
  );

  // Обработчик движения touch-события на сообщении
  const handleMessageTouchMove = useCallback(
    (e, messageId) => {
      const handler = messageTouchHandlersRef.current.get(messageId);
      if (!handler) return;

      const touch = e.touches[0];
      const moveX = Math.abs(touch.clientX - handler.startX);
      const moveY = Math.abs(touch.clientY - handler.startY);

      if (moveX > 10 || moveY > 10) {
        handler.moved = true;
        clearTimeout(handler.timer);
        // Восстанавливаем стили при движении
        if (handler.restoreStyles) handler.restoreStyles();
      }
    },
    [messageTouchHandlersRef]
  );

  // Обработчик окончания touch-события на сообщении
  const handleMessageTouchEnd = useCallback(
    (e, messageId) => {
      const handler = messageTouchHandlersRef.current.get(messageId);
      if (!handler) return;

      clearTimeout(handler.timer);

      // Восстанавливаем стили
      if (handler.restoreStyles) handler.restoreStyles();

      // Если был long press - не обрабатываем touchend (выделение уже запущено)
      if (handler.longPressed) {
        // Предотвращаем стандартное поведение
        e.preventDefault();
        e.stopPropagation();

        // ВАЖНО: Принудительно завершаем режим drag-выделения,
        // так как stopPropagation предотвращает срабатывание глобального touchend
        setIsContainerDragSelecting(false);
        setDragSelectionMode(null);

        messageTouchHandlersRef.current.delete(messageId);
        return;
      }

      if (!handler.moved && !handler.longPressed) {
        // Tap

        // КРИТИЧНО: ПЕРВООЧЕРЕДНАЯ ПРОВЕРКА - если при touchStart меню было открыто для этого сообщения,
        // то это второй клик на то же сообщение - нужно ЗАКРЫТЬ меню, а не открывать его снова
        if (handler.shouldCloseMenu) {
          // Предотвращаем стандартное поведение
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();

          // Закрываем меню
          setContextMenu((prev) => ({ ...prev, visible: false }));
          setActiveMessageId(null);

          messageTouchHandlersRef.current.delete(messageId);
          return;
        }

        const isMessageSelected = selectedMessagesSet.has(messageId);

        // Если сообщение уже выделено - снимаем выделение при одном клике
        if (isMessageSelected) {
          // Предотвращаем стандартное поведение (например, клик)
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();

          setSelectedMessagesSet((prev) => {
            const next = new Set(prev);
            next.delete(messageId);
            // Если удалили последнее сообщение - деактивируем режим выделения
            if (next.size === 0) {
              setIsSelecting(false);
              setIsContainerDragSelecting(false);
              setDragSelectionMode(null);
            }
            return next;
          });
        }
        // Если есть другие выделенные сообщения, но это сообщение не выделено - добавляем его
        else if (selectedMessagesSet.size > 0 || isSelecting || selectionActive) {
          // Предотвращаем стандартное поведение (например, клик)
          if (e.cancelable) e.preventDefault();
          e.stopPropagation();

          // Активируем режим выделения, если он еще не активен
          if (!isSelecting) {
            setIsSelecting(true);
          }

          setSelectedMessagesSet((prev) => {
            const next = new Set(prev);
            next.add(messageId);
            return next;
          });
        }
        // Короткий тап — ничего не делаем (модалка с действиями открывается при долгом нажатии)
      }

      messageTouchHandlersRef.current.delete(messageId);
    },
    [
      isSelecting,
      selectionActive,
      selectedMessagesSet,
      setSelectedMessagesSet,
      setIsSelecting,
      setIsContainerDragSelecting,
      setDragSelectionMode,
      contextMenu.visible,
      activeMessageId,
      setContextMenu,
      setActiveMessageId,
      messageTouchHandlersRef,
    ]
  );

  // Обработчик отмены touch-события на сообщении
  const handleMessageTouchCancel = useCallback(
    (e, messageId) => {
      const handler = messageTouchHandlersRef.current.get(messageId);
      if (!handler) return;

      clearTimeout(handler.timer);
      if (handler.restoreStyles) handler.restoreStyles();

      messageTouchHandlersRef.current.delete(messageId);
    },
    [messageTouchHandlersRef]
  );

  return {
    handleMessageLongPress,
    handleMessageTouchStart,
    handleMessageTouchMove,
    handleMessageTouchEnd,
    handleMessageTouchCancel,
  };
}
