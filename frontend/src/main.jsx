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
  try { tg.enableClosingConfirmation(); } catch (_) {}
  try { tg.disableVerticalSwipes(); } catch (_) {}

  // Применяем safe area insets из Telegram API — env() ненадёжен в WebView на iOS (Dynamic Island, notch).
  // Bot API 8.0+ предоставляет safeAreaInset и contentSafeAreaInset.
  function applyTelegramSafeArea() {
    if (!tg.isVersionAtLeast?.("8.0")) return;
    const safe = tg.safeAreaInset;
    const content = tg.contentSafeAreaInset;
    const root = document.documentElement.style;
    if (safe) {
      if (typeof safe.top === "number") root.setProperty("--tg-safe-area-inset-top", `${safe.top}px`);
      if (typeof safe.bottom === "number") root.setProperty("--tg-safe-area-inset-bottom", `${safe.bottom}px`);
      if (typeof safe.left === "number") root.setProperty("--tg-safe-area-inset-left", `${safe.left}px`);
      if (typeof safe.right === "number") root.setProperty("--tg-safe-area-inset-right", `${safe.right}px`);
    }
    if (content) {
      if (typeof content.top === "number") root.setProperty("--tg-content-safe-area-inset-top", `${content.top}px`);
      if (typeof content.bottom === "number") root.setProperty("--tg-content-safe-area-inset-bottom", `${content.bottom}px`);
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
