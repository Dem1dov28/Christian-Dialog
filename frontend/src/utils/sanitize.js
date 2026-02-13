// Утилиты для безопасной санитизации HTML/текста в сообщениях

import DOMPurify from "dompurify";

// Базовая конфигурация для HTML из ответов модели
const CHAT_MESSAGE_CONFIG = {
  // Разрешённые теги
  ALLOWED_TAGS: [
    "b",
    "i",
    "em",
    "strong",
    "u",
    "s",
    "span",
    "p",
    "br",
    "div",
    "ul",
    "ol",
    "li",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "a",
    "code",
    "pre",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "blockquote",
    "button",
    "input",
    "label",
  ],
  // Разрешённые атрибуты
  ALLOWED_ATTR: [
    "href",
    "title",
    "target",
    "rel",
    "class",
    "id",
    "type",
    "value",
    "placeholder",
    "data-*",
  ],
  // Разрешаем data-* атрибуты (для интерактивных тестов)
  ALLOW_DATA_ATTR: true,
  // Не разрешаем неизвестные протоколы (javascript:, vbscript:, и т.п.)
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

/**
 * Санитизация HTML контента сообщений чата.
 * Удаляет скрипты/инъекции, но оставляет разметку и интерактивные элементы.
 */
export const sanitizeChatMessage = (dirty) => {
  if (!dirty || typeof dirty !== "string") return "";
  return DOMPurify.sanitize(dirty, CHAT_MESSAGE_CONFIG);
};

/**
 * Санитизация текста (без HTML) — убирает теги, оставляет только текст.
 */
export const sanitizePlainText = (text) => {
  if (!text || typeof text !== "string") return "";
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], KEEP_CONTENT: true });
};

