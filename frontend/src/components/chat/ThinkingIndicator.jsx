import React, { useMemo, useEffect } from "react";
import { useOptimizedThinkingDots } from "../../hooks/message/useOptimizedMessageAnimations";

export default function ThinkingIndicator({
  isVisible = true,
  variant = "dots", // "dots", "spinner", or "loader"
  size = "medium", // "small", "medium", "large"
  color = "rgba(255, 255, 255, 0.9)", // Более белый цвет по умолчанию
  estimatedDuration = 2000, // Estimated duration for AI to think
  className = "",
}) {
  // Используем оптимизированные thinking dots только если видимы
  const {
    dots,
    isVisible: dotsVisible,
    show,
    hide,
  } = useOptimizedThinkingDots({
    estimatedDuration,
  });

  // Автоматически показываем/скрываем точки при изменении isVisible
  useEffect(() => {
    if (isVisible) {
      show();
    } else {
      hide();
    }
  }, [isVisible, show, hide]);

  // Мемоизируем видимость для предотвращения лишних перерендеров
  const shouldShow = useMemo(() => {
    return isVisible && dotsVisible && dots.length > 0;
  }, [isVisible, dotsVisible, dots.length]);

  // Мемоизируем размеры
  const sizeClasses = useMemo(() => {
    switch (size) {
      case "small":
        return "text-sm";
      case "large":
        return "text-2xl";
      default:
        return "text-lg";
    }
  }, [size]);

  // Минималистичные стили как в Cursor
  const sizeStyles = { fontWeight: 400 };

  // Расстояние между точками
  const gap = useMemo(() => {
    switch (size) {
      case "small":
        return "4px";
      case "large":
        return "8px";
      default:
        return "6px";
    }
  }, [size]);

  // Рендер лоадера
  if (variant === "loader") {
    const loaderSize = size === "small" ? 30 : size === "large" ? 70 : 50;
    const loaderStyles = {
      height: `${loaderSize}px`,
      aspectRatio: '2',
      border: `10px solid ${color}`,
      boxSizing: 'border-box',
      background: [
        `radial-gradient(farthest-side, ${color} 98%, transparent) left/20px 20px`,
        `radial-gradient(farthest-side, ${color} 98%, transparent) left/20px 20px`,
        `radial-gradient(farthest-side, ${color} 98%, transparent) center/20px 20px`,
        `radial-gradient(farthest-side, ${color} 98%, transparent) right/20px 20px`,
        color
      ].join(','),
      backgroundRepeat: 'no-repeat',
      filter: 'blur(4px) contrast(10)',
      animation: 'l14 1s infinite',
      mixBlendMode: 'screen'
    };

    const keyframes = `
      @keyframes l14 {
        100% { background-position: right, left, center, right; }
      }
    `;

    return (
      <div className={`flex items-center justify-center ${className}`}>
        <style>{keyframes}</style>
        <div style={loaderStyles} />
      </div>
    );
  }

  // Рендер спиннера
  if (variant === "spinner") {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div
          className="thinking-spinner"
          style={{
            width:
              size === "small" ? "16px" : size === "large" ? "24px" : "20px",
            height:
              size === "small" ? "16px" : size === "large" ? "24px" : "20px",
            borderColor: color.replace("0.9", "0.2"),
            borderTopColor: color,
          }}
        />
      </div>
    );
  }

  // Fallback для случаев когда анимация не работает
  if (!shouldShow) {
    return (
      <div
        className={`thinking-indicator-container ${className}`}
        style={{
          display: "flex",
          alignItems: "center",
          gap: gap,
        }}
      >
        <span
          className={`${sizeClasses} leading-none thinking-dot-fallback`}
          style={{
            color,
            ...sizeStyles,
          }}
        >
          •
        </span>
        <span
          className={`${sizeClasses} leading-none thinking-dot-fallback`}
          style={{
            color,
            ...sizeStyles,
          }}
        >
          •
        </span>
        <span
          className={`${sizeClasses} leading-none thinking-dot-fallback`}
          style={{
            color,
            ...sizeStyles,
          }}
        >
          •
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: gap,
      }}
    >
      {dots.map((dot, index) => (
        <span
          key={dot.id}
          style={{
            color,
            ...sizeStyles,
            display: "inline-block",
          }}
          className={`${sizeClasses} leading-none thinking-dot-animation`}
        >
          •
        </span>
      ))}
    </div>
  );
}
