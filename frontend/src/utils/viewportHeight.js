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
  // visualViewport.height — реальная видимая высота без панелей браузера.
  // window.innerHeight включает панели браузера на мобильных — нельзя использовать.
  const height = (window.visualViewport ? window.visualViewport.height : window.innerHeight);
  document.documentElement.style.setProperty('--app-height', `${height}px`);
  document.documentElement.style.setProperty('--vh', `${height * 0.01}px`);
}

/**
 * Initialize viewport height handling
 * Sets initial value and adds resize listener
 */
export function initViewportHeight() {
  setViewportHeight();

  window.addEventListener('resize', setViewportHeight);
  window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 100);
  });

  // visualViewport resize срабатывает при появлении/скрытии клавиатуры
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', setViewportHeight);
  }

  return () => {
    window.removeEventListener('resize', setViewportHeight);
    window.removeEventListener('orientationchange', setViewportHeight);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', setViewportHeight);
    }
  };
}

export default initViewportHeight;
