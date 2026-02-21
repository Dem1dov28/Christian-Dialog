import React, { useState, useEffect, useMemo } from "react";
import { MdSearch, MdClose, MdChat, MdGroup } from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useAgents } from "../../contexts/AgentsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import apiClient from "../../services/api";

const ChatSearch = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const { conversations, selectConversation } = useChats();
  const { agents, getAgent } = useAgents();
  const { t, translateAgent, language } = useLanguage();
  
  // Создаем Set с ID агентов для быстрой проверки
  const agentIds = useMemo(() => {
    return new Set(agents.map(a => a.id));
  }, [agents]);
  
  // Фильтруем conversations, исключая чаты с удаленными агентами
  const validConversations = useMemo(() => {
    return conversations.filter((conversation) => {
      // Пропускаем групповые чаты и каналы
      if (conversation.is_group || conversation.is_channel || conversation.isChannel) {
        return true;
      }
      // Пропускаем чаты без agent_id
      if (!conversation.agent_id) {
        return true;
      }
      // Фильтруем чаты с удаленными агентами
      return agentIds.has(conversation.agent_id);
    });
  }, [conversations, agentIds]);

  // Фильтрация чатов по поисковому запросу
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return [];

    const query = searchQuery.toLowerCase().trim();

    return validConversations.filter((conversation) => {
      // Поиск по названию чата
      const titleMatch = conversation.title?.toLowerCase().includes(query);

      // Поиск по агенту (если есть)
      const agentMatch = conversation.agent_name?.toLowerCase().includes(query);

      return titleMatch || agentMatch;
    });
  }, [validConversations, searchQuery]);

  // Обработка поиска
  useEffect(() => {
    if (searchQuery.trim()) {
      setIsSearching(true);

      // Выполняем поиск через API
      const performSearch = async () => {
        try {
          const response = await apiClient.searchConversations(
            searchQuery.trim(),
            20
          );
          setSearchResults(response.results || []);
        } catch (error) {
          console.error("Ошибка поиска по чатам:", error);
          // В случае ошибки используем локальный поиск как fallback
          setSearchResults(filteredConversations);
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
  }, [searchQuery, filteredConversations]);

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

  // Обработка выбора чата
  const handleChatSelect = (conversation) => {
    selectConversation(conversation.id);
    onClose();
    setSearchQuery("");
  };

  // Обработка закрытия
  const handleClose = () => {
    setSearchQuery("");
    setSearchResults([]);
    onClose();
  };

  // Обработка клавиш
  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center z-50 pt-20">
      <div className="bg-tg-bg border border-tg-border rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b border-tg-border">
          <h2 className="text-lg font-semibold text-[var(--text-white)]">{t("chat.searchInChats")}</h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-tg-bg-secondary rounded-lg transition-colors"
          >
            <MdClose className="text-[var(--text-white)]-secondary text-xl" />
          </button>
        </div>

        {/* Поле поиска */}
        <div className="p-4 border-b border-tg-border">
          <div className="relative">
            <MdSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-white)]-secondary text-xl" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("common.searchPlaceholder")}
              className="w-full pl-10 pr-4 py-3 bg-tg-bg-secondary border border-tg-border rounded-lg text-[var(--text-white)] placeholder-tg-text-secondary focus:outline-none focus:border-tg-accent focus:ring-2 focus:ring-tg-accent/20 transition-all duration-200"
              autoFocus
            />
            {isSearching && (
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-tg-accent border-t-transparent"></div>
              </div>
            )}
          </div>
        </div>

        {/* Результаты поиска */}
        <div className="flex-1 overflow-y-auto">
          {searchQuery.trim() && (
            <div className="p-4">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-tg-accent border-t-transparent"></div>
                  <span className="ml-3 text-[var(--text-white)]-secondary">{t("common.searchingMessages")}</span>
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-[var(--text-white)]-secondary mb-3">
                    {t("chat.chatsCount", { count: searchResults.length })}
                  </p>
                  {searchResults.map((conversation) => (
                    <div
                      key={conversation.id}
                      onClick={() => handleChatSelect(conversation)}
                      className="flex items-center p-3 bg-tg-bg-secondary hover:bg-tg-bg-tertiary rounded-lg cursor-pointer transition-colors group"
                    >
                      <div className="flex-shrink-0 mr-3">
                        {conversation.is_group ? (
                          <MdGroup className="text-tg-accent text-xl" />
                        ) : (
                          <MdChat className="text-tg-accent text-xl" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-[var(--text-white)] truncate group-hover:text-tg-accent transition-colors">
                          {getChatDisplayName(conversation)}
                        </h3>
                        {conversation.agent_id && (() => {
                          const agent = getAgent(conversation.agent_id);
                          return agent && (
                            <p className="text-sm text-[var(--text-white)]-secondary truncate">
                              {t("chat.agent")}: {translateAgent(agent).name}
                            </p>
                          );
                        })()}
                        <p className="text-xs text-[var(--text-white)]-secondary">
                          {new Date(conversation.created_at).toLocaleDateString(
                            language === "ru" ? "ru-RU" : "en-US"
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MdSearch className="mx-auto text-[var(--text-white)]-secondary text-4xl mb-3" />
                  <p className="text-[var(--text-white)]-secondary">{t("chat.noChatsFound")}</p>
                  <p className="text-sm text-[var(--text-white)]-secondary mt-1">
                    {t("common.tryChangingQuery")}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Подсказки */}
        {!searchQuery.trim() && (
          <div className="p-4 text-center text-[var(--text-white)]-secondary">
            <p>{t("chat.enterQueryToSearchMessages")}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSearch;
