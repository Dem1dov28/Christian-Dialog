import { useMemo } from "react";

/**
 * Хук для определения контекста Telegram Mini App.
 * @returns {{ isTelegram: boolean, initData: string | null, webApp: object | null }}
 */
export function useTelegramWebApp() {
  return useMemo(() => {
    const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
    const initData = webApp?.initData || null;
    // Mini App: initData или tgWebAppData в URL (SDK может загрузиться позже)
    const hasTgWebAppData =
      typeof window !== "undefined" &&
      Boolean(new URLSearchParams((window.location.hash || "").slice(1)).get("tgWebAppData"));
    const isTelegram = Boolean(initData) || hasTgWebAppData;

    return {
      isTelegram,
      initData,
      webApp,
    };
  }, []);
}
