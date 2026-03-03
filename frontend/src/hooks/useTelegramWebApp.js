import { useMemo } from "react";

/**
 * Хук для определения контекста Telegram Mini App.
 * @returns {{ isTelegram: boolean, initData: string | null, webApp: object | null }}
 */
export function useTelegramWebApp() {
  return useMemo(() => {
    const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
    const isTelegram = Boolean(webApp?.initData);
    const initData = webApp?.initData || null;

    return {
      isTelegram,
      initData,
      webApp,
    };
  }, []);
}
