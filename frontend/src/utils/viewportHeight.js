/**
 * Viewport Height Utility
 *
 * Sets CSS variable --app-height to actual window inner height.
 * This fixes the mobile viewport issue where 100vh doesn't account
 * for dynamic browser UI (address bar, toolbar) on mobile devices.
 *
 * В Telegram WebApp использует viewportStableHeight — иначе при expand/fullscreen
 * высота может быть неверной (контент уезжает под Dynamic Island на iOS).
 *
 * Usage: Import and call initViewportHeight() in App.jsx
 */

const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : null;

/**
 * Sets the --app-height CSS variable based on actual window height
 */
export function setViewportHeight() {
  let height;
  if (tg?.viewportStableHeight != null && tg.viewportStableHeight > 0) {
    height = tg.viewportStableHeight;
  } else {
    height = window.innerHeight;
  }
  document.documentElement.style.setProperty("--app-height", `${height}px`);
  document.documentElement.style.setProperty("--vh", `${height * 0.01}px`);
}

export function initViewportHeight() {
  setViewportHeight();

  window.addEventListener("resize", setViewportHeight);
  window.addEventListener("orientationchange", () => {
    setTimeout(setViewportHeight, 150);
  });

  let onViewport;
  if (tg?.onEvent) {
    onViewport = () => setTimeout(setViewportHeight, 50);
    tg.onEvent("viewportChanged", onViewport);
    tg.onEvent("fullscreenChanged", onViewport);
  }

  return () => {
    window.removeEventListener("resize", setViewportHeight);
    window.removeEventListener("orientationchange", setViewportHeight);
    if (tg?.offEvent && onViewport) {
      tg.offEvent("viewportChanged", onViewport);
      tg.offEvent("fullscreenChanged", onViewport);
    }
  };
}

export default initViewportHeight;
