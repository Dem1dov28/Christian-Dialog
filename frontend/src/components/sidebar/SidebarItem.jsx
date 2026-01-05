import React, { useCallback } from "react";

// Formats unread counts according to rules: 0 hidden, 1-99 exact, >=100 clamped
const clampCount = (count, max = 99, clampLabel = "99+") => {
  if (typeof count !== "number" || count <= 0) return "";
  if (count <= max) return String(count);
  return clampLabel;
};

const SidebarItem = ({
  id,
  label,
  icon: Icon,
  active = false,
  disabled = false,
  unreadCount = 0,
  accent = false,
  onClick,
  onContextMenu,
  isDragging = false,
  isDragOver = false,
}) => {
  const display = clampCount(unreadCount, 99, "99+");
  const ariaLabel =
    unreadCount > 0 ? `${label}, непрочитанных: ${display}` : label;

  const handleRipple = useCallback(
    (event) => {
      if (disabled) return;
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      const ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.width = `${size * 2}px`;
      ripple.style.height = `${size * 2}px`;
      const x = event.clientX - rect.left - size;
      const y = event.clientY - rect.top - size;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      button.appendChild(ripple);

      const remove = () => {
        ripple.removeEventListener("animationend", remove);
        if (ripple.parentNode === button) {
          button.removeChild(ripple);
        }
      };
      ripple.addEventListener("animationend", remove);
    },
    [disabled]
  );

  const handleClick = useCallback(
    (event) => {
      handleRipple(event);
      if (typeof onClick === "function") onClick(event);
    },
    [handleRipple, onClick]
  );

  const handleContextMenu = useCallback(
    (event) => {
      if (disabled) return;
      event.preventDefault();
      event.stopPropagation();
      if (typeof onContextMenu === "function") {
        onContextMenu(event, id);
      }
    },
    [disabled, onContextMenu, id]
  );

  return (
    <button
      type="button"
      data-id={id}
      className={`has-ripple relative group w-full flex flex-col items-center p-2.5 rounded-lg transition-all duration-200 select-none ${
        active
          ? "text-[var(--text-white)]"
          : "text-[var(--text-white)] hover:bg-[var(--hover-bg)]"
      } ${disabled ? "opacity-60 cursor-not-allowed" : ""} ${
        isDragging ? "opacity-50 scale-95" : ""
      } ${
        isDragOver ? "scale-105 ring-2 ring-purple-400" : ""
      }`}
      aria-label={ariaLabel}
      aria-current={active ? "page" : undefined}
      disabled={disabled}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <span
        className="icon-box relative inline-flex items-center justify-center w-9 h-9"
        style={{ transform: "scale(1.3)" }}
      >
        {Icon ? <Icon className={`text-3xl ${active ? "text-[var(--accent)]" : "text-[var(--text-white)]"}`} /> : null}
        {display && (
          <span
            className={`badge absolute -top-0.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full font-bold text-[10px] leading-[16px] text-center whitespace-nowrap pointer-events-none z-10 ring-2 transition-all duration-200 ${
              active
                ? "ring-[var(--bg-primary)]"
                : "ring-[var(--bg-primary)] group-hover:ring-[var(--hover-bg)]"
            } `}
            style={{
              right: "-2px",
              background: active ? "var(--accent)" : "var(--icon-color)",
              color: "#FFFFFF",
              transform: "scale(0.9)",
            }}
          >
            {display}
          </span>
        )}
      </span>
      <span className="text-[10px] mt-1 leading-tight text-center w-16 break-words font-comfortaa">
        {label}
      </span>
    </button>
  );
};

export default SidebarItem;
