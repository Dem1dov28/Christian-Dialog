/**
 * Viewport Height Utility
 * 
 * Sets CSS variable --app-height to actual window inner height.
 * This fixes the mobile viewport issue where 100vh doesn't account
 * for dynamic browser UI (address bar, toolbar) on mobile devices.
 * 
 * Usage: Import and call initViewportHeight() in App.jsx
 */

/**
 * Sets the --app-height CSS variable based on actual window height
 */
export function setViewportHeight() {
  // window.innerHeight — стабильная высота, не меняется при открытии клавиатуры.
  // Использование visualViewport.height здесь вызывало прыжок layout при открытии клавиатуры.
  const height = window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
}

export function initViewportHeight() {
  setViewportHeight();

  // Обновляем только при изменении размера окна (поворот экрана).
  // НЕ слушаем visualViewport.resize — он срабатывает при открытии клавиатуры
  // и вызывает прыжок всего layout вверх.
  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 150);
  });

  return () => {
    window.removeEventListener('resize', setViewportHeight);
    window.removeEventListener('orientationchange', setViewportHeight);
  };
}

export default initViewportHeight;
