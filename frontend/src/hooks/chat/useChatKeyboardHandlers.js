import { useEffect } from "react";

/**
 * Хук для обработки глобальных событий клавиатуры в чате
 */
export function useChatKeyboardHandlers({
  isChatSelected,
  isInlineLibraryOpen,
  selectionActive,
  contextMenuVisible,
  textareaRef,
  setInputValue,
  clearSelection,
}) {
  // Глобальный обработчик клавиатуры для автоматического ввода текста в textarea
  useEffect(() => {
    if (!isChatSelected || isInlineLibraryOpen || selectionActive || contextMenuVisible) {
      return;
    }

    const isPrintableKey = (key) => {
      // Проверяем, является ли клавиша печатным символом
      // Печатный символ должен иметь длину 1 и не быть специальной клавишей
      return key.length === 1 && !key.match(/[\u0000-\u001F]/);
    };

    const handleKeyPress = (event) => {
      // Пропускаем, если пользователь уже вводит текст в textarea или другой элемент ввода
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement?.tagName === "INPUT" ||
        activeElement?.tagName === "TEXTAREA" ||
        activeElement?.isContentEditable ||
        activeElement?.closest("input, textarea, [contenteditable]");

      // Проверяем, что фокус не на элементах ввода
      if (isInputFocused) {
        return;
      }

      // Пропускаем специальные клавиши
      if (
        event.key === "Enter" ||
        event.key === "Tab" ||
        event.key === "Escape" ||
        event.key === "Backspace" ||
        event.key === "Delete" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown" ||
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "Home" ||
        event.key === "End" ||
        event.key === "PageUp" ||
        event.key === "PageDown" ||
        event.key === "CapsLock" ||
        event.key === "Shift" ||
        event.key === "Control" ||
        event.key === "Alt" ||
        event.key === "Meta" ||
        event.key === "ContextMenu" ||
        event.key === "F1" ||
        event.key === "F2" ||
        event.key === "F3" ||
        event.key === "F4" ||
        event.key === "F5" ||
        event.key === "F6" ||
        event.key === "F7" ||
        event.key === "F8" ||
        event.key === "F9" ||
        event.key === "F10" ||
        event.key === "F11" ||
        event.key === "F12" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }

      // Проверяем, является ли клавиша печатным символом
      if (!isPrintableKey(event.key)) {
        return;
      }

      // Предотвращаем поведение по умолчанию, чтобы символ не добавился дважды
      event.preventDefault();

      // Фокусируем textarea
      if (textareaRef.current) {
        textareaRef.current.focus();
      }

      // Добавляем символ к текущему значению используя функциональную форму
      setInputValue((prevValue) => {
        const newValue = prevValue + event.key;
        return newValue;
      });

      // Автоматически изменяем высоту textarea
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        const minHeight = window.innerWidth < 640 ? 20 : 24;
        textareaRef.current.style.height =
          Math.min(textareaRef.current.scrollHeight, 200) + "px";
      }
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [isChatSelected, isInlineLibraryOpen, selectionActive, contextMenuVisible, textareaRef, setInputValue]);

  // Поддержка ESC для отмены выделения
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape" && selectionActive) {
        e.preventDefault();
        clearSelection();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [selectionActive, clearSelection]);
}

