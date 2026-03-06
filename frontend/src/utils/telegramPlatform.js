/**
 * Утилиты для определения платформы Telegram.
 * weba, webk — веб-версия Telegram на ПК (web.telegram.org)
 * tdesktop, macos, win — десктоп-приложения
 */
export function isTelegramPc() {
  if (typeof window === "undefined") return false;
  const platform = (window.Telegram?.WebApp?.platform || "").toLowerCase();
  return ["tdesktop", "macos", "weba", "webk", "win"].includes(platform);
}
