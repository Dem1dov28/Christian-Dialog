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
  const height = window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${height}px`);
}

/**
 * Initialize viewport height handling
 * Sets initial value and adds resize listener
 */
export function initViewportHeight() {
  // Set initial value
  setViewportHeight();

  // Update on resize (handles orientation changes, address bar show/hide)
  window.addEventListener('resize', setViewportHeight);

  // Also update on orientation change for mobile devices
  window.addEventListener('orientationchange', () => {
    // Small delay to allow browser to update viewport after orientation change
    setTimeout(setViewportHeight, 100);
  });

  // Cleanup function for React useEffect
  return () => {
    window.removeEventListener('resize', setViewportHeight);
    window.removeEventListener('orientationchange', setViewportHeight);
  };
}

export default initViewportHeight;
