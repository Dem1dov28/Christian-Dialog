import { useState, useCallback, useRef } from "react";

/**
 * Хук для управления контекстным меню и меню в заголовке
 * Включает состояние и обработчики для открытия/закрытия меню
 */
export function useContextMenu() {
  // Состояние контекстного меню
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
  });
  const [menuRendered, setMenuRendered] = useState(false);
  const [activeMessageId, setActiveMessageId] = useState(null);

  // Состояние меню в заголовке
  const [headerMenu, setHeaderMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
  });
  const [headerMenuRendered, setHeaderMenuRendered] = useState(false);

  // Открытие контекстного меню — position:fixed в body, нужны viewport-координаты
  const openMenuAtEvent = useCallback((event, messageId, _containerRef = null) => {
    event.preventDefault();
    event.stopPropagation();

    const padding = 12;
    const menuWidth = 200;
    const menuHeight = 280;

    let x = event.clientX;
    let y = event.clientY;

    const vw = typeof window !== "undefined" ? window.innerWidth : 360;
    const vh = typeof window !== "undefined" ? window.innerHeight : 640;

    // Ограничиваем меню в пределах viewport — не выходить за экран
    x = Math.max(padding, Math.min(x, vw - menuWidth - padding));
    y = Math.max(padding, Math.min(y, vh - menuHeight - padding));

    setContextMenu({ visible: true, x, y });
    setMenuRendered(true);
    setActiveMessageId(messageId);
  }, []);

  // Закрытие контекстного меню
  const closeMenu = useCallback(() => {
    setContextMenu((prev) => ({ ...prev, visible: false }));
    setActiveMessageId(null);
  }, []);

  // Открытие меню в заголовке
  const openHeaderMenuAtEvent = useCallback((event) => {
    // Toggle if re-invoked while visible
    if (headerMenu.visible) {
      setHeaderMenu({ ...headerMenu, visible: false });
      return;
    }

    // Получаем координаты кнопки относительно viewport
    const buttonRect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 180; // Ширина меню
    const x = Math.max(10, buttonRect.right - menuWidth); // Позиционируем меню слева от кнопки
    const y = buttonRect.bottom; // Позиционируем под кнопкой
    const buttonWidth = buttonRect.width;

    setHeaderMenu({ visible: true, x, y, buttonWidth });
    setHeaderMenuRendered(true);
  }, [headerMenu]);

  // Закрытие меню в заголовке
  const closeHeaderMenu = useCallback(() => {
    setHeaderMenu((prev) => ({ ...prev, visible: false }));
  }, []);

  return {
    // Context menu state
    contextMenu,
    setContextMenu,
    menuRendered,
    setMenuRendered,
    activeMessageId,
    setActiveMessageId,

    // Header menu state
    headerMenu,
    setHeaderMenu,
    headerMenuRendered,
    setHeaderMenuRendered,

    // Handlers
    openMenuAtEvent,
    closeMenu,
    openHeaderMenuAtEvent,
    closeHeaderMenu,
  };
}

