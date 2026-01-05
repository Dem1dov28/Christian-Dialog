import { useEffect, useRef, useCallback } from "react";

/**
 * Custom hook for automatic focus on input field when user starts typing
 * Similar to Telegram's behavior where typing automatically focuses the message input
 *
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether auto-focus is enabled
 * @param {string} options.inputSelector - CSS selector for the input field
 * @param {Array} options.excludeSelectors - Array of CSS selectors to exclude from auto-focus
 * @param {number} options.debounceMs - Debounce delay in milliseconds
 * @returns {Object} - Object containing refs and methods
 */
export const useAutoFocus = ({
  enabled = true,
  inputSelector = "#message-input",
  excludeSelectors = [
    "input",
    "textarea",
    "[contenteditable]",
    '[role="textbox"]',
    ".ql-editor", // Quill editor
    ".ProseMirror", // TipTap editor
    '[data-testid*="input"]',
    '[data-testid*="textarea"]',
  ],
  debounceMs = 100,
} = {}) => {
  const inputRef = useRef(null);
  const timeoutRef = useRef(null);
  const lastKeyTimeRef = useRef(0);

  // Debounced focus function
  const focusInput = useCallback(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Debounce the focus action
    timeoutRef.current = setTimeout(() => {
      const inputElement =
        inputRef.current || document.querySelector(inputSelector);

      if (inputElement && document.activeElement !== inputElement) {
        // Check if the current active element is not an input field
        const activeElement = document.activeElement;
        const isExcludedElement = excludeSelectors.some((selector) => {
          if (selector.startsWith("[") && selector.endsWith("]")) {
            // Attribute selector
            return activeElement.matches(selector);
          } else {
            // Tag selector
            return (
              activeElement.tagName.toLowerCase() === selector.toLowerCase()
            );
          }
        });

        if (!isExcludedElement) {
          inputElement.focus();
          // Scroll input into view if needed
          inputElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }, debounceMs);
  }, [enabled, inputSelector, excludeSelectors, debounceMs]);

  // Handle keydown events
  const handleKeyDown = useCallback(
    (event) => {
      if (!enabled) return;

      // Ignore special keys and modifier keys
      const specialKeys = [
        "Tab",
        "Escape",
        "F1",
        "F2",
        "F3",
        "F4",
        "F5",
        "F6",
        "F7",
        "F8",
        "F9",
        "F10",
        "F11",
        "F12",
        "Alt",
        "Control",
        "Meta",
        "Shift",
        "CapsLock",
        "NumLock",
        "ScrollLock",
        "ArrowUp",
        "ArrowDown",
        "ArrowLeft",
        "ArrowRight",
        "PageUp",
        "PageDown",
        "Home",
        "End",
        "Insert",
        "Delete",
        "Backspace",
        "Enter",
        "Space",
      ];

      if (specialKeys.includes(event.key)) {
        return;
      }

      // Check if user is already typing in an input field
      const activeElement = document.activeElement;
      const isInputField =
        activeElement &&
        (activeElement.tagName === "INPUT" ||
          activeElement.tagName === "TEXTAREA" ||
          activeElement.contentEditable === "true" ||
          activeElement.getAttribute("role") === "textbox");

      if (!isInputField) {
        // Check if the key is a printable character
        const isPrintableChar =
          event.key.length === 1 &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.key.match(/[\u0000-\u001F]/) &&
          !event.key.startsWith("F");

        if (isPrintableChar) {
          // Prevent the default behavior to avoid losing the character
          event.preventDefault();

          // Immediately focus the input
          const inputElement =
            inputRef.current || document.querySelector(inputSelector);
          if (inputElement) {
            inputElement.focus();

            // Insert the character directly into the input
            const currentValue = inputElement.value || "";
            const cursorPosition =
              inputElement.selectionStart || currentValue.length;
            const newValue =
              currentValue.slice(0, cursorPosition) +
              event.key +
              currentValue.slice(cursorPosition);

            // Update the input value
            inputElement.value = newValue;

            // Set cursor position after the inserted character
            const newCursorPosition = cursorPosition + 1;
            inputElement.setSelectionRange(
              newCursorPosition,
              newCursorPosition
            );

            // Trigger input event to notify React about the change
            const inputEvent = new Event("input", { bubbles: true });
            inputElement.dispatchEvent(inputEvent);

            // Scroll input into view if needed
            inputElement.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }
      }
    },
    [enabled, inputSelector]
  );

  // Handle click events (optional - focuses input when clicking on chat area)
  const handleClick = useCallback(
    (event) => {
      if (!enabled) return;

      // Check if click is on an interactive element
      const interactiveElements = [
        "button",
        "a",
        "input",
        "textarea",
        "select",
        "option",
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        "[onclick]",
        '[data-testid*="button"]',
        '[data-testid*="link"]',
      ];

      const isInteractiveElement = interactiveElements.some((selector) => {
        return event.target.matches(selector) || event.target.closest(selector);
      });

      // If clicking on chat area (not on interactive elements), focus input
      if (!isInteractiveElement) {
        const chatContainer = event.target.closest(
          ".chat-container, .messages-container, .chat-messages"
        );
        if (chatContainer) {
          const inputElement =
            inputRef.current || document.querySelector(inputSelector);
          if (inputElement) {
            inputElement.focus();
            inputElement.scrollIntoView({
              behavior: "smooth",
              block: "nearest",
            });
          }
        }
      }
    },
    [enabled, inputSelector]
  );

  // Set up event listeners
  useEffect(() => {
    if (!enabled) return;

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("click", handleClick, true);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("click", handleClick, true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, handleKeyDown, handleClick]);

  // Manual focus function
  const manualFocus = useCallback(() => {
    const inputElement =
      inputRef.current || document.querySelector(inputSelector);
    if (inputElement) {
      inputElement.focus();
      inputElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [inputSelector]);

  return {
    inputRef,
    manualFocus,
    focusInput,
  };
};

export default useAutoFocus;
