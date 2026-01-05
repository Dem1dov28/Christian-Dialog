import { createPortal } from "react-dom";

/**
 * Компонент индикатора даты в верхней части чата
 */
export default function ChatDateIndicator({
  topVisibleDate,
  datePosition,
  isDateVisible,
  theme,
  shouldShowToolsBar,
}) {
  if (
    !topVisibleDate ||
    typeof document === "undefined" ||
    datePosition.width <= 0
  ) {
    return null;
  }

  // Вычисляем позицию: если показывается ToolsBar, добавляем его высоту (95px) + top (8px) + отступ (8px) = 111px
  const toolsBarHeight = shouldShowToolsBar ? 111 : 0;
  const adjustedTop = datePosition.top + toolsBarHeight;

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: `${adjustedTop}px`,
        left: `${datePosition.left}px`,
        transform: "translateX(-50%)",
        zIndex: 50,
        pointerEvents: isDateVisible ? "auto" : "none",
        maxWidth: `${Math.min(datePosition.width - 2 * 16, 400)}px`,
        opacity: isDateVisible ? 1 : 0,
        transition: "opacity 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      <div
        className="px-3 py-1 rounded-full text-xs font-medium"
        style={{
          backgroundColor:
            theme === "light" || theme === "pastel"
              ? "rgba(255, 255, 255, 0.15)"
              : "rgba(0, 0, 0, 0.15)",
          color:
            theme === "light" || theme === "pastel"
              ? "rgba(0, 0, 0, 0.7)"
              : "rgba(255, 255, 255, 0.8)",
          backdropFilter: "blur(12px) saturate(180%)",
          WebkitBackdropFilter: "blur(12px) saturate(180%)",
          pointerEvents: "auto",
          boxShadow: "0 2px 15px rgba(0, 0, 0, 0.15)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        {topVisibleDate}
      </div>
    </div>,
    document.body
  );
}


