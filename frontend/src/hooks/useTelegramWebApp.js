import { useState, useEffect } from "react";

function detectTelegram() {
  const webApp = typeof window !== "undefined" ? window.Telegram?.WebApp : null;
  const initData = webApp?.initData || null;
  const hasTgWebAppData =
    typeof window !== "undefined" &&
    (Boolean(new URLSearchParams((window.location.hash || "").slice(1)).get("tgWebAppData")) ||
      Boolean(new URLSearchParams((window.location.search || "").slice(1)).get("tgWebAppData")));
  const isTelegram = Boolean(initData) || hasTgWebAppData;

  const platform = webApp?.platform || "";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
  const isIOS =
    /^ios/.test(platform) ||
    /iPad|iPhone|iPod/.test(ua) ||
    (platform === "" && /Telegram.*Darwin|Darwin.*CFNetwork/i.test(ua)) ||
    (typeof navigator !== "undefined" && navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  return { isTelegram, isIOS, initData, webApp };
}

/**
 * Хук для определения контекста Telegram Mini App.
 * Реактивен: при поздней загрузке SDK (напр. после refresh) обновляет состояние.
 */
export function useTelegramWebApp() {
  const [state, setState] = useState(() => detectTelegram());

  useEffect(() => {
    const s = detectTelegram();
    if (s.isTelegram) {
      setState(s);
      return;
    }
    // При refresh SDK может загрузиться позже — опрашиваем, если sessionStorage указывает на Mini App
    const maybeTg = typeof sessionStorage !== "undefined" && sessionStorage.getItem("tg_miniapp");
    if (!maybeTg) return;
    let n = 0;
    const maxAttempts = 25; // ~2.5 сек
    const id = setInterval(() => {
      n++;
      const next = detectTelegram();
      if (next.isTelegram) {
        setState(next);
        clearInterval(id);
      } else if (n >= maxAttempts) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, []);

  return state;
}
