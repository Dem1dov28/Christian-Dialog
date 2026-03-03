import React from "react";
import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.jsx";
import "./index.css";

// Инициализация Telegram Web App при открытии в Telegram
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  try { tg.enableClosingConfirmation(); } catch (_) {}
  try { tg.disableVerticalSwipes(); } catch (_) {}
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
