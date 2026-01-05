/**
 * Утилиты для применения оптимизированных стилей анимаций
 */

/**
 * Утилиты для применения оптимизированных стилей
 */
export const animationUtils = {
  /**
   * Получить классы для анимации сообщения
   */
  getMessageClasses: (animationType, performanceLevel = "high") => {
    const baseClasses = "message-container";

    switch (animationType) {
      case "slide-in":
        return `${baseClasses} message-slide-in message-slide-in-animation`;
      case "fade-in":
        return `${baseClasses} message-fade-in-animation`;
      case "scale-in":
        return `${baseClasses} message-scale-in-animation`;
      default:
        return baseClasses;
    }
  },

  /**
   * Получить стили для hover эффекта
   */
  getHoverStyles: (performanceLevel = "high") => {
    if (performanceLevel === "low") {
      return {};
    }

    return {
      willChange: "transform",
      transform: "translate3d(0, 0, 0)",
      transition: "transform 0.12s cubic-bezier(0.4, 0, 0.2, 1)",
    };
  },

  /**
   * Получить стили для thinking dots
   */
  getThinkingStyles: (performanceLevel = "high") => {
    if (performanceLevel === "low") {
      return {
        animation: "none",
      };
    }

    return {
      willChange: "opacity, transform",
      transform: "translate3d(0, 0, 0)",
    };
  },

  /**
   * Проверить, нужно ли отключить анимации
   */
  shouldDisableAnimations: (performanceLevel, deviceType, reducedMotion) => {
    return (
      reducedMotion ||
      performanceLevel === "low" ||
      (deviceType === "mobile" && performanceLevel === "medium")
    );
  },

  /**
   * Получить классы производительности для body
   */
  getPerformanceClasses: (performanceLevel, deviceType) => {
    const classes = [];

    if (performanceLevel === "low") {
      classes.push("low-performance");
    }

    if (deviceType === "mobile") {
      classes.push("mobile-device");
    }

    return classes.join(" ");
  },

  /**
   * Применить классы производительности к body
   */
  applyPerformanceClasses: (performanceLevel, deviceType) => {
    if (typeof document === "undefined") return;

    const classes = animationUtils.getPerformanceClasses(
      performanceLevel,
      deviceType
    );
    const body = document.body;

    // Удаляем старые классы
    body.classList.remove(
      "low-performance",
      "medium-performance",
      "high-performance",
      "mobile-device",
      "tablet-device",
      "desktop-device"
    );

    // Добавляем новые классы
    if (classes) {
      body.classList.add(...classes.split(" "));
    }

    // Добавляем класс уровня производительности
    body.classList.add(`${performanceLevel}-performance`);

    // Добавляем класс типа устройства
    body.classList.add(`${deviceType}-device`);
  },

  /**
   * Проверить поддержку CSS contain
   */
  supportsCSSContain: () => {
    if (typeof window === "undefined") return false;

    const testEl = document.createElement("div");
    return "contain" in testEl.style;
  },

  /**
   * Проверить поддержку will-change
   */
  supportsWillChange: () => {
    if (typeof window === "undefined") return false;

    const testEl = document.createElement("div");
    return "willChange" in testEl.style;
  },

  /**
   * Получить оптимизированные стили для контейнера сообщения
   */
  getMessageContainerStyles: (performanceLevel = "high") => {
    const baseStyles = {
      transform: "translate3d(0, 0, 0)",
    };

    if (performanceLevel === "high" && animationUtils.supportsCSSContain()) {
      baseStyles.contain = "layout style paint";
    }

    if (performanceLevel === "high" && animationUtils.supportsWillChange()) {
      baseStyles.willChange = "transform, opacity";
    }

    return baseStyles;
  },

  /**
   * Получить оптимизированные стили для контента сообщения
   */
  getMessageContentStyles: (performanceLevel = "high") => {
    const baseStyles = {};

    if (performanceLevel === "high" && animationUtils.supportsCSSContain()) {
      baseStyles.contain = "layout style";
    }

    return baseStyles;
  },
};

export default animationUtils;


