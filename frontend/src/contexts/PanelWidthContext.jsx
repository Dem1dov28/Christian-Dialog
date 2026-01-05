import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';

const PanelWidthContext = createContext();

export const usePanelWidth = () => {
  const context = useContext(PanelWidthContext);
  if (!context) {
    throw new Error('usePanelWidth must be used within PanelWidthProvider');
  }
  return context;
};

export const PanelWidthProvider = ({ children }) => {
  // Ширина левой панели (sidebar)
  const COMFORTABLE_WIDTH = 300;
  const MOBILE_BREAKPOINT = 768;
  const MEDIUM_BREAKPOINT = 750; // Новый брейкпоинт для диапазона 550-750px
  const ULTRA_COMPACT_BREAKPOINT = 550;
  const MOBILE_SIDEBAR_WIDTH = 250;
  const MEDIUM_SIDEBAR_WIDTH = 320; // Ширина для диапазона 550-750px

  const [sidebarWidth, setSidebarWidth] = useState(() => {
    try {
      const stored = typeof window !== 'undefined' 
        ? window.localStorage.getItem('sidebarWidth') 
        : null;
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (Number.isFinite(parsed) && parsed >= 260 && parsed <= 640) {
        return parsed;
      }
    } catch {}
    return COMFORTABLE_WIDTH;
  });

  // Ширина main панели (центральная часть)
  const [mainWidth, setMainWidth] = useState(() => {
    if (typeof window === 'undefined') {
      return 800;
    }
    return window.innerWidth;
  });

  // Пользовательская ширина (сохраняется, когда пользователь вручную меняет размер)
  const [userPreferredWidth, setUserPreferredWidth] = useState(() => {
    try {
      const stored = typeof window !== 'undefined' 
        ? window.localStorage.getItem('userPreferredSidebarWidth') 
        : null;
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (Number.isFinite(parsed) && parsed >= 260 && parsed <= 640) {
        return parsed;
      }
    } catch {}
    return COMFORTABLE_WIDTH;
  });

  // Флаг, указывающий что панель была автоматически сжата
  const [isAutoAdjusted, setIsAutoAdjusted] = useState(false);
  const previousSidebarWidthRef = useRef(null);

  // Состояние правой панели
  const [rightPanelState, setRightPanelState] = useState({
    width: 320,
    isOpen: false,
  });

  // Константы для адаптивности
  const MIN_WIDTH = 260;
  const BASE_MAX_WIDTH = 640;
  const MAIN_MIN_COMFORTABLE_WIDTH = 400; // Минимальная комфортная ширина для main
  const ADAPTIVE_SIDEBAR_WIDTH = 280; // Ширина sidebar в адаптивном режиме
  const NAV_ICONS_WIDTH = 80;

  const dynamicMaxWidth = useMemo(() => {
    if (typeof window === 'undefined') {
      return BASE_MAX_WIDTH;
    }
    if (window.innerWidth <= ULTRA_COMPACT_BREAKPOINT) {
      const available = window.innerWidth - NAV_ICONS_WIDTH;
      return Math.max(MIN_WIDTH, available);
    }
    const AVAILABLE_MIN_MAIN = 480;
    const rightPanelReserve = rightPanelState.isOpen ? rightPanelState.width : 0;
    const available =
      window.innerWidth - NAV_ICONS_WIDTH - rightPanelReserve - AVAILABLE_MIN_MAIN;
    return Math.max(MIN_WIDTH, Math.min(BASE_MAX_WIDTH, available));
  }, [mainWidth, rightPanelState]);

  const MAX_WIDTH = dynamicMaxWidth;

  useEffect(() => {
    if (sidebarWidth <= MAX_WIDTH + 0.5) {
      return;
    }
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, sidebarWidth));
    setSidebarWidth(clampedWidth);
    setUserPreferredWidth((prev) => {
      if (prev <= clampedWidth + 0.5) {
        return prev;
      }
      const nextPreferred = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, prev));
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'userPreferredSidebarWidth',
          String(Math.round(nextPreferred))
        );
      }
      return nextPreferred;
    });
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'sidebarWidth',
        String(Math.round(clampedWidth))
      );
    }
  }, [sidebarWidth, MAX_WIDTH]);

  useEffect(() => {
    if (sidebarWidth > MIN_WIDTH + 1) {
      return;
    }
    if (MAX_WIDTH < COMFORTABLE_WIDTH - 1) {
      return;
    }
    const target = Math.min(
      MAX_WIDTH,
      Math.max(COMFORTABLE_WIDTH, MIN_WIDTH)
    );
    if (Math.abs(target - sidebarWidth) < 0.5) {
      return;
    }
    setSidebarWidth(target);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'sidebarWidth',
        String(Math.round(target))
      );
    }
    setUserPreferredWidth((prev) => {
      const next = Math.max(prev, target);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'userPreferredSidebarWidth',
          String(Math.round(next))
        );
      }
      return next;
    });
    setIsAutoAdjusted(false);
  }, [sidebarWidth, MIN_WIDTH, MAX_WIDTH, COMFORTABLE_WIDTH]);

  // Обновление ширины main панели
  const updateMainWidth = useCallback((width) => {
    setMainWidth((prev) => {
      if (Math.abs(prev - width) < 0.5) {
        return prev;
      }
      return width;
    });

    // Если main становится слишком узким и sidebar не в адаптивном режиме
    const adaptiveTargetWidth = Math.max(
      MIN_WIDTH,
      Math.min(ADAPTIVE_SIDEBAR_WIDTH, MAX_WIDTH)
    );

    if (width < MAIN_MIN_COMFORTABLE_WIDTH && sidebarWidth > adaptiveTargetWidth) {
      console.log('[PanelWidth] Main panel too narrow, auto-adjusting sidebar', {
        mainWidth: width,
        currentSidebarWidth: sidebarWidth,
        targetSidebarWidth: adaptiveTargetWidth
      });
      
      // Сохраняем текущую ширину как предпочтительную перед автоматическим изменением
      if (!isAutoAdjusted) {
        const clampedPreferred = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, sidebarWidth)
        );
        setUserPreferredWidth(clampedPreferred);
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(
            'userPreferredSidebarWidth',
            String(Math.round(clampedPreferred))
          );
        }
      }
      
      setSidebarWidth(adaptiveTargetWidth);
      setIsAutoAdjusted(true);
    }
    // Если main стал достаточно широким, восстанавливаем предпочтительную ширину
    else if (
      width >= MAIN_MIN_COMFORTABLE_WIDTH + 100 && // добавляем гистерезис
      isAutoAdjusted && 
      userPreferredWidth > adaptiveTargetWidth &&
      Math.abs(sidebarWidth - adaptiveTargetWidth) < 0.5
    ) {
      const restoreWidth = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, userPreferredWidth)
      );
      const predictedWidthAfterRestore =
        width - (restoreWidth - adaptiveTargetWidth);

      if (predictedWidthAfterRestore < MAIN_MIN_COMFORTABLE_WIDTH + 40) {
        // Если после восстановления main снова станет слишком узким - пропускаем восстановление
        return;
      }

      console.log('[PanelWidth] Main panel wide enough, restoring user preferred width', {
        mainWidth: width,
        userPreferredWidth: restoreWidth
      });
      
      setSidebarWidth(restoreWidth);
      setIsAutoAdjusted(false);
    }
  }, [sidebarWidth, isAutoAdjusted, userPreferredWidth, MAX_WIDTH]);

  // Ручное изменение ширины sidebar (когда пользователь тянет ресайзер)
  const updateSidebarWidth = useCallback((width, isManual = false) => {
    const clampedWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, width));
    if (Math.abs(clampedWidth - sidebarWidth) < 0.5) {
      return;
    }

    setSidebarWidth(clampedWidth);

    // Если это ручное изменение, сохраняем как предпочтительную ширину
    if (isManual) {
      setUserPreferredWidth(clampedWidth);
      setIsAutoAdjusted(false);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(
          'userPreferredSidebarWidth',
          String(Math.round(clampedWidth))
        );
      }
      console.log('[PanelWidth] User manually adjusted sidebar', {
        newWidth: clampedWidth
      });
    }

    // Сохраняем текущую ширину
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sidebarWidth', String(clampedWidth));
    }
  }, [sidebarWidth, MIN_WIDTH, MAX_WIDTH]);

  // Сброс к предпочтительной ширине
  const resetToPreferred = useCallback(() => {
    const targetWidth = Math.max(
      MIN_WIDTH,
      Math.min(MAX_WIDTH, userPreferredWidth)
    );
    setSidebarWidth(targetWidth);
    setIsAutoAdjusted(false);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'sidebarWidth',
        String(Math.round(targetWidth))
      );
    }
    console.log('[PanelWidth] Reset to user preferred width', {
      width: targetWidth
    });
  }, [userPreferredWidth, MIN_WIDTH, MAX_WIDTH]);

  const setRightPanelOpen = useCallback((isOpen) => {
    setRightPanelState((prev) => {
      if (prev.isOpen === isOpen) {
        return prev;
      }
      return { ...prev, isOpen };
    });
  }, []);

  const updateRightPanelWidth = useCallback((width) => {
    if (!Number.isFinite(width)) {
      return;
    }
    setRightPanelState((prev) => {
      if (Math.abs(prev.width - width) < 0.5) {
        return prev;
      }
      return { ...prev, width };
    });
  }, []);

  // Ref для отслеживания предыдущей ширины viewport, чтобы избежать лишних обновлений
  const previousViewportWidthRef = useRef(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const handleResponsiveSidebar = () => {
      const viewportWidth = window.innerWidth;
      
      // Защита от очень маленьких размеров
      if (viewportWidth < 200) {
        return;
      }

      // Используем функциональное обновление для получения актуального sidebarWidth
      setSidebarWidth((currentSidebarWidth) => {
        const currentMaxWidth = dynamicMaxWidth;

        if (viewportWidth <= ULTRA_COMPACT_BREAKPOINT) {
          if (previousSidebarWidthRef.current === null) {
            previousSidebarWidthRef.current = Math.max(
              MIN_WIDTH,
              Math.min(currentMaxWidth, currentSidebarWidth)
            );
          }

          const targetWidth = Math.max(
            MIN_WIDTH,
            Math.min(currentMaxWidth, Math.max(200, viewportWidth - NAV_ICONS_WIDTH))
          );

          if (Math.abs(currentSidebarWidth - targetWidth) > 0.5) {
            return targetWidth;
          }
          return currentSidebarWidth;
        }

        // Новый диапазон 550-750px: используем увеличенную ширину
        if (viewportWidth <= MEDIUM_BREAKPOINT) {
          if (previousSidebarWidthRef.current === null) {
            previousSidebarWidthRef.current = Math.max(
              MIN_WIDTH,
              Math.min(currentMaxWidth, currentSidebarWidth)
            );
          }

          const targetWidth = Math.max(
            MIN_WIDTH,
            Math.min(currentMaxWidth, MEDIUM_SIDEBAR_WIDTH)
          );

          if (Math.abs(currentSidebarWidth - targetWidth) > 0.5) {
            return targetWidth;
          }
          return currentSidebarWidth;
        }

        if (viewportWidth <= MOBILE_BREAKPOINT) {
          if (previousSidebarWidthRef.current === null) {
            previousSidebarWidthRef.current = Math.max(
              MIN_WIDTH,
              Math.min(currentMaxWidth, currentSidebarWidth)
            );
          }

          const targetWidth = Math.max(
            MIN_WIDTH,
            Math.min(currentMaxWidth, MOBILE_SIDEBAR_WIDTH)
          );

          if (Math.abs(currentSidebarWidth - targetWidth) > 0.5) {
            return targetWidth;
          }
          return currentSidebarWidth;
        }

        if (previousSidebarWidthRef.current !== null) {
          const storedWidth =
            previousSidebarWidthRef.current ??
            userPreferredWidth ??
            COMFORTABLE_WIDTH;

          previousSidebarWidthRef.current = null;

          const clampedWidth = Math.max(
            MIN_WIDTH,
            Math.min(currentMaxWidth, storedWidth)
          );

          if (Math.abs(currentSidebarWidth - clampedWidth) > 0.5) {
            return clampedWidth;
          }
        }
        
        return currentSidebarWidth;
      });
    };

    // Инициализация при первом рендере
    if (previousViewportWidthRef.current === null) {
      previousViewportWidthRef.current = window.innerWidth;
      handleResponsiveSidebar();
    }

    // Обработчик resize всегда должен работать
    const resizeHandler = () => {
      const currentViewportWidth = window.innerWidth;
      // Вызываем только если viewport действительно изменился
      if (previousViewportWidthRef.current !== currentViewportWidth) {
        previousViewportWidthRef.current = currentViewportWidth;
        handleResponsiveSidebar();
      }
    };

    window.addEventListener('resize', resizeHandler);
    return () => window.removeEventListener('resize', resizeHandler);
  }, [
    MIN_WIDTH,
    dynamicMaxWidth,
    userPreferredWidth,
    COMFORTABLE_WIDTH,
    MOBILE_BREAKPOINT,
    MEDIUM_BREAKPOINT,
    MOBILE_SIDEBAR_WIDTH,
    MEDIUM_SIDEBAR_WIDTH,
    ULTRA_COMPACT_BREAKPOINT,
  ]);

  const value = {
    sidebarWidth,
    mainWidth,
    userPreferredWidth,
    isAutoAdjusted,
    updateMainWidth,
    updateSidebarWidth,
    resetToPreferred,
    MIN_WIDTH,
    MAX_WIDTH,
    rightPanelWidth: rightPanelState.width,
    isRightPanelOpen: rightPanelState.isOpen,
    setRightPanelOpen,
    updateRightPanelWidth,
  };

  return (
    <PanelWidthContext.Provider value={value}>
      {children}
    </PanelWidthContext.Provider>
  );
};

