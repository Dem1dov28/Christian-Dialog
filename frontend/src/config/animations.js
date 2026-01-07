/**
 * Конфигурация анимаций для приложения
 * 
 * Предоставляет типы, константы и функции для управления анимациями
 * с учетом производительности устройства и предпочтений пользователя.
 */

// Типы устройств
export const DeviceType = {
  MOBILE: "mobile",
  TABLET: "tablet",
  DESKTOP: "desktop",
};

// Уровни производительности
export const PerformanceLevel = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
};

// Типы анимаций
export const AnimationType = {
  SLIDE_IN: "slide_in",
  SLIDE_OUT: "slide_out",
  FADE_IN: "fade_in",
  FADE_OUT: "fade_out",
  HOVER_EFFECT: "hover_effect",
  ERROR_PULSE: "error_pulse",
  SCALE: "scale",
  ROTATE: "rotate",
};

/**
 * Определяет тип устройства на основе ширины экрана
 */
export const getDeviceType = () => {
  if (typeof window === "undefined") {
    return DeviceType.DESKTOP;
  }

  const width = window.innerWidth;

  if (width < 768) {
    return DeviceType.MOBILE;
  } else if (width < 1024) {
    return DeviceType.TABLET;
  } else {
    return DeviceType.DESKTOP;
  }
};

/**
 * Определяет уровень производительности устройства
 */
export const getPerformanceLevel = () => {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return PerformanceLevel.MEDIUM;
  }

  // Проверка hardwareConcurrency (количество ядер)
  const cores = navigator.hardwareConcurrency || 2;

  // Проверка памяти (если доступно)
  const memory = navigator.deviceMemory || 4;

  // Проверка соединения
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const effectiveType = connection?.effectiveType || "4g";

  // Определение уровня производительности
  if (cores <= 2 || memory <= 2 || effectiveType === "slow-2g" || effectiveType === "2g") {
    return PerformanceLevel.LOW;
  } else if (cores <= 4 || memory <= 4 || effectiveType === "3g") {
    return PerformanceLevel.MEDIUM;
  } else {
    return PerformanceLevel.HIGH;
  }
};

/**
 * Проверяет поддержку анимаций в браузере
 */
export const isAnimationSupported = () => {
  if (typeof window === "undefined") {
    return false;
  }

  // Проверка поддержки CSS animations
  const supportsAnimations = CSS.supports("animation", "test");

  // Проверка поддержки transform
  const supportsTransform = CSS.supports("transform", "translate3d(0,0,0)");

  // Проверка поддержки requestAnimationFrame
  const supportsRAF = typeof requestAnimationFrame !== "undefined";

  return supportsAnimations && supportsTransform && supportsRAF;
};

/**
 * Получает конфигурацию анимации на основе типа и параметров устройства
 */
export const getAnimationConfig = (
  animationType,
  deviceType = DeviceType.DESKTOP,
  isReducedMotion = false,
  performanceLevel = PerformanceLevel.MEDIUM
) => {
  // Базовые настройки для разных типов устройств
  const deviceConfig = {
    [DeviceType.MOBILE]: {
      duration: 200,
      easing: "ease-out",
    },
    [DeviceType.TABLET]: {
      duration: 250,
      easing: "ease-out",
    },
    [DeviceType.DESKTOP]: {
      duration: 300,
      easing: "ease-out",
    },
  };

  // Настройки для разных уровней производительности
  const performanceConfig = {
    [PerformanceLevel.LOW]: {
      duration: 150,
      easing: "linear",
      mass: 0.5,
      tension: 100,
      friction: 20,
    },
    [PerformanceLevel.MEDIUM]: {
      duration: 250,
      easing: "ease-out",
      mass: 1,
      tension: 120,
      friction: 25,
    },
    [PerformanceLevel.HIGH]: {
      duration: 300,
      easing: "ease-out",
      mass: 1,
      tension: 150,
      friction: 30,
    },
  };

  // Если анимации отключены
  if (isReducedMotion) {
    return {
      config: {
        duration: 0,
        immediate: true,
      },
      style: {},
    };
  }

  // Базовые конфигурации для разных типов анимаций
  const animationConfigs = {
    [AnimationType.SLIDE_IN]: {
      from: { opacity: 0, transform: "translate3d(0, 20px, 0)" },
      to: { opacity: 1, transform: "translate3d(0, 0, 0)" },
    },
    [AnimationType.SLIDE_OUT]: {
      from: { opacity: 1, transform: "translate3d(0, 0, 0)" },
      to: { opacity: 0, transform: "translate3d(0, -20px, 0)" },
    },
    [AnimationType.FADE_IN]: {
      from: { opacity: 0 },
      to: { opacity: 1 },
    },
    [AnimationType.FADE_OUT]: {
      from: { opacity: 1 },
      to: { opacity: 0 },
    },
    [AnimationType.HOVER_EFFECT]: {
      from: { transform: "scale3d(1, 1, 1)" },
      to: { transform: "scale3d(1.02, 1.02, 1)" },
    },
    [AnimationType.ERROR_PULSE]: {
      from: {
        opacity: 1,
        transform: "scale3d(1, 1, 1)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
      },
      to: {
        opacity: 0.8,
        transform: "scale3d(1.03, 1.03, 1)",
        backgroundColor: "rgba(239, 68, 68, 0.15)",
      },
    },
    [AnimationType.SCALE]: {
      from: { transform: "scale3d(0.95, 0.95, 1)" },
      to: { transform: "scale3d(1, 1, 1)" },
    },
    [AnimationType.ROTATE]: {
      from: { transform: "rotate(0deg)" },
      to: { transform: "rotate(360deg)" },
    },
  };

  const baseConfig = animationConfigs[animationType] || animationConfigs[AnimationType.FADE_IN];
  const perfConfig = performanceConfig[performanceLevel] || performanceConfig[PerformanceLevel.MEDIUM];
  const devConfig = deviceConfig[deviceType] || deviceConfig[DeviceType.DESKTOP];

  return {
    config: {
      ...perfConfig,
      duration: perfConfig.duration || devConfig.duration,
    },
    style: baseConfig,
  };
};

/**
 * Получает конфигурацию для thinking dots анимации
 */
export const getThinkingDotsConfig = (estimatedDuration = 2000) => {
  return {
    dots: {
      count: 3,
      size: 8,
      spacing: 4,
      color: "rgba(156, 163, 175, 0.8)", // gray-400
    },
    animation: {
      duration: estimatedDuration,
      delay: 150, // Задержка между точками
      easing: "ease-in-out",
    },
  };
};

/**
 * Проверяет, должна ли анимация быть отключена
 */
export const shouldDisableAnimation = (
  animationType,
  deviceType,
  performanceLevel,
  isReducedMotion = false
) => {
  if (isReducedMotion) {
    return true;
  }

  if (performanceLevel === PerformanceLevel.LOW) {
    // Отключаем сложные анимации на слабых устройствах
    return [
      AnimationType.HOVER_EFFECT,
      AnimationType.ERROR_PULSE,
      AnimationType.ROTATE,
    ].includes(animationType);
  }

  return false;
};

export default {
  DeviceType,
  PerformanceLevel,
  AnimationType,
  getDeviceType,
  getPerformanceLevel,
  isAnimationSupported,
  getAnimationConfig,
  getThinkingDotsConfig,
  shouldDisableAnimation,
};

