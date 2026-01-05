import React from "react";
import { getActionIcon } from "../../utils/actionIcons";
import { useContextMenuAnimation } from "../../hooks/modal/useContextMenuAnimation";

// Контекстное меню для системного чата Saved Messages
const SystemChatActions = ({
  isOpen = true,
  onExited,
  closeOnOutside = true,
  chatId,
  conversationId,
  onPinToTop,
  onHideChat,
  mousePosition = null,
  isPinned = false,
  // Пропсы для закрепления в папках
  folderId = null,
  onPinInFolder = null,
  onUnpinFromFolder = null,
  isPinnedInFolder = false,
}) => {
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

  const handleAction = (callback) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof callback === "function") {
      // Pass chatId, conversationId, folderId if consumer expects them
      callback({ chatId, conversationId, folderId });
    }
    closeMenu();
  };

  // Calculate position based on mouse coordinates
  const getPositionStyle = () => {
    if (!mousePosition) {
      return {}; // Use default positioning
    }

    const { x, y } = mousePosition;
    const menuWidth = 180; // Menu width
    const menuHeight = 70; // Approximate menu height (2 items * ~35px each)

    // Get left panel width from CSS variable
    const leftPanelWidth = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue(
        "--left-panel-width"
      ) || "350"
    );

    // Ensure menu doesn't go off screen and stays within left panel
    const maxX = Math.min(
      leftPanelWidth - menuWidth - 10,
      window.innerWidth - menuWidth - 10
    );
    const adjustedX = Math.max(10, Math.min(x, maxX)); // Ensure minimum 10px margin from left edge
    const adjustedY = Math.min(y + 10, window.innerHeight - menuHeight - 10);

    return {
      position: "fixed",
      left: `${adjustedX}px`,
      top: `${adjustedY}px`,
    };
  };

  return (
    <div
      ref={containerRef}
      onTransitionEnd={handleTransitionEnd}
      style={{
        ...cssVars,
        ...getPositionStyle(),
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
            className="w-full text-left flex items-center px-3 py-2 text-[var(--accent)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
            onClick={handleAction(
              isPinnedInFolder ? onUnpinFromFolder : onPinInFolder
            )}
          >
            {React.createElement(getActionIcon("pin"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" })}
            <span className="text-sm">{isPinnedInFolder ? "Unpin from folder" : "Pin in folder"}</span>
          </button>
        </li>
        <li>
          <button
            type="button"
            className="w-full text-left flex items-center px-3 py-2 text-[var(--accent)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
            onClick={handleAction(onHideChat)}
          >
            {React.createElement(getActionIcon("hide"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" })}
            <span className="text-sm">Спрятать чат</span>
          </button>
        </li>
      </ul>
    </div>
  );
};

export default SystemChatActions;
