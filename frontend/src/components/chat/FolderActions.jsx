import React, { useEffect, useRef, useState } from "react";
import { getActionIcon } from "../../utils/actionIcons";
import { useLanguage } from "../../contexts/LanguageContext";

// Smoothly animates appear/disappear. Use `isOpen` to control visibility.
// On exit animation end, calls `onExited`.
const FolderActions = ({
  isOpen = true,
  onExited,
  closeOnOutside = true,
  folderId,
  onEdit,
  onAddChats,
  onDelete,
  onHide, // for system folders
  onShow, // for system folders
  isSystemFolder = false,
  isHiddenSystemFolder = false,
  mousePosition = null, // { x, y } coordinates
}) => {
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

  if (!isRendered) return null;

  const closeMenu = () => setIsShown(false);

  const handleAction = (callback) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (typeof callback === "function") {
      // Pass folderId if consumer expects it
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
    const menuWidth = 160; // Menu width
    const menuHeight = 120; // Approximate menu height (3 items * ~40px each)

    // Ensure menu doesn't go off screen
    const adjustedX = Math.min(x, window.innerWidth - menuWidth - 10);
    const adjustedY = Math.min(y + 5, window.innerHeight - menuHeight - 10);

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
        "z-[9999] w-[160px] rounded-[12px] shadow-lg overflow-hidden " +
        "bg-white/15 dark:bg-[rgba(0,0,0,0.15)] backdrop-blur-[12px] backdrop-saturate-[180%] border border-white/10 dark:border-white/10 " +
        (isShown
          ? "opacity-100 scale-100 transition-all duration-150 ease-out"
          : "opacity-0 scale-95 transition-all duration-200 ease-in")
      }
    >
      {isSystemFolder ? (
        <ul className="select-none">
          <li>
            <button
              type="button"
              className="w-full text-left flex items-center px-3 py-2 text-[var(--accent)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
              onClick={handleAction(isHiddenSystemFolder ? onShow : onHide)}
            >
              {React.createElement(getActionIcon("hide"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" })}
              <span className="text-sm">{isHiddenSystemFolder ? t("chat.showFolder") : t("chat.hideFolder")}</span>
            </button>
          </li>
        </ul>
      ) : (
        <ul className="select-none divide-y divide-[var(--border-light)] dark:divide-[var(--border-dark)]">
          <li>
            <button
              type="button"
              className="w-full text-left flex items-center px-3 py-2 text-[var(--accent)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
              onClick={handleAction(onEdit)}
            >
              {React.createElement(getActionIcon("edit"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" })}
              <span className="text-sm">{t("chat.editFolder")}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="w-full text-left flex items-center px-3 py-2 text-[var(--accent)] hover:bg-[var(--hover-light)] dark:hover:bg-[var(--hover-dark)] transition-colors duration-150"
              onClick={handleAction(onAddChats)}
            >
              {React.createElement(getActionIcon("add"), { className: "text-[var(--icon-light)] dark:text-[var(--icon-dark)] mr-2 text-lg" })}
              <span className="text-sm">{t("chat.addChats")}</span>
            </button>
          </li>
          <li>
            <button
              type="button"
              className="w-full text-left flex items-center px-3 py-2 text-[var(--accent)] hover:bg-[var(--hover-red-light)] dark:hover:bg-[var(--hover-red-dark)] transition-colors duration-150"
              onClick={handleAction(onDelete)}
            >
              {React.createElement(getActionIcon("delete"), { className: "text-[var(--primary)] mr-2 text-lg" })}
              <span className="text-sm font-medium">{t("common.delete")}</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
};

export default FolderActions;
