import React, { useEffect, useState, useRef, useImperativeHandle, forwardRef } from "react";
import AIPanel from "./AIPanel";

const RightPanel = forwardRef(function RightPanel({
  onClose,
  activeChatId,
  onDeleteChat,
  isModal = false,
}, ref) {
  // Состояние для отслеживания процесса закрытия
  const [isClosing, setIsClosing] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);

  // Если нет активного чата, не показываем панель
  if (!activeChatId) {
    return null;
  }

  // Обработчик закрытия с анимацией
  const handleClose = () => {
    if (isClosing) return; // Предотвращаем множественные вызовы
    if (!shouldRender) return; // Если уже закрывается или закрыта, игнорируем
    
    setIsClosing(true);
    // Ждем завершения анимации перед вызовом onClose
    // Важно: onClose устанавливает isRightPanelVisible в false в App.jsx,
    // что размонтирует компонент, поэтому вызываем его только после завершения анимации
    setTimeout(() => {
      setShouldRender(false);
      // Вызываем onClose только после того, как компонент полностью скрылся
      // Это позволяет компоненту остаться в DOM во время всей анимации
      onClose();
    }, 300); // Длительность анимации
  };

  // Экспортируем функцию закрытия через ref для использования из App.jsx
  useImperativeHandle(ref, () => ({
    close: handleClose,
  }));

  useEffect(() => {
    if (!isModal || typeof document === "undefined") {
      return;
    }

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isModal]);

  // Сброс состояния при изменении activeChatId
  useEffect(() => {
    if (activeChatId) {
      setIsClosing(false);
      setShouldRender(true);
    }
  }, [activeChatId]);

  if (!shouldRender) {
    return null;
  }

  if (isModal) {
    return (
      <div
        className={`fixed inset-0 z-[110] flex items-center justify-center px-4 py-6 bg-black/50 backdrop-blur-sm ${isClosing ? 'ai-panel-backdrop-closing' : 'ai-panel-backdrop'}`}
        onClick={handleClose}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="w-full max-w-xl pointer-events-auto"
          onClick={(event) => event.stopPropagation()}
        >
          <AIPanel
            onClose={handleClose}
            activeChatId={activeChatId}
            onDeleteChat={onDeleteChat}
            isModal
            isClosing={isClosing}
          />
        </div>
      </div>
    );
  }

  return (
    <AIPanel
      onClose={handleClose}
      activeChatId={activeChatId}
      onDeleteChat={onDeleteChat}
      isClosing={isClosing}
    />
  );
});

export default RightPanel;
