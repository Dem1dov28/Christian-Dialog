import React, { useRef, useEffect } from "react";
import { getActionIcon } from "../../utils/actionIcons";
import { useContextMenuAnimation } from "../../hooks/modal/useContextMenuAnimation";
import { useLanguage } from "../../contexts/LanguageContext";

// Блокируем ghost click: на мобильных click возникает ~300ms после touchend.
const TOUCH_GUARD_MS = 500;

const isTelegramDesktop = () => {
  if (typeof window === "undefined") return false;
  const platform = window.Telegram?.WebApp?.platform || "";
  return /^(tdesktop|macos)$/i.test(platform);
};

const Actions = ({
  isOpen = true,
  onExited,
  closeOnOutside = true,
  messageId,
  onReply,
  onCopy,
  onPin,
  onDelete,
  onSelect,
  isSelectionMode = false,
  onUnselect,
}) => {
  const { t } = useLanguage();
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (isOpen) openedAtRef.current = Date.now();
  }, [isOpen]);

  const { isRendered, isShown, containerRef, closeMenu, handleTransitionEnd } =
    useContextMenuAnimation({
      isOpen,
      onExited,
      closeOnOutside,
    });

  const cssVars = {
    "--background-dark": "rgba(26, 39, 52, 0.8)",
    "--background-light": "rgba(255, 255, 255, 0.95)",
    "--text-dark": "#ffffff",
    "--text-light": "#1f2937",
    "--icon-dark": "#a0a0a0",
    "--icon-light": "#4b5563",
    "--primary": "#ff3b30",
    "--hover-dark": "rgba(255, 255, 255, 0.05)",
    "--hover-light": "rgba(0, 0, 0, 0.05)",
    "--hover-red-dark": "rgba(255, 59, 48, 0.15)",
    "--hover-red-light": "rgba(255, 59, 48, 0.1)",
    "--border-dark": "rgba(255, 255, 255, 0.1)",
    "--border-light": "rgba(0, 0, 0, 0.1)",
  };

  if (!isRendered) return null;

  const tgDesktop = isTelegramDesktop();

  const handleAction = (callback) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    // Touch guard: только на touch, НЕ в tg-desktop (там мышь)
    if (!tgDesktop) {
      const isTouchDevice = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
      if (isTouchDevice && Date.now() - openedAtRef.current < TOUCH_GUARD_MS) return;
    }
    const msgId = messageId;
    const cb = callback;
    // В tg-desktop WebView: закрываем меню и выполняем в setTimeout — обходим проблемы с event propagation
    if (tgDesktop) {
      closeMenu();
      setTimeout(() => { if (typeof cb === "function") cb(msgId); }, 0);
    } else {
      if (typeof cb === "function") cb(msgId);
      closeMenu();
    }
  };

  // В tg-desktop onMouseDown срабатывает надёжнее, чем onClick
  const actionProps = (callback) =>
    tgDesktop
      ? { onMouseDown: handleAction(callback) }
      : { onClick: handleAction(callback) };

  return (
    <div
      ref={containerRef}
      onTransitionEnd={handleTransitionEnd}
      style={{
        ...cssVars,
        willChange: "opacity, transform",
      }}
      className={
        "w-full z-[9999] max-w-[200px] rounded-[14px] shadow-lg overflow-hidden " +
        "bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] border border-white/10 dark:border-white/10 " +
        (isShown
          ? "opacity-100 scale-100 transition-all duration-180 ease-out"
          : "opacity-0 scale-95 transition-all duration-220 ease-in")
      }
    >
      <ul className="select-none divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
        {isSelectionMode ? (
          <>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-4 py-3 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
                {...actionProps(onCopy)}
              >
                {React.createElement(getActionIcon("copy"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-3 text-xl" })}
                <span className="text-base">Copy Text</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-4 py-3 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
                onClick={handleAction(onUnselect)}
              >
                {React.createElement(getActionIcon("close"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-3 text-xl" })}
                <span className="text-base">Unselect</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-4 py-3 text-[var(--primary)] hover:bg-[var(--hover-red-light)] dark:hover:bg-[var(--hover-red-dark)] transition-colors duration-150"
                {...actionProps(onDelete)}
              >
                {React.createElement(getActionIcon("delete"), { className: "text-[var(--primary)] mr-3 text-xl" })}
                <span className="text-base font-medium">Delete</span>
              </button>
            </li>
          </>
        ) : (
          <>
            {onSelect && (
              <li>
                <button
                  type="button"
                  className="w-full text-left flex items-center px-4 py-3 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
                  {...actionProps(onSelect)}
                >
                  {React.createElement(getActionIcon("select"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-3 text-xl" })}
                  <span className="text-base">{t("chat.selectMessage")}</span>
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-4 py-3 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
                {...actionProps(onReply)}
              >
                {React.createElement(getActionIcon("reply"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-3 text-xl" })}
                <span className="text-base">{t("chat.reply")}</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-4 py-3 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
                {...actionProps(onCopy)}
              >
                {React.createElement(getActionIcon("copy"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-3 text-xl" })}
                <span className="text-base">Copy Text</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-4 py-3 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
                {...actionProps(onPin)}
              >
                {React.createElement(getActionIcon("pin"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-3 text-xl" })}
                <span className="text-base">Pin</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-4 py-3 text-[var(--primary)] hover:bg-[var(--hover-red-light)] dark:hover:bg-[var(--hover-red-dark)] transition-colors duration-150"
                {...actionProps(onDelete)}
              >
                {React.createElement(getActionIcon("delete"), { className: "text-[var(--primary)] mr-3 text-xl" })}
                <span className="text-base font-medium">Delete</span>
              </button>
            </li>
          </>
        )}
      </ul>
    </div>
  );
};

export default Actions;
