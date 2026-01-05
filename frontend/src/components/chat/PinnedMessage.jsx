import React, { useState, useEffect, useRef, useCallback } from "react";
import { BsPinFill } from "react-icons/bs";
import { MdClose } from "react-icons/md";
import { formatTime } from "../../utils/formatters";

export default function PinnedMessage({ message, onUnpin, onClose }) {
  const [truncatedText, setTruncatedText] = useState("");
  const containerRef = useRef(null);

  if (!message) return null;


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

  const calculateTruncatedText = useCallback(() => {
    if (!containerRef.current || !message.content) return;

    // Очищаем контент от HTML и reply-блоков
    const cleanContent = getCleanText(message.content);

    const containerWidth = containerRef.current.offsetWidth;
    const isSmallScreen = window.innerWidth < 640;
    const isVerySmallScreen = window.innerWidth < 480;

    // Более точные расчеты размеров элементов
    const iconWidth = isSmallScreen ? 18 : 24; // Ширина иконки
    const buttonWidth = isSmallScreen ? 56 : 72; // Ширина кнопок (2 кнопки + отступы)
    const padding = isSmallScreen ? 16 : 24; // Отступы контейнера
    const spaceBetween = isSmallScreen ? 8 : 12; // Промежутки между элементами
    const textPadding = isSmallScreen ? 16 : 24; // Отступы внутри текстового блока

    // Вычисляем доступную ширину для текста
    const availableWidth =
      containerWidth -
      iconWidth -
      buttonWidth -
      padding -
      spaceBetween -
      textPadding;

    // Более агрессивная защита от маленьких размеров
    if (availableWidth < 30) {
      setTruncatedText("...");
      return;
    }

    // Более точная ширина символа в зависимости от размера экрана и шрифта
    const charWidth = isVerySmallScreen ? 4.5 : isSmallScreen ? 5.5 : 7;

    // Вычисляем максимальное количество символов
    const maxChars = Math.floor(availableWidth / charWidth);

    // Более агрессивные ограничения для очень маленьких экранов
    const minChars = isVerySmallScreen ? 3 : isSmallScreen ? 6 : 10;
    const maxCharsLimit = isVerySmallScreen ? 20 : isSmallScreen ? 40 : 80;
    const finalMaxChars = Math.max(minChars, Math.min(maxChars, maxCharsLimit));

    if (cleanContent.length <= finalMaxChars) {
      setTruncatedText(cleanContent);
    } else {
      setTruncatedText(cleanContent.substring(0, finalMaxChars) + "...");
    }
  }, [message.content]);

  useEffect(() => {
    calculateTruncatedText();

    const handleResize = () => {
      calculateTruncatedText();
    };

    // Используем ResizeObserver для более точного отслеживания изменений размера
    let resizeObserver;
    if (containerRef.current && window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        calculateTruncatedText();
      });
      resizeObserver.observe(containerRef.current);
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, [message.content, calculateTruncatedText]);

  return (
      <div
        ref={containerRef}
        className="p-2 sm:p-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)] flex-shrink-0 min-w-0 max-w-full overflow-hidden"
      >
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0 max-w-full">
          <div className="text-[var(--accent)] flex-shrink-0">
            <BsPinFill className="text-lg sm:text-2xl" />
          </div>
          <div
            className="border-l-2 border-[var(--accent)] pl-2 sm:pl-3 pr-2 sm:pr-3 py-1 flex-1 min-w-0 max-w-full rounded-[3px] overflow-hidden cursor-pointer transition-colors duration-200"
            style={{
              backgroundColor: "var(--reply-bg-light)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--reply-hover-bg-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--reply-bg-light)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = "var(--reply-active-bg-light)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = "var(--reply-hover-bg-light)";
            }}
          >
          <p className="font-medium text-[var(--accent)] text-xs sm:text-sm truncate select-none">
            Закрепленное сообщение
          </p>
          <p
            className="text-[var(--text-white)] text-xs sm:text-sm truncate select-none"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {truncatedText || getCleanText(message.content)}
          </p>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
          <button
            onClick={onUnpin}
            className="text-[var(--text-white)]-secondary hover:text-[var(--text-white)] p-1 rounded transition-colors duration-200"
            title="Открепить сообщение"
          >
            <BsPinFill className="text-lg sm:text-xl" />
          </button>
          <button
            onClick={onClose}
            className="text-[var(--text-white)]-secondary hover:text-[var(--text-white)] p-1 rounded transition-colors duration-200"
            title="Скрыть"
          >
            <MdClose className="text-lg sm:text-xl" />
          </button>
        </div>
      </div>
    </div>
  );
}
