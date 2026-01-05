import React, { useEffect, useRef, useState } from "react";
import { MdPerson, MdReport, MdDelete, MdClear, MdBookmark, MdExitToApp, MdNotifications } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";
import { useChats } from "../../contexts/ChatsContext";
import { useNotification } from "../../contexts/NotificationContext";

export default function HeaderMenu({
  isOpen,
  closeOnOutside,
  mousePosition,
  onShowProfile,
  onReport,
  onClearHistory,
  onDeleteChat,
  onSavedMessages,
  onUnsubscribeChannel,
  isRightPanelOpen,
  onExited,
}) {
  const { activeConversation, subscribeToChannel } = useChats();
  const { showSuccess, showError } = useNotification();
  const isChannelChat = activeConversation?.is_channel ?? false;
  const isSubscribed = isChannelChat && (activeConversation?.isSubscribed === true || activeConversation?.is_subscribed === true);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const containerRef = useRef(null);
  const { t } = useLanguage();

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
      if (containerEl.contains(event.target)) return;
      setIsShown(false);
    };

    document.addEventListener("mousedown", handlePointerDown, true);
    document.addEventListener("touchstart", handlePointerDown, true);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown, true);
      document.removeEventListener("touchstart", handlePointerDown, true);
    };
  }, [isRendered, closeOnOutside]);

  const handleTransitionEnd = (event) => {
    if (event.target !== containerRef.current) return;
    if (!isShown) {
      setIsRendered(false);
      if (typeof onExited === "function") onExited();
    }
  };

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

  const closeMenu = () => setIsShown(false);

  const handleAction = (callback) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    console.log("HeaderMenu handleAction called with callback:", callback);
    if (typeof callback === "function") {
      callback();
    }
    closeMenu();
  };

  const menuContent = !isRendered ? null : (
    <div
      ref={containerRef}
      onTransitionEnd={handleTransitionEnd}
      style={{
        ...cssVars,
        willChange: "opacity, transform",
      }}
      className={
        "z-[9999] w-[180px] rounded-[12px] shadow-lg overflow-hidden " +
        "bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] border border-white/10 dark:border-white/10 " +
        (isShown
          ? "opacity-100 scale-100 transition-all duration-150 ease-out"
          : "opacity-0 scale-95 transition-all duration-200 ease-in")
      }
    >
      <ul className="select-none divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
        <li>
          <button
            type="button"
            className="w-full text-left flex items-center px-3 py-2 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
            onClick={handleAction(onShowProfile)}
          >
            <MdPerson className="text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" />
            <span className="text-sm">{t("profile.title")}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="w-full text-left flex items-center px-3 py-2 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
            onClick={async (event) => {
              event.preventDefault();
              event.stopPropagation();
              console.log("Saved Messages clicked in HeaderMenu");
              if (typeof onSavedMessages === "function") {
                await onSavedMessages();
              }
              closeMenu();
            }}
          >
            <MdBookmark className="text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" />
            <span className="text-sm">{t("chat.savedMessages")}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="w-full text-left flex items-center px-3 py-2 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
            onClick={handleAction(onReport)}
          >
            <MdReport className="text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" />
            <span className="text-sm">{t("chat.report")}</span>
          </button>
        </li>
        {!isChannelChat && (
          <li>
            <button
              type="button"
              className="w-full text-left flex items-center px-3 py-2 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
              onClick={handleAction(onClearHistory)}
            >
              <MdClear className="text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" />
              <span className="text-sm">{t("chat.clearChat")}</span>
            </button>
          </li>
        )}
        <li>
          {isChannelChat ? (
            <button
              type="button"
              className="w-full text-left flex items-center px-3 py-2 text-[var(--primary)] hover:bg-[var(--hover-red-light)] dark:hover:bg-[var(--hover-red-dark)] transition-colors duration-150"
              onClick={async (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!activeConversation?.id) return;

                if (isSubscribed) {
                  // Отписка от канала - открываем модальное окно
                  closeMenu();
                  if (typeof onUnsubscribeChannel === "function") {
                    onUnsubscribeChannel();
                  }
                } else {
                  // Подписка на канал - сразу подписываем
                  try {
                    if (subscribeToChannel) {
                      await subscribeToChannel(activeConversation.id);
                      showSuccess(
                        t("library.subscribeChannelSuccess", {
                          defaultValue: "Вы подписались на канал",
                        })
                      );
                    }
                    closeMenu();
                  } catch (error) {
                    console.error("Failed to subscribe to channel:", error);
                    showError(
                      error.message ||
                        t("library.subscribeChannelError", {
                          defaultValue: "Не удалось подписаться на канал",
                        })
                    );
                  }
                }
              }}
            >
              {isSubscribed ? (
                <>
                  <MdExitToApp className="text-[var(--primary)] mr-2 text-lg" />
                  <span className="text-sm font-medium">Отписаться</span>
                </>
              ) : (
                <>
                  <MdNotifications className="text-[var(--primary)] mr-2 text-lg" />
                  <span className="text-sm font-medium">Подписаться</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              className="w-full text-left flex items-center px-3 py-2 text-[var(--primary)] hover:bg-[var(--hover-red-light)] dark:hover:bg-[var(--hover-red-dark)] transition-colors duration-150"
              onClick={handleAction(onDeleteChat)}
            >
              <MdDelete className="text-[var(--primary)] mr-2 text-lg" />
              <span className="text-sm font-medium">{t("chat.deleteChat")}</span>
            </button>
          )}
        </li>
      </ul>
    </div>
  );

  return menuContent;
}
