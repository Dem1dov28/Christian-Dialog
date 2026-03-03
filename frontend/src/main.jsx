import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import { setViewportHeight } from "./utils/viewportHeight.js";
import "./index.css";

// Инициализация Telegram Web App при открытии в Telegram
const tg = window.Telegram?.WebApp;
if (tg) {
  document.documentElement.classList.add("tg-webapp");
  tg.ready();
  tg.expand();
  if (tg.isVersionAtLeast?.("6.2")) { try { tg.enableClosingConfirmation(); } catch (_) {} }
  if (tg.isVersionAtLeast?.("7.7")) { try { tg.disableVerticalSwipes(); } catch (_) {} }

  // Safe area: Dynamic Island + хедер Telegram (кнопка «Закрыть») перекрывают верх приложения.
  // Bot API 8.0+: safeAreaInset (устройство) + contentSafeAreaInset (UI Telegram).
  // Без 8.0: фиксированный отступ 48px, чтобы опустить контент ниже кнопки «Закрыть».
  const TG_HEADER_BUFFER = 48;
  function applyTelegramSafeArea() {
    const root = document.documentElement.style;
    if (tg.isVersionAtLeast?.("8.0")) {
      const safe = tg.safeAreaInset;
      const content = tg.contentSafeAreaInset;
      const safeTop = (safe && typeof safe.top === "number") ? safe.top : 0;
      const contentTop = (content && typeof content.top === "number") ? content.top : 0;
      const topOffset = Math.max(safeTop + contentTop, TG_HEADER_BUFFER);
      root.setProperty("--tg-top-offset", `${topOffset}px`);
      if (safe) {
        if (typeof safe.top === "number") root.setProperty("--tg-safe-area-inset-top", `${safe.top}px`);
        if (typeof safe.bottom === "number") root.setProperty("--tg-safe-area-inset-bottom", `${safe.bottom}px`);
      }
      if (content && typeof content.bottom === "number") root.setProperty("--tg-content-safe-area-inset-bottom", `${content.bottom}px`);
    } else {
      root.setProperty("--tg-top-offset", `${TG_HEADER_BUFFER}px`);
    }
  }
  applyTelegramSafeArea();
  try {
    tg.onEvent("safeAreaChanged", applyTelegramSafeArea);
    tg.onEvent("contentSafeAreaChanged", applyTelegramSafeArea);
  } catch (_) {}
  // viewportStableHeight обновляется после expand — повторяем через ~300 ms
  setTimeout(setViewportHeight, 300);
}

const container = document.getElementById("root");
const root = createRoot(container);

// ВАЖНО: StrictMode в dev может заметно замедлять сложные drag-and-drop сценарии.
// Для плавного перетаскивания в Todo Journal рендерим приложение без StrictMode.
root.render(
  <HelmetProvider>
    <div className="app-root">
      <App />
    </div>
  </HelmetProvider>
);
