import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  MdSearch,
  MdClose,
  MdArrowUpward,
  MdArrowDownward,
  MdHighlight,
} from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useAgents } from "../../contexts/AgentsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import apiClient from "../../services/api";
import { formatTime } from "../../utils/formatters";

/**
 * Очищает контент от reply-блоков и декодирует HTML entities
 * Работает ТОЛЬКО со строкой через regex, сохраняя HTML-теги как текст
 */
const cleanMessageContent = (content) => {
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
  
  // Шаг 2: Декодируем HTML entities ТОЛЬКО через regex
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

const MessageSearch = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [currentResultIndex, setCurrentResultIndex] = useState(0);
  const [isSearching, setIsSearching] = useState(false);
  const { messages, activeConversation, scrollToMessage } = useChats();
  const { getAgent } = useAgents();
  const { t, translateAgent } = useLanguage();
  const searchInputRef = useRef(null);

  // Фильтрация сообщений по поисковому запросу
  const filteredMessages = useMemo(() => {
    if (!searchQuery.trim() || !messages) return [];

    const query = searchQuery.toLowerCase().trim();

    return messages.filter((message) => {
      const cleanedContent = cleanMessageContent(message.content || "");
      return cleanedContent.toLowerCase().includes(query);
    });
  }, [messages, searchQuery]);

  // Обработка поиска
  useEffect(() => {
    if (searchQuery.trim() && activeConversation) {
      setIsSearching(true);

      // Выполняем поиск через API
      const performSearch = async () => {
        try {
          const response = await apiClient.searchMessagesInConversation(
            activeConversation.id,
            searchQuery.trim(),
            50
          );
          setSearchResults(response.results || []);
        } catch (error) {
          console.error("Ошибка поиска по сообщениям:", error);
          // В случае ошибки используем локальный поиск как fallback
          setSearchResults(filteredMessages);
        } finally {
          setIsSearching(false);
        }
      };

      // Добавляем небольшую задержку для debounce
      const timer = setTimeout(performSearch, 300);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  }, [searchQuery, filteredMessages, activeConversation]);

  // Навигация по результатам
  const goToNextResult = () => {
    if (searchResults.length > 0) {
      const nextIndex = (currentResultIndex + 1) % searchResults.length;
      setCurrentResultIndex(nextIndex);
      scrollToResult(nextIndex);
    }
  };

  const goToPreviousResult = () => {
    if (searchResults.length > 0) {
      const prevIndex =
        currentResultIndex === 0
          ? searchResults.length - 1
          : currentResultIndex - 1;
      setCurrentResultIndex(prevIndex);
      scrollToResult(prevIndex);
    }
  };

  // Прокрутка к результату
  const scrollToResult = (index) => {
    if (searchResults[index] && activeConversation) {
      scrollToMessage(activeConversation.id, searchResults[index].id);
    }
  };

  // Обработка выбора результата
  const handleResultClick = (message) => {
    if (activeConversation) {
      scrollToMessage(activeConversation.id, message.id);
    }
  };

  // Обработка закрытия
  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    setCurrentResultIndex(0);
    onClose();
  };

  // Обработка клавиш
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      handleClose();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (searchResults.length > 0) {
        scrollToResult(currentResultIndex);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      goToNextResult();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      goToPreviousResult();
    }
  };

  // Подсветка текста в результатах
  const highlightText = (text, query) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      part.toLowerCase() === query.trim().toLowerCase() ? (
        <mark
          key={index}
          className="bg-yellow-200/80 dark:bg-yellow-500/30 text-yellow-900 dark:text-yellow-200 px-1 rounded"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };


  // Автофокус на поле ввода
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/50"
      style={{
        paddingTop: "calc(var(--safe-area-inset-top, env(safe-area-inset-top, 0px)) + 1.5rem)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div
        className="bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-xl shadow-xl w-full max-w-3xl mx-4 flex flex-col"
        style={{ maxHeight: "80vh" }}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] shrink-0">
          <h2 className="text-lg font-semibold text-[var(--text-white)] truncate pr-2">
            {t("chat.searchInChat")}
            {activeConversation && (
              <span className="text-sm text-[var(--text-dim)] ml-2 font-normal">
                — {activeConversation.title}
              </span>
            )}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[var(--hover-bg)] rounded-lg transition-colors shrink-0"
            aria-label={t("common.close")}
          >
            <MdClose className="text-[var(--text-dim)] text-xl" />
          </button>
        </div>

        {/* Поле поиска */}
        <div className="p-4 border-b border-[var(--border-color)] shrink-0">
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-dim)] text-xl" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.searchMessagesPlaceholder")}
              className="w-full pl-10 pr-4 py-3 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-lg text-[var(--text-white)] placeholder-[var(--text-dim)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50 transition-all"
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[var(--accent)] border-t-transparent" />
              </div>
            )}
          </div>

          {/* Навигация по результатам */}
          {searchResults.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={goToPreviousResult}
                  className="p-2 hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
                  title={t("chat.prevResult")}
                >
                  <MdArrowUpward className="text-[var(--text-dim)]" />
                </button>
                <button
                  onClick={goToNextResult}
                  className="p-2 hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
                  title={t("chat.nextResult")}
                >
                  <MdArrowDownward className="text-[var(--text-dim)]" />
                </button>
                <span className="text-sm text-[var(--text-dim)]">
                  {t("chat.resultOfTotal", { current: currentResultIndex + 1, total: searchResults.length })}
                </span>
              </div>
              <div className="text-xs sm:text-sm text-[var(--text-dim)]">
                {t("chat.useArrowsEnterHint")}
              </div>
            </div>
          )}
        </div>

        {/* Результаты поиска */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {searchQuery.trim() && (
            <div className="p-4">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--accent)] border-t-transparent" />
                  <span className="ml-3 text-[var(--text-dim)]">{t("common.searchingMessages")}</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-3">
                  <p className="text-sm text-[var(--text-dim)] mb-3">
                    {t("chat.searchResultsCount", { count: searchResults.length })}
                  </p>
                  {searchResults.map((message, index) => (
                    <div
                      key={message.id}
                      onClick={() => handleResultClick(message)}
                      className={`p-3 bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] rounded-lg cursor-pointer transition-colors ${
                        index === currentResultIndex ? "ring-2 ring-[var(--accent)]" : ""
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2 gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <MdHighlight className="text-[var(--accent)] text-sm shrink-0" />
                          <span className="text-sm font-medium text-[var(--text-white)] truncate">
                            {message.is_from_user
                              ? t("chat.you")
                              : (() => {
                                  if (message.agent_id) {
                                    const agent = getAgent(message.agent_id);
                                    return agent ? translateAgent(agent).name : t("chat.agent");
                                  }
                                  return message.agent_name || t("chat.agent");
                                })()}
                          </span>
                        </div>
                        <span className="text-xs text-[var(--text-dim)] shrink-0">
                          {formatTime(message.created_at)}
                        </span>
                      </div>
                      <div className="text-[var(--text-white)] text-sm line-clamp-2">
                        {highlightText(
                          cleanMessageContent(message.content || ""),
                          searchQuery
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MdSearch className="mx-auto text-[var(--text-dim)] text-4xl mb-3" />
                  <p className="text-[var(--text-dim)]">{t("chat.messagesNotFound")}</p>
                  <p className="text-sm text-[var(--text-dim)] mt-1">
                    {t("chat.tryChangeQuery")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Подсказки */}
        {!searchQuery.trim() && (
          <div className="p-4 text-center text-[var(--text-dim)] shrink-0">
            <p>{t("chat.enterSearchText")}</p>
            <p className="text-sm mt-1">{t("chat.useArrowsForNavigation")}</p>
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined"
    ? createPortal(modalContent, document.body)
    : modalContent;
};

export default MessageSearch;
