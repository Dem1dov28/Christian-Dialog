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

  // Открытие контекстного меню с учетом контейнера скролла
  const openMenuAtEvent = useCallback((event, messageId, containerRef = null) => {
    event.preventDefault();
    event.stopPropagation();

    let x = event.clientX;
    let y = event.clientY;

    // Если передан контейнер, вычисляем координаты относительно него
    if (containerRef?.current) {
      const container = containerRef.current;
      const rect = container.getBoundingClientRect();
      const scrollLeft = container.scrollLeft || 0;
      const scrollTop = container.scrollTop || 0;
      x = event.clientX - rect.left + scrollLeft;
      y = event.clientY - rect.top + scrollTop;

      // Keep menu INSIDE the VISIBLE viewport of the scroll container
      const padding = 8;
      const menuWidth = 135;
      const menuHeight = 260;

      const viewportMinX = scrollLeft + padding;
      const viewportMaxX = scrollLeft + container.clientWidth - menuWidth - padding;
      const viewportMinY = scrollTop + padding;
      
      // Вычисляем максимальную Y-координату с учетом поля ввода
      // Находим элемент поля ввода и вычисляем его позицию относительно контейнера
      let inputSectionMaxY = scrollTop + container.clientHeight - menuHeight - padding;
      
      // Ищем поле ввода - ищем контейнер с классом chat-input-transparent,
      // который имеет position: absolute и находится внизу (это ChatInputSection)
      const inputSections = document.querySelectorAll('.chat-input-transparent');
      let inputSection = null;
      
      // Ищем контейнер поля ввода (ChatInputSection), который имеет position: absolute
      for (const section of inputSections) {
        const styles = window.getComputedStyle(section);
        if (styles.position === 'absolute' && (styles.bottom === '0px' || styles.bottom === '0')) {
          inputSection = section;
          break;
        }
      }
      
      if (inputSection) {
        const inputRect = inputSection.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        // Вычисляем позицию поля ввода относительно контейнера с учетом скролла
        const inputTopRelativeToContainer = inputRect.top - containerRect.top + scrollTop;
        // Меню не должно перекрывать поле ввода, оставляем отступ
        // Убеждаемся, что inputSectionMaxY не меньше viewportMinY
        const calculatedMaxY = inputTopRelativeToContainer - menuHeight - padding;
        if (calculatedMaxY > viewportMinY) {
          inputSectionMaxY = calculatedMaxY;
        }
      }
      
      const viewportMaxY = Math.min(
        scrollTop + container.clientHeight - menuHeight - padding,
        inputSectionMaxY
      );

      x = Math.max(viewportMinX, Math.min(x, viewportMaxX));
      const effectiveMaxY = Math.max(viewportMinY, viewportMaxY);
      y = Math.max(viewportMinY, Math.min(y, effectiveMaxY));
    }

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

