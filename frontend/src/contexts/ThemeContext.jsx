import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

const STORAGE_KEY = 'theme';
const DEFAULT_THEME = 'dark';
const SUPPORTED_THEMES = ['light', 'dark', 'blue', 'pastel'];

const getStorageTheme = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) ||
                   sessionStorage.getItem(STORAGE_KEY);
    // Если сохранена валидная тема, возвращаем её, иначе дефолтную
    return SUPPORTED_THEMES.includes(stored) ? stored : DEFAULT_THEME;
  } catch (e) {
    return DEFAULT_THEME;
  }
};

const setStorageTheme = (theme) => {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    return 'localStorage';
  } catch (e) {
    try {
      sessionStorage.setItem(STORAGE_KEY, theme);
      return 'sessionStorage';
    } catch (e2) {
      return 'runtime';
    }
  }
};

export const ThemeProvider = ({ children }) => {
  const applyThemeToDom = (themeName) => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    const isDark = themeName === 'dark' || themeName === 'blue';
    root.classList.toggle('dark', isDark);
    root.classList.toggle('theme-blue', themeName === 'blue');
    root.classList.toggle('theme-pastel', themeName === 'pastel');
  };

  const getThemeBgColor = (themeName) => {
    switch (themeName) {
      case 'light':
        return '#ffffff';
      case 'blue':
        return '#1c3334'; // основной фон blue-темы
      case 'pastel':
        return '#fafafa'; // основной фон пастельной темы
      case 'dark':
      default:
        return '#2d283e';
    }
  };

  const [theme, setThemeState] = useState(() => {
    // Initialize from DOM class (set by inline script)
    const isDark = document.documentElement.classList.contains('dark');
    // Если класс 'dark' есть, возвращаем 'dark', иначе 'light' (не DEFAULT_THEME!)
    return isDark ? 'dark' : 'light';
  });
  const [storageType, setStorageType] = useState('localStorage');
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Load theme from storage on mount
    const storedTheme = getStorageTheme();
    const storageMethod = localStorage.getItem(STORAGE_KEY) ? 'localStorage' : 
                         sessionStorage.getItem(STORAGE_KEY) ? 'sessionStorage' : 
                         'runtime';

    applyThemeToDom(storedTheme);

    setThemeState(storedTheme);
    setStorageType(storageMethod);
    setIsInitialized(true);
  }, []);

  const toggleTheme = (clickCoords) => {
    // Переключатель остаётся бинарным: светлая / базовая тёмная тема
    const newTheme = theme === 'light' ? 'dark' : 'light';
    
    // Circular reveal animation
    if (clickCoords && clickCoords.x !== undefined && clickCoords.y !== undefined) {
      const { x, y } = clickCoords;
      
      // Удаляем существующий overlay, если есть
      const existingOverlay = document.getElementById('theme-transition-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      
      // Вычисляем максимальный радиус для покрытия всего экрана
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      // Расстояние от точки клика до самого дальнего угла экрана
      const distanceToCorners = [
        Math.sqrt(x ** 2 + y ** 2), // верхний левый
        Math.sqrt((viewportWidth - x) ** 2 + y ** 2), // верхний правый
        Math.sqrt(x ** 2 + (viewportHeight - y) ** 2), // нижний левый
        Math.sqrt((viewportWidth - x) ** 2 + (viewportHeight - y) ** 2), // нижний правый
      ];
      const maxRadius = Math.max(...distanceToCorners);
      
      // Применяем новую тему ко всему документу сразу
      setThemeState(newTheme);
      const method = setStorageTheme(newTheme);
      setStorageType(method);
      applyThemeToDom(newTheme);
      
      // Создаем overlay который показывает СТАРУЮ тему за пределами круга
      // Внутри круга (прозрачная область маски) видна новая тема
      // Снаружи круга (непрозрачная область маски) виден overlay со старым цветом
      const oldThemeBg = getThemeBgColor(theme);
      const finalRadius = maxRadius * 1.2;
      const overlay = document.createElement('div');
      overlay.id = 'theme-transition-overlay';
      
      // Оптимизированная анимация: оптимизированный requestAnimationFrame
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: ${oldThemeBg};
        mask: radial-gradient(
          circle at ${x}px ${y}px,
          transparent 0px,
          black 0px
        );
        -webkit-mask: radial-gradient(
          circle at ${x}px ${y}px,
          transparent 0px,
          black 0px
        );
        will-change: mask, -webkit-mask;
        z-index: 999999;
        pointer-events: none;
        transform: translateZ(0);
        backface-visibility: hidden;
        contain: layout style paint;
      `;
      
      document.body.appendChild(overlay);
      
      // Оптимизированная анимация: кэшируем значения и используем более эффективные вычисления
      const duration = 600;
      const startTime = performance.now();
      
      // Кэшируем строки шаблонов для производительности
      const maskTemplate = (radius) => `radial-gradient(circle at ${x}px ${y}px, transparent ${radius}px, black ${radius}px)`;
      
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Оптимизированный cubic ease-out
        const eased = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
        const radius = finalRadius * eased;
        
        // Используем кэшированный шаблон
        const maskValue = maskTemplate(radius);
        overlay.style.mask = maskValue;
        overlay.style.webkitMask = maskValue;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // Очищаем will-change после завершения
          overlay.style.willChange = 'auto';
          
          // Удаляем overlay
          if (overlay.parentNode) {
            overlay.style.transition = 'opacity 0.15s ease-out';
            overlay.style.opacity = '0';
            setTimeout(() => {
              if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
            }, 150);
          }
        }
      };
      
      requestAnimationFrame(animate);
    } else {
      // Fallback: простое переключение без анимации
      setThemeState(newTheme);
      const method = setStorageTheme(newTheme);
      setStorageType(method);
      applyThemeToDom(newTheme);
    }
  };

  const setTheme = (newTheme, clickCoords) => {
    if (!SUPPORTED_THEMES.includes(newTheme)) return;
    if (newTheme === theme) return; // Не меняем, если тема та же
    
    // Circular reveal animation (аналогично toggleTheme)
    if (clickCoords && clickCoords.x !== undefined && clickCoords.y !== undefined) {
      const { x, y } = clickCoords;
      
      // Удаляем существующий overlay, если есть
      const existingOverlay = document.getElementById('theme-transition-overlay');
      if (existingOverlay) {
        existingOverlay.remove();
      }
      
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const distanceToCorners = [
        Math.sqrt(x ** 2 + y ** 2),
        Math.sqrt((viewportWidth - x) ** 2 + y ** 2),
        Math.sqrt(x ** 2 + (viewportHeight - y) ** 2),
        Math.sqrt((viewportWidth - x) ** 2 + (viewportHeight - y) ** 2),
      ];
      const maxRadius = Math.max(...distanceToCorners);
      
      // Применяем новую тему ко всему документу сразу
      setThemeState(newTheme);
      const method = setStorageTheme(newTheme);
      setStorageType(method);
      applyThemeToDom(newTheme);
      
      // Создаем overlay который показывает СТАРУЮ тему за пределами круга
      const oldThemeBg = getThemeBgColor(theme);
      const finalRadius = maxRadius * 1.2;
      const overlay = document.createElement('div');
      overlay.id = 'theme-transition-overlay';
      
      // Оптимизированная анимация
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: ${oldThemeBg};
        mask: radial-gradient(
          circle at ${x}px ${y}px,
          transparent 0px,
          black 0px
        );
        -webkit-mask: radial-gradient(
          circle at ${x}px ${y}px,
          transparent 0px,
          black 0px
        );
        will-change: mask, -webkit-mask;
        z-index: 999999;
        pointer-events: none;
        transform: translateZ(0);
        backface-visibility: hidden;
        contain: layout style paint;
      `;
      
      document.body.appendChild(overlay);
      
      // Оптимизированная анимация
      const duration = 600;
      const startTime = performance.now();
      const maskTemplate = (radius) => `radial-gradient(circle at ${x}px ${y}px, transparent ${radius}px, black ${radius}px)`;
      
      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = progress < 1 ? 1 - Math.pow(1 - progress, 3) : 1;
        const radius = finalRadius * eased;
        
        const maskValue = maskTemplate(radius);
        overlay.style.mask = maskValue;
        overlay.style.webkitMask = maskValue;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          overlay.style.willChange = 'auto';
          if (overlay.parentNode) {
            overlay.style.transition = 'opacity 0.15s ease-out';
            overlay.style.opacity = '0';
            setTimeout(() => {
              if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
              }
            }, 150);
          }
        }
      };
      
      requestAnimationFrame(animate);
    } else {
      // Fallback
      setThemeState(newTheme);
      const method = setStorageTheme(newTheme);
      setStorageType(method);
      applyThemeToDom(newTheme);
    }
  };

  const value = useMemo(() => ({
    theme,
    toggleTheme,
    setTheme,
    storageType,
    isInitialized,
  }), [theme, storageType]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

