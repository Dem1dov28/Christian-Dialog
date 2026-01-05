import { useEffect, useRef, useState } from "react";

/**
 * Хук для управления анимацией контекстного меню
 * Обеспечивает плавное появление/исчезновение и закрытие при клике вне области
 * 
 * @param {boolean} isOpen - Состояние открытия меню
 * @param {Function} onExited - Callback при завершении анимации закрытия
 * @param {boolean} closeOnOutside - Закрывать ли меню при клике вне области
 * @param {Object} containerRef - Ref контейнера меню (опционально, создается автоматически)
 * @returns {Object} { isRendered, isShown, containerRef, closeMenu }
 */
export function useContextMenuAnimation({
  isOpen = true,
  onExited,
  closeOnOutside = true,
  containerRef: externalRef = null,
}) {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const internalRef = useRef(null);
  const containerRef = externalRef || internalRef;

  // Mount on open
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      // next tick to allow transition from initial state
      requestAnimationFrame(() => setIsShown(true));
    } else {
      // trigger exit animation
      setIsShown(false);
    }
  }, [isOpen]);

  // Enter on initial mount when uncontrolled usage
  useEffect(() => {
    if (isRendered && isOpen) {
      requestAnimationFrame(() => setIsShown(true));
    }
  }, [isRendered, isOpen]);

  // Close on outside click/touch (configurable)
  useEffect(() => {
    if (!isRendered || !closeOnOutside) return;

    const handlePointerDown = (event) => {
      const containerEl = containerRef.current;
      if (!containerEl) return;
      
      // Проверяем, что клик был НЕ на кнопке внутри меню (для Actions.jsx)
      const isButtonClick = event.target.closest("button");
      if (isButtonClick && containerEl.contains(isButtonClick)) {
        // Не закрываем меню при клике на кнопки внутри меню
        return;
      }
      
      // Закрываем меню при клике вне области
      if (!containerEl.contains(event.target)) {
        setIsShown(false);
      }
    };

    // Используем capture phase для более раннего перехвата
    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
    };
  }, [isRendered, closeOnOutside, containerRef]);

  const handleTransitionEnd = (event) => {
    if (event.target !== containerRef.current) return;
    if (!isShown) {
      setIsRendered(false);
      if (typeof onExited === "function") onExited();
    }
  };

  const closeMenu = () => setIsShown(false);

  return {
    isRendered,
    isShown,
    containerRef,
    closeMenu,
    handleTransitionEnd,
  };
}

