import React from "react";
import { getActionIcon } from "../../utils/actionIcons";
import { formatTime } from "../../utils/formatters";
import { useLanguage } from "../../contexts/LanguageContext";

export default function ReplyMessage({
  message,
  onClose,
  onScrollToMessage,
  highlightedMessageId,
}) {
  const { t } = useLanguage();
  
  if (!message) return null;


  const truncateText = (text, maxLength = 80) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  /**
   * Декодирует HTML entities и удаляет reply-блоки, сохраняя HTML-теги как текст
   * Это позволяет показывать текст с тегами (например, &lt;div&gt;test&lt;/div&gt; → <div>test</div>) как обычный текст
   * 
   * ВАЖНО: Работаем ТОЛЬКО со строкой через regex, НЕ используем DOM вообще.
   */
  const getCleanText = (content) => {
    if (!content || typeof content !== "string") return "";

    // Шаг 1: Удаляем reply-блоки через regex (работаем со строкой, не интерпретируем HTML)
    let cleaned = content
      .replace(
        /<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
        ""
      )
      .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
      .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    
    // Удаляем оставшиеся закрывающие теги в начале
    cleaned = cleaned.trim().replace(/^<\/div>\s*/i, "");
    cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*/i, "");
    cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*<\/div>\s*/i, "");
    
    // Шаг 2: Декодируем HTML entities ТОЛЬКО через regex (НЕ используем DOM)
    // Важно: порядок имеет значение - сначала &amp;, чтобы не конфликтовало
    const decoded = cleaned
      .replace(/&amp;/g, "&")    // Декодируем &amp; в & (сначала!)
      .replace(/&lt;/g, "<")      // Декодируем &lt; в <
      .replace(/&gt;/g, ">")      // Декодируем &gt; в >
      .replace(/&quot;/g, '"')    // Декодируем &quot; в "
      .replace(/&#039;/g, "'")    // Декодируем &#039; в '
      .replace(/&#x27;/g, "'");   // Декодируем &#x27; в '
    
    return decoded.trim();
  };

  const cleanContent = getCleanText(message.content);

  return (
    <div className="p-2 sm:p-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)] flex-shrink-0">
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="text-[var(--accent)] flex-shrink-0">
          {React.createElement(getActionIcon("reply"), { className: "text-lg sm:text-2xl transform -scale-x-100" })}
        </div>
        <div
          className={`border-l-2 border-[var(--accent)] pl-2 sm:pl-3 pr-2 sm:pr-3 py-1 flex-1 min-w-0 rounded-[3px] cursor-pointer transition-colors duration-200 ${
            highlightedMessageId === message.id ? "bg-[rgba(0,0,0,0.3)]" : ""
          }`}
          onClick={() => onScrollToMessage && onScrollToMessage(message.id)}
          title={t("chat.goToMessage")}
          style={{
            cursor: "pointer",
            transition: "background-color 300ms ease",
            backgroundColor: "var(--reply-bg-light)",
          }}
          onMouseEnter={(e) => {
            if (highlightedMessageId !== message.id) {
              e.currentTarget.style.backgroundColor = "var(--reply-hover-bg-light)";
            }
          }}
          onMouseLeave={(e) => {
            if (highlightedMessageId !== message.id) {
              e.currentTarget.style.backgroundColor = "var(--reply-bg-light)";
            }
          }}
          onMouseDown={(e) => {
            if (highlightedMessageId !== message.id) {
              e.currentTarget.style.backgroundColor = "var(--reply-active-bg-light)";
            }
          }}
          onMouseUp={(e) => {
            if (highlightedMessageId !== message.id) {
              e.currentTarget.style.backgroundColor = "var(--reply-hover-bg-light)";
            }
          }}
        >
          <p className="font-medium text-[var(--accent)] text-xs sm:text-sm truncate select-none">
            {message.author_name || t("chat.replyToMessage")}
          </p>
          <p
            className="text-[var(--text-white)] text-xs sm:text-sm select-none"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {truncateText(cleanContent, window.innerWidth < 640 ? 40 : 80)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="text-[var(--text-gray)] hover:text-[var(--text-white)] p-1 rounded transition-colors duration-200 flex-shrink-0"
          title={t("chat.cancelReply")}
        >
          {React.createElement(getActionIcon("close"), { className: "text-lg sm:text-xl" })}
        </button>
      </div>
    </div>
  );
}
