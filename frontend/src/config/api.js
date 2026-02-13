// Конфигурация API для frontend
// Источник URL — переменная окружения Vite (VITE_API_BASE_URL)

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

// Таймаут для запросов (мс)
export const API_TIMEOUT = Number(
  import.meta.env.VITE_API_TIMEOUT || 30000
);

