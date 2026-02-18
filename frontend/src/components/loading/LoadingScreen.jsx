/**
 * LoadingScreen.jsx
 * 
 * Оптимизированный экран загрузки с CSS-анимацией вместо Three.js.
 * Использует легкие CSS-анимации для минимальной нагрузки на систему.
 */

import { useEffect, useState, memo } from 'react';
import './LoadingScreen.css';

/**
 * Preloader - больше не нужен для CSS-анимации
 */
const LoadingScreenPreloader = () => {
  return null;
};

/**
 * Упрощенный лоадер для мобильных устройств
 */
const MobileLoadingContent = () => (
  <div className="loading-content">
    {/* Упрощенный куб без частиц */}
    <div className="css-cube-container mobile">
      <div className="css-cube mobile">
        <div className="css-cube-face css-cube-face-front"></div>
        <div className="css-cube-face css-cube-face-back"></div>
        <div className="css-cube-face css-cube-face-right"></div>
        <div className="css-cube-face css-cube-face-left"></div>
        <div className="css-cube-face css-cube-face-top"></div>
        <div className="css-cube-face css-cube-face-bottom"></div>
      </div>
    </div>
  </div>
);

/**
 * Полный лоадер для десктопа
 */
const DesktopLoadingContent = () => (
  <div className="loading-content">
    {/* CSS-анимация куба */}
    <div className="css-cube-container">
      <div className="css-cube">
        <div className="css-cube-face css-cube-face-front"></div>
        <div className="css-cube-face css-cube-face-back"></div>
        <div className="css-cube-face css-cube-face-right"></div>
        <div className="css-cube-face css-cube-face-left"></div>
        <div className="css-cube-face css-cube-face-top"></div>
        <div className="css-cube-face css-cube-face-bottom"></div>
      </div>
      <div className="css-cube-glow"></div>
    </div>
    
    {/* CSS-частицы только на десктопе */}
    <div className="css-particles">
      {[...Array(12)].map((_, i) => (
        <div key={i} className="css-particle" style={{ '--i': i }}></div>
      ))}
    </div>
  </div>
);

/**
 * Главный компонент экрана загрузки
 */
const LoadingScreen = ({ isVisible = true }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    // Определяем мобильное устройство
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  
  useEffect(() => {
    if (isVisible) {
      // Use requestAnimationFrame instead of setTimeout for smoother fade-in
      const rafId = requestAnimationFrame(() => {
        setIsLoaded(true);
      });
      
      return () => cancelAnimationFrame(rafId);
    } else {
      setIsLoaded(false);
    }
  }, [isVisible]);
  
  if (!isVisible) {
    return null;
  }
  
  return (
    <div className="loading-screen-optimized">
      <div 
        className={`loading-content-wrapper ${isLoaded ? 'loaded' : ''}`}
        style={{ willChange: 'opacity' }}
      >
        {isMobile ? <MobileLoadingContent /> : <DesktopLoadingContent />}
      </div>
      
      {/* Наложение с градиентом */}
      <div className="loading-overlay" />
    </div>
  );
};

// Экспортируем также preloader для использования на уровне приложения
const MemoizedLoadingScreen = memo(LoadingScreen);
MemoizedLoadingScreen.Preloader = LoadingScreenPreloader;

export default MemoizedLoadingScreen;
