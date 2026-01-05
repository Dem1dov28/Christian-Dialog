import React, { useEffect, useRef, useState } from "react";
import { getActionIcon } from "../../utils/actionIcons";
import { useLanguage } from "../../contexts/LanguageContext";

const FolderContextMenu = ({
  isOpen = true,
  onExited,
  closeOnOutside = true,
  mousePosition = null,
  folderId,
  isSystemFolder = false,
  onConfigureFolder,
  onDeleteFolder,
  onHideFolder,
  onMarkAsRead,
}) => {
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const containerRef = useRef(null);
  const { t } = useLanguage();

  // Mount on open
  useEffect(() => {
    if (isOpen) {
      setIsRendered(true);
      requestAnimationFrame(() => setIsShown(true));
    } else {
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

  if (!isRendered) return null;

  const closeMenu = () => setIsShown(false);

  const handleAction = (callback) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof callback === "function") {
      callback(folderId);
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
    // Approximate menu height: 1 item for mark as read + 1 for system folder, or + 2 for custom folder
    const menuHeight = isSystemFolder ? 100 : 150;

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
            className="w-full text-left flex items-center px-3 py-2 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
            onClick={handleAction(onMarkAsRead)}
          >
            {React.createElement(getActionIcon("checkCircle"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" })}
            <span className="text-sm">Пометить как прочитанное</span>
          </button>
        </li>
        {isSystemFolder ? (
          <li>
            <button
              type="button"
              className="w-full text-left flex items-center px-3 py-2 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
              onClick={handleAction(onHideFolder)}
            >
              {React.createElement(getActionIcon("hide"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" })}
              <span className="text-sm">Скрыть папку</span>
            </button>
          </li>
        ) : (
          <>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-3 py-2 text-[var(--text-light)] dark:text-[var(--text-dark)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
                onClick={handleAction(onConfigureFolder)}
              >
                {React.createElement(getActionIcon("settings"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" })}
                <span className="text-sm">Настроить папку</span>
              </button>
            </li>
            <li>
              <button
                type="button"
                className="w-full text-left flex items-center px-3 py-2 text-[var(--primary)] hover:bg-[var(--hover-red-light)] dark:hover:bg-[var(--hover-red-dark)] transition-colors duration-150"
                onClick={handleAction(onDeleteFolder)}
              >
                {React.createElement(getActionIcon("delete"), { className: "text-[var(--primary)] mr-2 text-lg" })}
                <span className="text-sm font-medium">Удалить папку</span>
              </button>
            </li>
          </>
        )}
      </ul>
    </div>
  );
};

export default FolderContextMenu;

