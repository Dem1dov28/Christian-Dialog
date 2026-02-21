import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  MdSearch,
  MdClose,
  MdChat,
  MdGroup,
  MdArrowBack,
  MdPushPin,
  MdFilterList,
  MdSort,
} from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useAgents } from "../../contexts/AgentsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import apiClient from "../../services/api";
import { formatTime } from "../../utils/formatters";

const TelegramStyleSearch = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("chats"); // 'chats' or 'messages'
  const [searchResults, setSearchResults] = useState({
    chats: [],
    messages: [],
  });
  const [isSearching, setIsSearching] = useState(false);
  const [messageFilter, setMessageFilter] = useState("all"); // 'all', 'current', 'pinned'
  const [sortBy, setSortBy] = useState("relevance"); // 'relevance', 'date', 'title'
  const [searchStats, setSearchStats] = useState({
    total: 0,
    hasMore: false,
    conversationsCount: 0,
    messagesCount: 0,
  });

  const { conversations, selectConversation, activeConversation } = useChats();
  const { getAgent } = useAgents();
  const { t, translateAgent } = useLanguage();

  // Обработка клавиши Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  // Вкладки поиска
  const searchTabs = useMemo(() => [
    { id: "chats", label: t("chat.chats"), icon: MdChat },
    { id: "messages", label: t("chat.messages"), icon: MdGroup },
  ], [t]);

  // Фильтры для сообщений
  const messageFilters = useMemo(() => [
    { id: "all", label: t("chat.fromAllChats") },
    { id: "current", label: t("chat.fromCurrentChat") },
    { id: "pinned", label: t("chat.pinned") },
  ], [t]);

  // Опции сортировки
  const sortOptions = useMemo(() => [
    { id: "relevance", label: t("chat.byRelevance"), icon: MdSearch },
    { id: "date", label: t("chat.byDate"), icon: MdSort },
    { id: "title", label: t("chat.byTitle"), icon: MdChat },
  ], [t]);

  // Поиск чатов
  const searchConversations = useCallback(
    async (query) => {
      try {
        const results = await apiClient.searchConversations(query, 20, sortBy);
        return results.results || [];
      } catch (error) {
        console.error("Failed to search conversations:", error);
        return [];
      }
    },
    [sortBy]
  );

  // Поиск сообщений
  const searchMessages = useCallback(
    async (query) => {
      try {
        if (messageFilter === "current" && activeConversation?.id) {
          const results = await apiClient.searchMessagesInConversation(
            activeConversation.id,
            query,
            50,
            messageFilter === "pinned" ? "pinned" : "all",
            sortBy
          );
          return results.results || [];
        } else {
          const results = await apiClient.globalSearch(query, 30, sortBy);
          return results.results || [];
        }
      } catch (error) {
        console.error("Failed to search messages:", error);
        return [];
      }
    },
    [messageFilter, activeConversation?.id, sortBy]
  );

  // Выполнение поиска
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults({ chats: [], messages: [] });
      setIsSearching(false);
      return;
    }

    const performSearch = async () => {
      setIsSearching(true);

      try {
        const [chats, messages] = await Promise.all([
          searchConversations(searchQuery),
          searchMessages(searchQuery),
        ]);

        setSearchResults({ chats, messages });

        // Обновляем статистику
        setSearchStats({
          total: chats.length + messages.length,
          hasMore: false, // Можно добавить логику для определения hasMore
          conversationsCount: chats.length,
          messagesCount: messages.length,
        });
      } catch (error) {
        console.error("Search failed:", error);
        setSearchResults({ chats: [], messages: [] });
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(performSearch, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchConversations, searchMessages]);

  // Обработка выбора чата
  const handleChatSelect = async (conversation) => {
    console.log("Chat selected:", conversation);
    await selectConversation(conversation.id);
    onClose();
    setSearchQuery("");
  };

  // Обработка выбора сообщения
  const handleMessageSelect = async (message) => {
    if (message.conversation_id) {
      await selectConversation(message.conversation_id);
      // Простая прокрутка к сообщению
      setTimeout(() => {
        const messageElement = document.querySelector(
          `[data-message-id="${message.id}"]`
        );
        if (messageElement) {
          messageElement.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
          messageElement.classList.add("highlight-message");
          setTimeout(() => {
            messageElement.classList.remove("highlight-message");
          }, 2000);
        }
      }, 1000);
    }
    onClose();
    setSearchQuery("");
  };

  // Подсветка текста
  const highlightText = (text, query) => {
    if (!query.trim()) return text;

    const regex = new RegExp(`(${query})`, "gi");
    const parts = text.split(regex);

    return parts.map((part, index) =>
      regex.test(part) ? (
        <mark key={index} className="bg-purple-200 text-purple-900 px-1 rounded">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };


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

  // Обрезка текста
  const truncateText = (text, maxLength = 100) => {
    // Сначала очищаем контент от reply-блоков
    const cleaned = cleanMessageContent(text);
    if (cleaned.length <= maxLength) return cleaned;
    return cleaned.substring(0, maxLength) + "...";
  };

  // Функция для получения правильного названия чата (без префикса "чат с")
  const getChatDisplayName = (conversation) => {
    // Сначала пытаемся получить имя агента из контекста агентов
    if (conversation.agent_id) {
      const agent = getAgent(conversation.agent_id);
      if (agent && agent.name) {
        // Находим все разговоры с этим агентом
        const agentConversations = conversations.filter(
          (conv) => conv.agent_id === conversation.agent_id && !conv.is_group
        );

        // Если чатов с агентом больше одного, добавляем номер
        if (agentConversations.length > 1) {
          // Сортируем по времени создания для правильного порядка
          const sortedConversations = agentConversations.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
          
          // Находим индекс текущего чата
          const conversationIndex = sortedConversations.findIndex(
            (conv) => conv.id === conversation.id
          );

          // Добавляем номер в скобках
          const translatedAgent = translateAgent(agent);
          return `${translatedAgent.name} (${conversationIndex + 1})`;
        }

        return translateAgent(agent).name;
      }
    }

    // Если агент не найден, парсим название чата
    if (conversation.title) {
      let title = conversation.title;

      // Убираем различные префиксы
      const prefixes = [
        "Чат с ",
        "Тестовый чат с ",
        "Текстовый чат с ",
        "Chat with ",
        "Test chat with ",
        "Text chat with ",
      ];

      for (const prefix of prefixes) {
        if (title.startsWith(prefix)) {
          title = title.substring(prefix.length);
          break;
        }
      }

      return title || t("common.chat");
    }

    return t("common.chat");
  };

  // Функция для получения типа агента
  const getAgentType = (conversation) => {
    if (conversation.agent_id) {
      const agent = getAgent(conversation.agent_id);
      if (agent && agent.category) {
        switch (agent.category) {
          case "chats":
            return t("common.characters");
          case "tools":
            return t("common.tools");
          case "models":
            return t("common.models");
          default:
            return t("chat.agent");
        }
      }
    }
    return t("chat.agent");
  };

  // Мемоизированные компоненты для оптимизации
  const ChatResultItem = useMemo(() => {
    return ({ conversation, searchQuery, onSelect }) => (
      <div
        key={conversation.id}
        onClick={() => onSelect(conversation)}
        className="p-3 bg-tg-bg-secondary hover:bg-tg-bg-tertiary rounded-lg cursor-pointer transition-colors group"
      >
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-tg-accent rounded-full flex items-center justify-center">
            <MdChat className="text-white text-lg" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-[var(--text-white)] truncate">
              {highlightText(getChatDisplayName(conversation), searchQuery)}
            </h4>
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--text-gray)]">
                {formatTime(conversation.updated_at)}
              </p>
              <span className="text-xs text-[var(--accent)] bg-[var(--accent)]/20 px-2 py-1 rounded">
                {getAgentType(conversation)}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }, []);

  const MessageResultItem = useMemo(() => {
    return ({ message, searchQuery, onSelect }) => (
      <div
        key={message.id}
        onClick={() => onSelect(message)}
        className="p-3 bg-tg-bg-secondary hover:bg-tg-bg-tertiary rounded-lg cursor-pointer transition-colors group"
      >
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-tg-accent rounded-full flex items-center justify-center flex-shrink-0">
            <MdGroup className="text-white text-sm" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-medium text-[var(--text-white)] text-sm truncate">
                {message.conversation_title || t("common.chat")}
              </h4>
              <div className="flex items-center space-x-2">
                {message.relevance_score > 0 && (
                  <span className="text-xs text-[var(--accent)] bg-[var(--accent)]/20 px-2 py-1 rounded">
                    {Math.round(message.relevance_score)}%
                  </span>
                )}
                <span className="text-xs text-[var(--text-gray)]">
                  {formatTime(message.created_at)}
                </span>
              </div>
            </div>
            <p className="text-sm text-[var(--text-gray)] leading-relaxed">
              {highlightText(truncateText(message.content, 150), searchQuery)}
            </p>
            {message.is_pinned && (
              <div className="flex items-center mt-2 text-xs text-[var(--accent)]">
                <MdPushPin className="mr-1" />
                {t("chat.pinned")}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }, []);

  if (!isOpen) return null;

  return (
    <div className="search-panel flex h-full">
      {/* Левая панель поиска - такая же ширина как Sidebar */}
      <div
        className="bg-tg-bg-dark border-r border-tg-border flex flex-col h-full"
        style={{ width: "var(--left-panel-width, 320px)" }}
      >
        {/* Заголовок поиска */}
        <div className="flex items-center p-4 border-b border-tg-border bg-tg-bg-dark">
          <button
            onClick={onClose}
            className="mr-3 p-2 hover:bg-tg-bg-secondary rounded-lg transition-colors"
          >
            <MdArrowBack className="text-[var(--text-white)] text-xl" />
          </button>

          <div className="flex-1 relative">
            <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-gray)] text-lg" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("chat.searchPlaceholder")}
              className="w-full pl-10 pr-10 py-3 bg-tg-bg-secondary border-none rounded-lg text-[var(--text-white)] placeholder-[var(--text-gray)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--text-gray)] hover:text-[var(--text-white)]"
              >
                <MdClose className="text-lg" />
              </button>
            )}
          </div>
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-tg-border bg-tg-bg-dark">
          {searchTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center py-3 px-4 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                    : "text-[var(--text-gray)] hover:text-[var(--text-white)]"
                }`}
              >
                <Icon className="mr-2 text-lg" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Фильтры для сообщений */}
        {activeTab === "messages" && (
          <div className="p-4 border-b border-tg-border bg-tg-bg-dark">
            <div className="flex items-center space-x-2">
              <MdFilterList className="text-[var(--text-gray)]" />
              <span className="text-sm text-[var(--text-gray)]">{t("chat.filter")}:</span>
              <select
                value={messageFilter}
                onChange={(e) => setMessageFilter(e.target.value)}
                className="bg-tg-bg-secondary text-[var(--text-white)] border border-tg-border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
              >
                {messageFilters.map((filter) => (
                  <option key={filter.id} value={filter.id}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Сортировка */}
        <div className="p-4 border-b border-tg-border bg-tg-bg-dark">
            <div className="flex items-center space-x-2">
              <MdSort className="text-[var(--text-gray)]" />
              <span className="text-sm text-[var(--text-gray)]">{t("chat.sortBy")}:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-tg-bg-secondary text-[var(--text-white)] border border-tg-border rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            >
              {sortOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Результаты поиска */}
        <div className="flex-1 overflow-y-auto bg-tg-bg-dark">
          {isSearching ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
              <span className="ml-3 text-[var(--text-gray)]">{t("common.searchingMessages")}</span>
            </div>
          ) : searchQuery.trim() ? (
            <div className="p-4">
              {/* Результаты чатов */}
              {activeTab === "chats" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[var(--text-gray)]">
                      {t("chat.chatsAndContacts")}
                    </h3>
                    {searchStats.total > 0 && (
                      <span className="text-xs text-[var(--text-gray)]">
                        {searchStats.conversationsCount} из {searchStats.total}
                      </span>
                    )}
                  </div>
                  {searchResults.chats.length > 0 ? (
                    <div className="space-y-2">
                      {searchResults.chats.map((conversation) => (
                        <ChatResultItem
                          key={conversation.id}
                          conversation={conversation}
                          searchQuery={searchQuery}
                          onSelect={handleChatSelect}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-[var(--text-gray)]">
                      <MdChat className="mx-auto text-4xl mb-3" />
                      <p>{t("chat.noChatsFound")}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Результаты сообщений */}
              {activeTab === "messages" && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[var(--text-gray)]">
                      {t("chat.messages")}
                    </h3>
                    {searchStats.total > 0 && (
                      <span className="text-xs text-[var(--text-gray)]">
                        {searchStats.messagesCount} из {searchStats.total}
                      </span>
                    )}
                  </div>
                  {searchResults.messages.length > 0 ? (
                    <div className="space-y-3">
                      {searchResults.messages.map((message) => (
                        <MessageResultItem
                          key={message.id}
                          message={message}
                          searchQuery={searchQuery}
                          onSelect={handleMessageSelect}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-[var(--text-gray)]">
                      <MdGroup className="mx-auto text-4xl mb-3" />
                      <p>{t("chat.messagesNotFound")}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-gray)]">
              <MdSearch className="mx-auto text-4xl mb-3" />
              <p>{t("chat.enterQueryToSearchMessages")}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TelegramStyleSearch;
