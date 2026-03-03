// Конфигурация API для frontend
// Источник URL — переменная окружения Vite (VITE_API_BASE_URL).
// Если не задана и мы в браузере — используем текущий origin (тот же домен/протокол, без Mixed Content).
let _base = import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");

// Убираем trailing slash
_base = (_base || "").replace(/\/+$/, "");

// Mixed Content: страница по HTTPS не может запрашивать HTTP. Принудительно HTTPS.
if (typeof window !== "undefined" && window.location.protocol === "https:" && _base.startsWith("http://")) {
  _base = "https://" + _base.slice(7);
}
// В production (epochaldialog.com) всегда https
if (_base.includes("epochaldialog.com") && _base.startsWith("http://")) {
  _base = "https://" + _base.slice(7);
}

export const API_BASE_URL = _base;

// Таймаут для запросов (мс)
export const API_TIMEOUT = Number(
  import.meta.env.VITE_API_TIMEOUT || 30000
);

