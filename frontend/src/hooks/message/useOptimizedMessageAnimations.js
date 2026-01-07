/**
 * Оптимизированный хук для анимаций сообщений
 *
 * Предоставляет высокопроизводительные анимации с GPU-ускорением,
 * батчингом и адаптивными настройками для разных устройств.
 */

import { useSpring, useTransition } from "@react-spring/web";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  getAnimationConfig,
  getThinkingDotsConfig,
  isAnimationSupported,
  getDeviceType,
  getPerformanceLevel,
  AnimationType,
  DeviceType,
  PerformanceLevel,
} from "../../config/animations";
import { animationUtils } from "../../utils/animationUtils";

// Константы для оптимизации
const PERFORMANCE_TARGET_FPS = 60;
const PERFORMANCE_CHECK_INTERVAL = 2000; // Увеличено для снижения нагрузки
const MAX_CONCURRENT_ANIMATIONS = 5; // Максимум одновременных анимаций

/**
 * Фильтрует конфигурацию анимации для react-spring
 * Удаляет easing, так как react-spring использует физическую модель (mass, tension, friction)
 */
const filterSpringConfig = (config) => {
  if (!config) return {};
  const { easing, ...rest } = config;
  return rest;
};

/**
 * Оптимизированный хук для анимаций сообщений
 */
export const useOptimizedMessageAnimations = (options = {}) => {
  const {
    enabled = true,
    deviceType: overrideDeviceType,
    performanceLevel: overridePerformanceLevel,
    onPerformanceIssue,
  } = options;

  // Состояние
  const [isReducedMotion, setIsReducedMotion] = useState(false);
  const [animationSupported, setAnimationSupported] = useState(true);
  const [performanceMetrics, setPerformanceMetrics] = useState({
    fps: 60,
    frameDrops: 0,
    memoryUsage: 0,
  });

  // Рефы для оптимизации
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());
  const animationFrameRef = useRef();
  const activeAnimationsRef = useRef(0);

  // Мемоизированные значения
  const deviceType = useMemo(
    () => overrideDeviceType || getDeviceType(),
    [overrideDeviceType]
  );

  const performanceLevel = useMemo(
    () => overridePerformanceLevel || getPerformanceLevel(),
    [overridePerformanceLevel]
  );

  // Проверка reduced motion
  useEffect(() => {
    const checkReducedMotion = () => {
      if (typeof window !== "undefined") {
        const mediaQuery = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        );
        setIsReducedMotion(mediaQuery.matches);

        const handleChange = (e) => setIsReducedMotion(e.matches);
        mediaQuery.addEventListener("change", handleChange);

        return () => mediaQuery.removeEventListener("change", handleChange);
      }
    };

    checkReducedMotion();
  }, []);

  // Проверка поддержки анимаций
  useEffect(() => {
    setAnimationSupported(isAnimationSupported());
  }, []);

  // Применяем классы производительности к body
  useEffect(() => {
    animationUtils.applyPerformanceClasses(performanceLevel, deviceType);

    return () => {
      // Очищаем классы при размонтировании
      if (typeof document !== "undefined") {
        const body = document.body;
        body.classList.remove(
          "low-performance",
          "medium-performance",
          "high-performance",
          "mobile-device",
          "tablet-device",
          "desktop-device"
        );
      }
    };
  }, [performanceLevel, deviceType]);

  // Оптимизированный мониторинг производительности
  useEffect(() => {
    if (
      !enabled ||
      isReducedMotion ||
      performanceLevel === PerformanceLevel.LOW
    ) {
      return;
    }

    let frameCount = 0;
    let lastTime = performance.now();

    const monitorPerformance = () => {
      const now = performance.now();
      const deltaTime = now - lastTime;

      frameCount++;

      if (deltaTime >= PERFORMANCE_CHECK_INTERVAL) {
        const fps = Math.round((frameCount * 1000) / deltaTime);
        const frameDrops = Math.max(0, PERFORMANCE_TARGET_FPS - fps);

        setPerformanceMetrics((prev) => ({
          fps,
          frameDrops: prev.frameDrops + frameDrops,
          memoryUsage: performance.memory
            ? performance.memory.usedJSHeapSize
            : 0,
        }));

        // Уведомление о проблемах производительности
        if (fps < PERFORMANCE_TARGET_FPS * 0.7) {
          onPerformanceIssue?.({
            fps,
            frameDrops,
            deviceType,
            performanceLevel,
          });
        }

        frameCount = 0;
        lastTime = now;
      }

      animationFrameRef.current = requestAnimationFrame(monitorPerformance);
    };

    animationFrameRef.current = requestAnimationFrame(monitorPerformance);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    enabled,
    isReducedMotion,
    deviceType,
    performanceLevel,
    onPerformanceIssue,
  ]);

  // Оптимизированная анимация появления
  const slideInAnimation = useSpring({
    from: {
      opacity: 0,
      transform: "translate3d(0, 20px, 0) scale(0.95)",
    },
    to: {
      opacity: 1,
      transform: "translate3d(0, 0, 0) scale(1)",
    },
    config: filterSpringConfig(
      getAnimationConfig(
        AnimationType.SLIDE_IN,
        deviceType,
        isReducedMotion,
        performanceLevel
      ).config
    ),
    immediate: !enabled || isReducedMotion,
    onStart: () => {
      activeAnimationsRef.current++;
    },
    onRest: () => {
      activeAnimationsRef.current = Math.max(
        0,
        activeAnimationsRef.current - 1
      );
    },
  });

  // Оптимизированная анимация hover
  const hoverAnimation = useSpring({
    from: { transform: "scale3d(1, 1, 1)" },
    to: { transform: "scale3d(1, 1, 1)" },
    config: filterSpringConfig(
      getAnimationConfig(
        AnimationType.HOVER_EFFECT,
        deviceType,
        isReducedMotion,
        performanceLevel
      ).config
    ),
    immediate: !enabled || isReducedMotion,
  });

  // Оптимизированная анимация ошибки
  const errorAnimation = useSpring({
    from: {
      opacity: 1,
      transform: "scale3d(1, 1, 1)",
      backgroundColor: "rgba(239, 68, 68, 0.1)",
    },
    to: {
      opacity: 0.7,
      transform: "scale3d(1.03, 1.03, 1)",
      backgroundColor: "rgba(239, 68, 68, 0.15)",
    },
    config: filterSpringConfig(
      getAnimationConfig(
        AnimationType.ERROR_PULSE,
        deviceType,
        isReducedMotion,
        performanceLevel
      ).config
    ),
    immediate: !enabled || isReducedMotion,
  });

  // Оптимизированные триггеры анимаций
  const triggerSlideIn = useCallback(() => {
    if (activeAnimationsRef.current >= MAX_CONCURRENT_ANIMATIONS) {
      return; // Пропускаем анимацию если слишком много активных
    }

    slideInAnimation.start({
      from: {
        opacity: 0,
        transform: "translate3d(0, 20px, 0) scale(0.95)",
      },
      to: {
        opacity: 1,
        transform: "translate3d(0, 0, 0) scale(1)",
      },
    });
  }, [slideInAnimation]);

  const triggerHover = useCallback(
    (isHovering) => {
      if (performanceLevel === PerformanceLevel.LOW) {
        return; // Отключаем hover на слабых устройствах
      }

      hoverAnimation.start({
        to: {
          transform: isHovering ? "scale3d(1.02, 1.02, 1)" : "scale3d(1, 1, 1)",
        },
      });
    },
    [hoverAnimation, performanceLevel]
  );

  const triggerError = useCallback(() => {
    errorAnimation.start({
      loop: true,
      to: {
        opacity: 0.7,
        transform: "scale3d(1.03, 1.03, 1)",
        backgroundColor: "rgba(239, 68, 68, 0.15)",
      },
    });
  }, [errorAnimation]);

  const stopError = useCallback(() => {
    errorAnimation.start({
      loop: false,
      to: {
        opacity: 1,
        transform: "scale3d(1, 1, 1)",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
      },
    });
  }, [errorAnimation]);

  // Оптимизированные групповые анимации
  const createOptimizedTransition = useCallback(
    (items, keyFn) => {
      return useTransition(items, {
        from: { opacity: 0, transform: "translate3d(0, 20px, 0)" },
        enter: { opacity: 1, transform: "translate3d(0, 0, 0)" },
        leave: { opacity: 0, transform: "translate3d(0, -20px, 0)" },
        config: filterSpringConfig(
          getAnimationConfig(
            AnimationType.SLIDE_IN,
            deviceType,
            isReducedMotion,
            performanceLevel
          ).config
        ),
        immediate: !enabled || isReducedMotion,
        keys: keyFn,
        trail: performanceLevel === PerformanceLevel.HIGH ? 50 : 0, // Stagger только на мощных устройствах
      });
    },
    [enabled, isReducedMotion, deviceType, performanceLevel]
  );

  // Проверка отключения анимации
  const shouldDisableAnimation = useCallback(
    (animationType) => {
      const shouldDisable =
        !enabled ||
        isReducedMotion ||
        !animationSupported ||
        (performanceLevel === PerformanceLevel.LOW &&
          [AnimationType.HOVER_EFFECT, AnimationType.ERROR_PULSE].includes(
            animationType
          )) ||
        activeAnimationsRef.current >= MAX_CONCURRENT_ANIMATIONS;

      return shouldDisable;
    },
    [enabled, isReducedMotion, animationSupported, performanceLevel]
  );

  // Очистка
  const cleanup = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    activeAnimationsRef.current = 0;
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    // Анимации
    slideInAnimation,
    hoverAnimation,
    errorAnimation,

    // Триггеры
    triggerSlideIn,
    triggerHover,
    triggerError,
    stopError,

    // Групповые анимации
    createOptimizedTransition,

    // Конфигурация
    shouldDisableAnimation,

    // Состояние
    isReducedMotion,
    animationSupported,
    deviceType,
    performanceLevel,
    performanceMetrics,

    // Утилиты
    cleanup,
  };
};

/**
 * Оптимизированный хук для thinking dots
 */
export const useOptimizedThinkingDots = (options = {}) => {
  const { estimatedDuration = 2000 } = options;

  const [isVisible, setIsVisible] = useState(true);

  const dots = useMemo(() => {
    const config = getThinkingDotsConfig(estimatedDuration);
    return Array.from({ length: config.dots.count }, (_, i) => ({ id: i }));
  }, [estimatedDuration]);

  const show = useCallback(() => setIsVisible(true), []);
  const hide = useCallback(() => setIsVisible(false), []);

  return { dots, isVisible, show, hide, estimatedDuration };
};

export default useOptimizedMessageAnimations;
