import { useState, useRef, useCallback, useEffect, useMemo } from "react";

/**
 * Хук для управления выделением сообщений в чате
 * Включает состояние выделения, обработчики мыши и тач-событий
 */
export function useMessageSelection() {
  // Состояние выделения
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedMessagesSet, setSelectedMessagesSet] = useState(() => new Set());
  const [isContainerDragSelecting, setIsContainerDragSelecting] = useState(false);
  const [dragSelectionMode, setDragSelectionMode] = useState(null); // 'add' | 'remove' | null

  // LMB drag detection state
  const lmbPendingRef = useRef(false);
  const lmbStartYRef = useRef(0);
  const lmbStartMessageIdRef = useRef(null);
  const hasLmbDraggedRef = useRef(false);
  const wasDragRef = useRef(false);

  // Mobile touch handlers state
  const messageTouchHandlersRef = useRef(new Map());

  // Вычисляемые значения
  const selectedCount = selectedMessagesSet.size;
  const selectedIds = useMemo(
    () => Array.from(selectedMessagesSet),
    [selectedMessagesSet]
  );
  const selectionActive = selectedCount > 0 || isSelecting;

  // Очистка выделения
  const clearSelection = useCallback(() => {
    setIsSelecting(false);
    setSelectedMessagesSet(new Set());
    setIsContainerDragSelecting(false);
    setDragSelectionMode(null);
  }, []);

  // Тоггл выделения сообщения
  const toggleMessageSelection = useCallback((messageId) => {
    setSelectedMessagesSet((prev) => {
      const next = new Set(prev);
      if (next.has(messageId)) {
        next.delete(messageId);
      } else {
        next.add(messageId);
      }
      return next;
    });
  }, []);

  // Добавление сообщения в выделение
  const addMessageToSelection = useCallback((messageId) => {
    setSelectedMessagesSet((prev) => {
      const next = new Set(prev);
      next.add(messageId);
      return next;
    });
  }, []);

  // Удаление сообщения из выделения
  const removeMessageFromSelection = useCallback((messageId) => {
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
  }, []);

  // Обработчик начала выделения мышью
  const handleMessageMouseDown = useCallback((e, id) => {
    if (e.button === 0) {
      // Если уже активен режим выделения — запускаем drag-сессию add/remove
      if (selectionActive) {
        e.preventDefault();
        e.stopPropagation();
        setIsSelecting(true);
        setIsContainerDragSelecting(true);
        setSelectedMessagesSet((prev) => {
          const next = new Set(prev);
          if (next.has(id)) {
            next.delete(id);
            setDragSelectionMode("remove");
          } else {
            next.add(id);
            setDragSelectionMode("add");
          }
          return next;
        });
        return;
      }

      // Отложенный старт первого выделения при ЛКМ
      if (e.target.closest(".message-content")) {
        return;
      }
      lmbPendingRef.current = true;
      hasLmbDraggedRef.current = false;
      lmbStartYRef.current = e.clientY;
      lmbStartMessageIdRef.current = id;
    }
  }, [selectionActive]);

  // Обработчик клика на контент сообщения
  const handleContentMouseDown = useCallback((e, id) => {
    if (e.button !== 0) return;
    if (!selectionActive) return;
    e.preventDefault();
    e.stopPropagation();
    setIsSelecting(true);
    setIsContainerDragSelecting(true);
    setSelectedMessagesSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setDragSelectionMode("remove");
      } else {
        next.add(id);
        setDragSelectionMode("add");
      }
      return next;
    });
  }, [selectionActive]);

  // Обработчик наведения мыши на сообщение
  const handleMessageMouseEnter = useCallback(
    (e, id) => {
      if (!isSelecting || !isContainerDragSelecting) return;
      setSelectedMessagesSet((prev) => {
        const next = new Set(prev);
        if (dragSelectionMode === "remove") {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    },
    [isSelecting, isContainerDragSelecting, dragSelectionMode]
  );

  // Обработчик отпускания мыши
  const handleMessageMouseUp = useCallback(() => {
    if (isSelecting) {
      setIsSelecting(false);
      setIsContainerDragSelecting(false);
      setDragSelectionMode(null);
    }
    // Сброс LMB drag состояний
    lmbPendingRef.current = false;
    setTimeout(() => {
      hasLmbDraggedRef.current = false;
      wasDragRef.current = false;
    }, 100);
    lmbStartMessageIdRef.current = null;
  }, [isSelecting]);

  // Обработчик клика на сообщение
  const handleMessageClick = useCallback((e, messageId) => {
    if (!selectedMessagesSet.has(messageId)) return;
    
    if (wasDragRef.current || hasLmbDraggedRef.current) {
      wasDragRef.current = false;
      return;
    }
    
    if (e.target.closest('button, a, input, textarea, select, [role="button"]')) return;
    
    e.stopPropagation();
    removeMessageFromSelection(messageId);
  }, [selectedMessagesSet, removeMessageFromSelection]);

  // Глобальный обработчик движения мыши для начала выделения
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      const leftButtonDown = !!(e.buttons & 1);
      if (!leftButtonDown) {
        lmbPendingRef.current = false;
        return;
      }
      if (!lmbPendingRef.current) return;
      const dy = Math.abs(e.clientY - (lmbStartYRef.current || 0));
      if (dy > 3 && !hasLmbDraggedRef.current && lmbStartMessageIdRef.current != null) {
        hasLmbDraggedRef.current = true;
        wasDragRef.current = true;
        setIsSelecting(true);
        setIsContainerDragSelecting(true);
        const startId = lmbStartMessageIdRef.current;
        setSelectedMessagesSet((prev) => {
          const next = new Set(prev);
          if (next.has(startId)) {
            next.delete(startId);
            setDragSelectionMode("remove");
          } else {
            next.add(startId);
            setDragSelectionMode("add");
          }
          return next;
        });
      }
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, []);

  // Обработчики тач-событий для мобильных устройств
  useEffect(() => {
    if (!isSelecting) return;

    const handleTouchMove = (e) => {
      if (!isContainerDragSelecting) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (touch) {
        const element = document.elementFromPoint(touch.clientX, touch.clientY);
        const messageDiv = element?.closest('[data-message-id]');
        if (messageDiv) {
          const id = Number(messageDiv.dataset.messageId);
          if (id) {
            setSelectedMessagesSet(prev => {
              const next = new Set(prev);
              if (dragSelectionMode === 'remove') {
                next.delete(id);
              } else {
                next.add(id);
              }
              return next;
            });
          }
        }
      }
    };

    const handleTouchEnd = () => {
      if (isContainerDragSelecting) {
        setIsContainerDragSelecting(false);
      }
    };

    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isSelecting, isContainerDragSelecting, dragSelectionMode]);

  // Запрет выделения текста во время активного режима выделения
  useEffect(() => {
    if (selectionActive) {
      // Сбрасываем текущее выделение текста в браузере
      if (window.getSelection) {
        window.getSelection().removeAllRanges();
      }

      const prevUserSelect = document.body.style.userSelect;
      const prevWebkitUserSelect = document.body.style.webkitUserSelect;
      document.body.style.userSelect = "none";
      document.body.style.webkitUserSelect = "none";
      return () => {
        document.body.style.userSelect = prevUserSelect || "";
        document.body.style.webkitUserSelect = prevWebkitUserSelect || "";
      };
    }
  }, [selectionActive]);

  return {
    // State
    isSelecting,
    setIsSelecting,
    selectedMessagesSet,
    setSelectedMessagesSet,
    isContainerDragSelecting,
    setIsContainerDragSelecting,
    dragSelectionMode,
    setDragSelectionMode,
    selectedCount,
    selectedIds,
    selectionActive,

    // Refs
    lmbPendingRef,
    lmbStartYRef,
    lmbStartMessageIdRef,
    hasLmbDraggedRef,
    wasDragRef,
    messageTouchHandlersRef,

    // Functions
    clearSelection,
    toggleMessageSelection,
    addMessageToSelection,
    removeMessageFromSelection,
    handleMessageMouseDown,
    handleContentMouseDown,
    handleMessageMouseEnter,
    handleMessageMouseUp,
    handleMessageClick,
  };
}

