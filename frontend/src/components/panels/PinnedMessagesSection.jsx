import React, { useState, useEffect } from "react";
import { BsPinFill, BsPin } from "react-icons/bs";
import { MdClose, MdExpandMore, MdExpandLess } from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatTime } from "../../utils/formatters";

export default function PinnedMessagesSection({ activeConversationId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const {
    pinnedMessages,
    loadPinnedMessages,
    unpinMessageFromChat,
    scrollToMessage,
  } = useChats();
  const { t } = useLanguage();

  // Загружаем закрепленные сообщения
  useEffect(() => {
    if (activeConversationId) {
      loadPinnedMessages(activeConversationId);
    }
  }, [activeConversationId]); // Убираем loadPinnedMessages из зависимостей

  const handleUnpin = async (messageId) => {
    try {
      await unpinMessageFromChat(activeConversationId, messageId);
    } catch (error) {
      console.error("Error unpinning message:", error);
    }
  };

  const handleScrollToMessage = async (messageId) => {
    try {
      // Отправляем глобальное событие для компонента чата,
      // чтобы запустить уже реализованную анимацию скролла + подсветку
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("chat-scroll-to-message", {
            detail: { conversationId: activeConversationId, messageId },
          })
        );
      }

      // Параллельно дергаем текущую функцию, чтобы при необходимости подгрузить сообщения
      await scrollToMessage(activeConversationId, messageId);
    } catch (error) {
      console.error("Error scrolling to message:", error);
    }
  };


  const truncateText = (text, maxLength = 100) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  /**
   * Декодирует HTML entities и удаляет reply-блоки, сохраняя HTML-теги как текст
   * Это позволяет показывать текст с тегами (например, &lt;div&gt;test&lt;/div&gt; → <div>test</div>) как обычный текст
   * 
   * ВАЖНО: Работаем ТОЛЬКО со строкой через regex, НЕ используем DOM для удаления тегов.
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
    
    // Шаг 2: Декодируем HTML entities ТОЛЬКО через regex (НЕ используем DOM для удаления тегов)
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

  if (!activeConversationId) return null;

  const currentPinnedMessages = pinnedMessages[activeConversationId] || [];

  return (
    <div className="border-b border-[var(--border-color)]">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <BsPinFill className="text-[var(--accent)] text-lg" />
          <span className="font-medium text-[var(--text-white)] select-none">
            {t("chat.pinnedMessages")}
          </span>
          {currentPinnedMessages.length > 0 && (
            <span className="bg-[var(--accent)] text-white text-xs px-2 py-1 rounded-full select-none">
              {currentPinnedMessages.length}
            </span>
          )}
        </div>
        {isExpanded ? (
          <MdExpandLess className="text-[var(--text-gray)]" />
          ) : (
          <MdExpandMore className="text-[var(--text-gray)]" />
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3">
          {currentPinnedMessages.length > 0 ? (
            <div className="space-y-2">
              {currentPinnedMessages.map((message) => (
                <div
                  key={message.id}
                  className="bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-color)]/50 cursor-pointer hover:bg-[var(--hover-bg)] active:bg-[var(--active-bg)] transition-colors duration-200"
                  onClick={() => handleScrollToMessage(message.id)}
                  title={t("chat.goToMessage")}
                  style={{ cursor: "pointer" }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <BsPin className="text-[var(--accent)] text-sm" />
                      <span className="text-xs text-[var(--text-gray)]">
                        {message.is_from_user
                          ? t("chat.you")
                          : message.agent_name || t("chat.agent")}
                      </span>
                      <span className="text-xs text-[var(--text-gray)]">
                        {formatTime(message.created_at)}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnpin(message.id);
                      }}
                      className="text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors duration-200"
                    >
                      <MdClose className="text-sm" />
                    </button>
                  </div>
                  <p className="text-sm text-[var(--text-white)] break-words overflow-hidden">
                    {truncateText(getCleanText(message.content), 80)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4">
              <BsPin className="text-[var(--text-gray)] text-2xl mx-auto mb-2" />
              <p className="text-sm text-[var(--text-gray)]">
                {t("chat.noPinnedMessages")}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
