// Конфигурация API для frontend
// Источник URL — переменная окружения Vite (VITE_API_BASE_URL).
// Если не задана и мы в браузере — используем текущий origin (тот же домен/протокол, без Mixed Content).
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== "undefined" ? window.location.origin : "http://localhost:8000");

// Таймаут для запросов (мс)
export const API_TIMEOUT = Number(
  import.meta.env.VITE_API_TIMEOUT || 30000
);

