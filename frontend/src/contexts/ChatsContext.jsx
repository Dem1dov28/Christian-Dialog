import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { useAuth } from "./AuthContext";
import { useSidebarUpdate } from "./SidebarUpdateContext";
import apiClient from "../services/api";
import { useMessageState } from "../hooks/message/useMessageState";
import { removeAgentFromLibrary } from "../utils/agentUtils";

// Простая функция debounce
const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

const ChatsContext = createContext();

export const useChats = () => {
  const context = useContext(ChatsContext);
  if (!context) {
    throw new Error("useChats must be used within a ChatsProvider");
  }
  return context;
};

export const ChatsProvider = ({ children }) => {
  const { isAuthenticated, forceLogout, user, refreshUserData } = useAuth();
  const { triggerUpdate } = useSidebarUpdate();
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);

  // Ref для отслеживания активного чата в реальном времени (для проверки непрочитанных)
  const activeConversationRef = useRef(null);

  // Ref для отслеживания новых пустых чатов (для автоматического удаления при переключении)
  const newlyCreatedEmptyChatsRef = useRef(new Set());

  // НОВАЯ СТРУКТУРА: Хранение сообщений по conversation_id
  // { [conversationId]: [...messages] }
  const [messagesByConversation, setMessagesByConversation] = useState({});

  // LRU tracking для garbage collection
  const [recentlyAccessedChats, setRecentlyAccessedChats] = useState([]);
  const MAX_CACHED_CHATS = 10; // Максимум чатов в памяти

  // Каналы (глобальные чаты-рассылки)
  const channelsRef = useRef([]);
  const [channels, setChannels] = useState([]);
  const [isChannelsLoading, setIsChannelsLoading] = useState(false);
  const [channelsError, setChannelsError] = useState(null);
  const isLoadingChannelsRef = useRef(false); // Защита от параллельных вызовов

  const mergeChannelsIntoConversations = useMemo(() => {
    return (baseList, incomingChannels, options = {}) => {
      const replace = (options && options.replace) || false;
      // КРИТИЧНО: Фильтруем только подписанные каналы перед добавлением в conversations
      const incoming = Array.isArray(incomingChannels)
        ? incomingChannels.filter((channel) => {
          if (!channel || channel.id == null) {
            return false;
          }
          // Если это канал, проверяем подписку
          if (channel.is_channel) {
            const isSubscribed = channel.isSubscribed === true || channel.is_subscribed === true;
            if (!isSubscribed) {
              return false;
            }
          }
          return true;
        })
        : [];

      const incomingIds = new Set(incoming.map((channel) => channel.id));
      const mergedMap = new Map();

      if (Array.isArray(baseList)) {
        baseList.forEach((conversation) => {
          if (
            !conversation ||
            conversation.id === undefined ||
            conversation.id === null
          ) {
            return;
          }

          if (
            replace &&
            conversation.is_channel &&
            !incomingIds.has(conversation.id)
          ) {
            return;
          }

          mergedMap.set(conversation.id, conversation);
        });
      }

      incoming.forEach((channel) => {
        const existing = mergedMap.get(channel.id);
        if (existing) {
          mergedMap.set(channel.id, { ...existing, ...channel });
        } else {
          mergedMap.set(channel.id, channel);
        }
      });

      return Array.from(mergedMap.values());
    };
  }, []);

  const formatChannel = useCallback((channel) => {
    if (!channel) return null;

    const agentPayload = channel.agent
      ? {
        id: channel.agent.id,
        name: channel.agent.name,
        image_url: channel.agent.image_url,
        avatar_url: channel.agent.avatar_url,
        color_class: channel.agent.color_class,
        icon_name: channel.agent.icon_name,
        description: channel.agent.description,
      }
      : null;

    const agentId = channel.agent_id ?? agentPayload?.id ?? null;
    const channelId = `channel-${channel.id}`; // Добавляем префикс для уникальности
    const channelAvatar =
      channel.channel_avatar_url ||
      agentPayload?.image_url ||
      agentPayload?.avatar_url ||
      null;
    const colorClass =
      channel.channel_color_class ||
      agentPayload?.color_class ||
      channel.colorClass ||
      "bg-blue-500";
    const iconName =
      channel.channel_icon_name || agentPayload?.icon_name || "notifications";

    return {
      id: channelId,
      conversation_id: channelId,
      real_id: channel.id, // Сохраняем оригинальный числовой ID
      title:
        channel.title ||
        channel.channel_description ||
        channel.owner?.username ||
        `Канал #${channel.id}`,
      agent_id: agentId,
      is_channel: true,
      channel_description: channel.channel_description || null,
      channel_owner_id: channel.channel_owner_id || channel.owner?.id || null,
      can_write: !!channel.can_write,
      is_listed: channel.is_listed !== false,
      is_system_chat: false,
      created_at: channel.created_at || null,
      updated_at: channel.updated_at || null,
      owner: channel.owner || null,
      message_count: channel.message_count ?? 0,
      unread_count: channel.unread_count ?? 0,
      iconName,
      colorClass,
      // КРИТИЧНО: Сохраняем также исходные поля для использования в fallback
      channel_icon_name: channel.channel_icon_name || agentPayload?.icon_name || iconName,
      channel_color_class: channel.channel_color_class || agentPayload?.color_class || colorClass,
      preview: channel.channel_description || "Канал (только чтение)",
      channel_avatar_url: channelAvatar,
      imageSrc: channelAvatar,
      agent: agentPayload,
      isSubscribed: channel.is_subscribed ?? channel.isSubscribed ?? false,
      source_url: channel.source_url || null,
    };
  }, []);

  const loadChannels = useCallback(
    async (options = { includeHidden: false }) => {
      if (!isAuthenticated) {
        return;
      }

      // Защита от параллельных вызовов через ref (не вызывает пересоздание функции)
      if (isLoadingChannelsRef.current) {
        return;
      }

      try {
        isLoadingChannelsRef.current = true;
        setIsChannelsLoading(true);
        setChannelsError(null);

        // УДАЛЕНО - channels были удалены
        const channelList = [];

        const formattedChannels =
          (channelList || []).map((channel) => formatChannel(channel)).filter(Boolean) ?? [];

        // КРИТИЧНО: Удаляем дубликаты по ID (строгая проверка) - для ВСЕХ каналов
        const channelMap = new Map();
        formattedChannels.forEach((ch) => {
          if (ch && ch.id != null) {
            // Если канал с таким ID уже есть, проверяем какой новее
            const existing = channelMap.get(ch.id);
            if (!existing || (ch.updated_at && existing.updated_at && new Date(ch.updated_at) > new Date(existing.updated_at))) {
              channelMap.set(ch.id, ch);
            }
          }
        });
        let uniqueChannels = Array.from(channelMap.values());

        // КРИТИЧНО: Удаляем дубликаты по названию (для случаев когда один канал создан несколько раз)
        const titleMap = new Map();
        uniqueChannels.forEach(ch => {
          const title = (ch.title || '').toLowerCase().trim();
          if (title) {
            if (!titleMap.has(title)) {
              // Первый канал с таким названием - добавляем
              titleMap.set(title, ch);
            } else {
              // Уже есть канал с таким названием - оставляем тот, у которого меньший ID (старше)
              const existing = titleMap.get(title);
              if (ch.id < existing.id) {
                titleMap.set(title, ch);
                console.warn(`[loadChannels] ⚠️ Дубликат по названию "${title}": оставляем ID=${ch.id}, удаляем ID=${existing.id}`);
              } else {
                console.warn(`[loadChannels] ⚠️ Дубликат по названию "${title}": оставляем ID=${existing.id}, удаляем ID=${ch.id}`);
              }
            }
          } else {
            // Каналы без названия добавляем по ID
            titleMap.set(`__no_title_${ch.id}__`, ch);
          }
        });
        uniqueChannels = Array.from(titleMap.values());

        // КРИТИЧНО: В channelsRef и channels сохраняем ВСЕ каналы (для отображения в библиотеке)
        // Это позволяет пользователям видеть все доступные каналы и подписываться на них
        channelsRef.current = uniqueChannels;
        setChannels(uniqueChannels);

        // КРИТИЧНО: Обновляем conversations - добавляем ТОЛЬКО подписанные каналы
        // Каналы должны появляться в списке чатов ТОЛЬКО после явной подписки
        const subscribedUniqueChannels = uniqueChannels.filter((ch) => {
          // Строгая проверка: только каналы с явно установленным isSubscribed === true
          const isSubscribed = ch.isSubscribed === true || ch.is_subscribed === true;
          return isSubscribed;
        });

        // КРИТИЧНО: При обновлении conversations удаляем все неподписанные каналы
        // Это гарантирует, что в списке чатов будут только подписанные каналы
        setConversations((prev) => {
          // Сначала удаляем все неподписанные каналы из текущего списка
          const prevWithoutUnsubscribedChannels = (prev || []).filter((conv) => {
            // Если это канал, проверяем подписку
            if (conv.is_channel) {
              const isSubscribed = conv.isSubscribed === true || conv.is_subscribed === true;
              if (!isSubscribed) {
                return false;
              }
            }
            // Обычные чаты оставляем
            return true;
          });

          // Теперь объединяем с новыми подписанными каналами
          const merged = mergeChannelsIntoConversations(prevWithoutUnsubscribedChannels, subscribedUniqueChannels, { replace: true });
          const prevChannelsCount = prevWithoutUnsubscribedChannels.filter(c => c.is_channel).length;
          const newChannelsCount = merged.filter(c => c.is_channel).length;

          // Если количество каналов не изменилось и ID совпадают, не обновляем state
          if (prevChannelsCount === newChannelsCount && prevWithoutUnsubscribedChannels.length > 0) {
            const prevChannelIds = new Set(prevWithoutUnsubscribedChannels.filter(c => c.is_channel).map(c => c.id));
            const newChannelIds = new Set(merged.filter(c => c.is_channel).map(c => c.id));
            if (prevChannelIds.size === newChannelIds.size &&
              [...prevChannelIds].every(id => newChannelIds.has(id))) {
              return prev;
            }
          }

          return merged;
        });

        // 📬 СИНХРОНИЗАЦИЯ НЕПРОЧИТАННЫХ ДЛЯ КАНАЛОВ:
        // После обновления conversations синхронизируем unread_count для каналов
        // Используем setTimeout чтобы обновить unreadCounts после того, как conversations обновится
        setTimeout(() => {
          setUnreadCounts((prevCounts) => {
            const newCounts = { ...prevCounts };

            // Удаляем счетчики для неподписанных каналов
            Object.keys(newCounts).forEach(convId => {
              const convIdNum = parseInt(convId, 10);
              const channel = subscribedUniqueChannels.find(c => c.id === convIdNum);
              if (!channel) {
                // Если канал не в списке подписанных, удаляем его счетчик
                delete newCounts[convId];
              }
            });

            // Добавляем/обновляем счетчики для подписанных каналов
            subscribedUniqueChannels.forEach((channel) => {
              if (channel.unread_count && channel.unread_count > 0) {
                // Проверяем, не активен ли канал (для активного канала не показываем счетчик)
                const activeChatIdToReset = activeConversationRef.current;
                if (activeChatIdToReset !== channel.id) {
                  newCounts[channel.id] = channel.unread_count;
                } else {
                  // Если канал активен, удаляем счетчик
                  delete newCounts[channel.id];
                }
              } else {
                // Если счетчик 0 или отсутствует, удаляем из состояния
                delete newCounts[channel.id];
              }
            });

            return newCounts;
          });
        }, 0);
      } catch (error) {
        console.error("Failed to load channels:", error);
        setChannelsError(error.message || "Не удалось загрузить каналы");
      } finally {
        isLoadingChannelsRef.current = false;
        setIsChannelsLoading(false);
      }
    },
    [isAuthenticated, mergeChannelsIntoConversations, formatChannel]
  );

  const subscribeToChannel = useCallback(
    async (channelId) => {
      try {
        const channelResponse = await apiClient.subscribeToChannel(channelId);

        const formatted = formatChannel(channelResponse);
        if (!formatted) {
          console.error(`[subscribeToChannel] Не удалось отформатировать канал`);
          return null;
        }
        formatted.isSubscribed = true;

        // Обновляем channelsRef - добавляем или обновляем только подписанный канал
        const existingChannelIndex = channelsRef.current.findIndex((ch) => ch.id === formatted.id);
        if (existingChannelIndex >= 0) {
          channelsRef.current[existingChannelIndex] = formatted;
        } else {
          channelsRef.current.push(formatted);
        }

        // Обновляем channels state - добавляем или обновляем только подписанный канал
        setChannels((prev) => {
          const existingIndex = (prev || []).findIndex((ch) => ch.id === formatted.id);
          if (existingIndex >= 0) {
            const updated = [...prev];
            updated[existingIndex] = formatted;
            return updated;
          } else {
            return [...(prev || []), formatted];
          }
        });

        // Обновляем conversations - добавляем или обновляем только подписанный канал, не удаляя другие
        setConversations((prev) => {
          const prevList = prev || [];
          const existingIndex = prevList.findIndex((conv) => conv.id === formatted.id);

          let updated;
          if (existingIndex >= 0) {
            // Обновляем существующий канал
            updated = [...prevList];
            updated[existingIndex] = { ...updated[existingIndex], ...formatted, isSubscribed: true };
            console.log(`[subscribeToChannel] Обновлен существующий канал в conversations`);
          } else {
            // Добавляем новый канал
            updated = [...prevList, formatted];
            console.log(`[subscribeToChannel] Добавлен новый канал в conversations`);
          }

          console.log(`[subscribeToChannel] Обновлено conversations:`, updated.length, "всего,", updated.filter(c => c.is_channel).length, "каналов");

          // КРИТИЧНО: Обновляем activeConversation, если это текущий активный канал
          if (activeConversation?.id === formatted.id) {
            const updatedActive = { ...activeConversation, ...formatted, isSubscribed: true };
            setActiveConversation(updatedActive);
            console.log(`[subscribeToChannel] Обновлен activeConversation для канала ${formatted.id}`);
          }

          return updated;
        });

        // Загружаем сообщения канала после обновления state, если это текущий активный канал
        // Используем setTimeout чтобы избежать проблем с порядком инициализации
        if (activeConversation?.id === formatted.id) {
          setTimeout(() => {
            // Проверяем через state, а не через замыкание
            setMessagesByConversation(prev => {
              const hasMessages = prev[formatted.id] && prev[formatted.id].length > 0;
              if (!hasMessages) {
                console.log(`[subscribeToChannel] Загружаем последние 25 сообщений канала ${formatted.id}`);
                // Загружаем последние 25 сообщений для оптимизации производительности
                apiClient.getChannelMessages(formatted.id, 0, 25, true)
                  .then(messagesData => {
                    if (messagesData && Array.isArray(messagesData)) {
                      setMessagesByConversation(prevMsgs => ({
                        ...prevMsgs,
                        [formatted.id]: messagesData
                      }));
                      console.log(`[subscribeToChannel] Загружено ${messagesData.length} сообщений канала ${formatted.id}`);
                    }
                  })
                  .catch(err => {
                    console.error(`[subscribeToChannel] Ошибка загрузки сообщений:`, err);
                  });
              }
              return prev;
            });
          }, 0);
        }

        // КРИТИЧНО: Принудительно обновляем sidebar
        triggerUpdate();
        console.log(`[subscribeToChannel] ✅ Подписка успешна, sidebar обновлен`);

        return formatted;
      } catch (error) {
        console.error("[subscribeToChannel] Ошибка подписки:", error);
        throw error;
      }
    },
    [formatChannel, mergeChannelsIntoConversations, triggerUpdate, activeConversation]
  );

  const unsubscribeFromChannel = useCallback(
    async (channelId) => {
      try {
        console.log(`[unsubscribeFromChannel] Отписка от канала ${channelId}...`);
        await apiClient.unsubscribeFromChannel(channelId);

        // Удаляем канал из подписанных
        const updatedSubscribed = channelsRef.current.filter(
          (channel) => channel.id !== channelId
        );
        channelsRef.current = updatedSubscribed;

        // Обновляем channels - удаляем канал из списка
        setChannels((prev) =>
          (prev || []).filter((channel) => channel.id !== channelId)
        );

        // Удаляем канал из conversations
        setConversations((prev) => {
          const filtered = (prev || []).filter((conv) => {
            // Удаляем канал из списка
            if (conv.is_channel && conv.id === channelId) {
              return false;
            }
            return true;
          });
          console.log(`[unsubscribeFromChannel] Удален канал ${channelId} из conversations. Осталось: ${filtered.length}`);
          return filtered;
        });

        // Если отписанный канал был активным, очищаем activeConversation
        if (activeConversation?.id === channelId) {
          console.log(`[unsubscribeFromChannel] Активный канал отписан, очищаем activeConversation`);
          setActiveConversation(null);
        }

        // Обновляем sidebar
        triggerUpdate();
        console.log(`[unsubscribeFromChannel] ✅ Отписка успешна, канал удален из списка`);

        return true;
      } catch (error) {
        console.error("[unsubscribeFromChannel] Ошибка отписки:", error);
        throw error;
      }
    },
    [mergeChannelsIntoConversations, activeConversation, triggerUpdate]
  );

  // Computed value для обратной совместимости: возвращает сообщения активного чата
  const messages = useMemo(() => {
    if (!activeConversation?.id) return [];
    return messagesByConversation[activeConversation.id] || [];
  }, [messagesByConversation, activeConversation?.id]);

  // Функция для получения сообщений по ID разговора (для инструментов)
  const getMessagesByConversationId = useCallback((conversationId) => {
    if (!conversationId) return [];
    return messagesByConversation[conversationId] || [];
  }, [messagesByConversation]);

  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false); // Флаг: разговоры были загружены хотя бы раз
  const [error, setError] = useState(null);
  const [upgradeModal, setUpgradeModal] = useState({ isOpen: false, reason: "limit" });
  const setShowUpgradeModal = useCallback((show, reason = "limit") => {
    setUpgradeModal((prev) => ({ ...prev, isOpen: !!show, reason: show ? (reason || prev.reason) : "limit" }));
  }, []);
  const showUpgradeModal = upgradeModal.isOpen;
  const upgradeModalReason = upgradeModal.reason;

  // Состояние загрузки конкретного чата
  const [isChatLoading, setIsChatLoading] = useState(false);
  // Состояние готовности чата к рендерингу (все данные загружены)
  const [chatReady, setChatReady] = useState(false);

  // Message state management for instant feedback
  const messageStateManager = useMessageState();
  const [pinnedChats, setPinnedChats] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState({});

  // Состояние для непрочитанных сообщений: { [conversationId]: count }
  const [unreadCounts, setUnreadCounts] = useState({});

  // Системный чат
  const [systemChat, setSystemChat] = useState(null);
  const [isSystemChatHidden, setIsSystemChatHidden] = useState(false);

  // Кэшируем самый старый загруженный timestamp для каждого чата
  const oldestMessageTimestampRef = useRef({});

  // Хелпер функция для обновления сообщений конкретного чата
  const updateMessagesForConversation = useCallback(
    (conversationId, updater) => {
      console.log("[ChatsContext] updateMessagesForConversation called with conversationId:", conversationId);

      setMessagesByConversation((prevByConv) => {
        const prevMessages = prevByConv[conversationId] || [];
        const newMessages =
          typeof updater === "function" ? updater(prevMessages) : updater;

        console.log("[ChatsContext] updateMessagesForConversation setting", newMessages?.length || 0, "messages for conversation", conversationId);

        if (newMessages?.length > 0) {
          const oldest = newMessages[0];
          if (oldest?.created_at) {
            oldestMessageTimestampRef.current[conversationId] =
              oldest.created_at;
          }
        } else {
          delete oldestMessageTimestampRef.current[conversationId];
        }

        return {
          ...prevByConv,
          [conversationId]: newMessages,
        };
      });

      // Обновляем LRU список
      setRecentlyAccessedChats((prev) => {
        const filtered = prev.filter((id) => id !== conversationId);
        const updated = [conversationId, ...filtered];

        // Если превышен лимит, удаляем старые чаты из кэша
        if (updated.length > MAX_CACHED_CHATS) {
          const toRemove = updated.slice(MAX_CACHED_CHATS);

          // Удаляем сообщения старых чатов
          setMessagesByConversation((prevByConv) => {
            const newByConv = { ...prevByConv };
            toRemove.forEach((id) => delete newByConv[id]);
            return newByConv;
          });

          return updated.slice(0, MAX_CACHED_CHATS);
        }

        return updated;
      });
    },
    [MAX_CACHED_CHATS]
  );

  // Функция для обновления превью последнего сообщения в списке чатов
  const updateConversationPreview = useCallback(
    (conversationId, newMessage, isFromUser = false) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === conversationId) {
            if (conv.is_channel) {
              // Для каналов всегда оставляем описание вместо превью последнего сообщения
              return conv;
            }
            const getCleanText = (content) => {
              if (!content || typeof content !== "string") return "";
              let cleaned = content
                .replace(
                  /<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
                  ""
                )
                .replace(
                  /<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
                  ""
                )
                .replace(
                  /<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
                  ""
                )
                .replace(
                  /<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
                  ""
                );

              cleaned = cleaned.trim().replace(/^<\/div>\s*/i, "");
              cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*/i, "");
              cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*<\/div>\s*/i, "");

              const decoded = cleaned
                .replace(/&amp;/g, "&")
                .replace(/&lt;/g, "<")
                .replace(/&gt;/g, ">")
                .replace(/&quot;/g, '"')
                .replace(/&#039;/g, "'")
                .replace(/&#x27;/g, "'");

              return decoded.trim();
            };

            const cleanText = getCleanText(newMessage);
            const previewText =
              cleanText.length > 50 ? cleanText.substring(0, 50) + "..." : cleanText;

            return {
              ...conv,
              last_message: previewText,
              updated_at: new Date().toISOString(),
            };
          }
          return conv;
        })
      );
    },
    []
  );

  // Функция для обновления только превью сообщения без изменения времени (при загрузке сообщений)
  const updateConversationPreviewOnly = useCallback(
    (conversationId, newMessage, isFromUser = false) => {
      setConversations((prev) =>
        prev.map((conv) => {
          if (conv.id === conversationId) {
            if (conv.is_channel) {
              // Для каналов не меняем превью
              return conv;
            }
            const getCleanText = (content) => {
              if (!content || typeof content !== "string") return "";

              let cleaned = content
                .replace(
                  /<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
                  ""
                )
                .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
                .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
                .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");

              cleaned = cleaned.trim().replace(/^<\/div>\s*/i, "");
              cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*/i, "");
              cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*<\/div>\s*/i, "");

              const decoded = cleaned
                .replace(/&amp;/g, "&")    // Декодируем &amp; в & (сначала!)
                .replace(/&lt;/g, "<")      // Декодируем &lt; в <
                .replace(/&gt;/g, ">")      // Декодируем &gt; в >
                .replace(/&quot;/g, '"')    // Декодируем &quot; в "
                .replace(/&#039;/g, "'")    // Декодируем &#039; в '
                .replace(/&#x27;/g, "'");   // Декодируем &#x27; в '

              return decoded.trim();
            };
            const cleanText = getCleanText(newMessage);
            const previewText =
              cleanText.length > 50
                ? cleanText.substring(0, 50) + "..."
                : cleanText;

            return {
              ...conv,
              last_message: previewText,
              // НЕ обновляем updated_at при загрузке сообщений
            };
          }
          return conv;
        })
      );
    },
    []
  );

  // Функции управления счетчиками непрочитанных сообщений
  const incrementUnreadCount = useCallback((conversationId) => {
    setUnreadCounts((prev) => ({
      ...prev,
      [conversationId]: (prev[conversationId] || 0) + 1,
    }));
  }, []);

  const resetUnreadCount = useCallback((conversationId) => {
    setUnreadCounts((prev) => {
      const newCounts = { ...prev };
      delete newCounts[conversationId];
      return newCounts;
    });
  }, []);

  const getUnreadCount = useCallback(
    (conversationId) => {
      // Не показывать бейдж для активного чата
      if (activeConversation?.id === conversationId) return 0;
      return unreadCounts[conversationId] || 0;
    },
    [unreadCounts, activeConversation]
  );

  const loadPinnedChats = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      setPinnedChats([]);
      return;
    }

    try {
      const response = await apiClient.getPinnedChats();
      let pinnedFromServer = Array.isArray(response?.pinned_chats)
        ? response.pinned_chats
        : Array.isArray(response)
          ? response
          : [];

      if (!pinnedFromServer.length) {
        try {
          const legacyStored = localStorage.getItem("pinnedChats");
          if (legacyStored) {
            const parsedLegacy = JSON.parse(legacyStored);
            const legacyIds = Array.isArray(parsedLegacy)
              ? parsedLegacy
                .map((id) => {
                  const numericId = Number(id);
                  return Number.isNaN(numericId) ? null : numericId;
                })
                .filter((id) => id !== null)
              : [];

            if (legacyIds.length) {
              await apiClient.setPinnedChats(legacyIds);
              pinnedFromServer = legacyIds;
            }

            localStorage.removeItem("pinnedChats");
          }
        } catch (legacyError) {
          console.warn("Failed to migrate legacy pinned chats:", legacyError);
        }
      }

      setPinnedChats(pinnedFromServer.map((id) => id.toString()));
    } catch (error) {
      console.error("Failed to load pinned chats from server:", error);
    }
  }, [isAuthenticated, user?.id]);

  // Загрузить системный чат
  const loadSystemChat = useCallback(async () => {
    if (!isAuthenticated || !user?.id) {
      return;
    }

    try {
      // TODO: Implement system chat API when available
      // For now, we'll set systemChat to null to indicate no system chat
      console.log("System chat functionality not yet implemented");
      setSystemChat(null);
    } catch (error) {
      console.error("Failed to load system chat:", error);
      setSystemChat(null);
    }
  }, [isAuthenticated, user?.id]);

  // Загрузить настройки пользователя
  const loadUserSettings = async () => {
    if (!user?.id) return;

    // Пытаемся загрузить с сервера
    try {
      const userData = await apiClient.getCurrentUser();
    } catch (error) {
      console.log("Server load failed, using localStorage:", error);
    }

    // Fallback: загружаем из localStorage если сервер недоступен
    try {
      // localStorage loading logic would go here
    } catch (error) {
      console.error("Failed to load from localStorage:", error);
    }
  };

  // Синхронизируем ref с activeConversation для отслеживания в реальном времени
  useEffect(() => {
    activeConversationRef.current = activeConversation?.id || null;
  }, [activeConversation]);

  // Ref для хранения функции deleteConversation (используется в useEffect после определения)
  const deleteConversationRef = useRef(null);

  // Ref для хранения последнего ID сообщения в активном чате (для polling)
  const lastMessageIdRef = useRef(null);

  // Обновляем ref при изменении сообщений активного чата
  useEffect(() => {
    if (!activeConversation?.id) {
      lastMessageIdRef.current = null;
      return;
    }

    // Не обновляем ref для каналов и системного чата
    if (activeConversation.is_channel || activeConversation.is_system_chat) {
      lastMessageIdRef.current = null;
      return;
    }

    const currentMessages = messagesByConversation[activeConversation.id] || [];
    // Исключаем thinking-сообщения из расчета последнего ID
    const nonThinkingMessages = currentMessages.filter(m => {
      const isThinking = m.is_thinking === true ||
        m.state === "thinking" ||
        String(m.id || '').startsWith('thinking_');
      return !isThinking;
    });
    const newLastMessageId = nonThinkingMessages.length > 0
      ? nonThinkingMessages[nonThinkingMessages.length - 1]?.id
      : null;

    // Обновляем ref только если он изменился
    if (newLastMessageId !== lastMessageIdRef.current) {
      lastMessageIdRef.current = newLastMessageId;
      console.log(`[POLLING] Обновлен последний ID сообщения для чата ${activeConversation.id}: ${newLastMessageId}`);
    }
  }, [activeConversation?.id, activeConversation?.is_channel, activeConversation?.is_system_chat, messagesByConversation]);

  // Ref для хранения интервала polling (для предотвращения множественных интервалов)
  const pollingIntervalRef = useRef(null);
  // Ref для флага, предотвращающего параллельные запросы polling
  const isPollingRef = useRef(false);

  // Polling для проверки новых сообщений в активном чате (для таймеров и напоминаний)
  useEffect(() => {
    // Очищаем предыдущий интервал перед созданием нового
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    if (!activeConversation?.id || !isAuthenticated) {
      return;
    }

    // Не делаем polling для каналов (у них своя логика)
    if (activeConversation.is_channel) {
      return;
    }

    // Не делаем polling для системного чата (он обновляется при отправке сообщений)
    if (activeConversation.is_system_chat) {
      return;
    }

    console.log(`[POLLING] Запущен polling для чата ${activeConversation.id}, последний ID: ${lastMessageIdRef.current}`);

    // Проверяем новые сообщения каждые 5 секунд (увеличено с 2 до 5 для снижения нагрузки)
    pollingIntervalRef.current = setInterval(async () => {
      // Предотвращаем параллельные запросы
      if (isPollingRef.current) {
        console.debug(`[POLLING] Пропускаем запрос - предыдущий еще выполняется`);
        return;
      }

      // Проверяем, что активный чат не изменился
      const currentConversationId = activeConversation?.id;
      if (!currentConversationId) {
        return;
      }

      try {
        isPollingRef.current = true;

        // Определяем тип чата для правильного выбора API
        const isGroupChat = activeConversation?.is_group === true;

        // Загружаем последние сообщения (только для проверки новых)
        const messagesData = await (isGroupChat
          ? apiClient.getGroupChatMessages(currentConversationId, 0, 10000)
          : apiClient.getConversationMessages(currentConversationId, 0, 10000)
        ).catch((error) => {
          // Если разговор не найден (404), останавливаем polling
          if (error?.status === 404 || error?.message?.includes('not found') || error?.errorData?.detail?.includes('not found')) {
            console.log(`[POLLING] Разговор ${currentConversationId} не найден, останавливаем polling`);
            if (pollingIntervalRef.current) {
              clearInterval(pollingIntervalRef.current);
              pollingIntervalRef.current = null;
            }
            isPollingRef.current = false;
            return null;
          }
          // Для других ошибок просто возвращаем null
          return null;
        });

        // Если получили null (ошибка), прекращаем обработку
        if (messagesData === null) {
          isPollingRef.current = false;
          return;
        }

        // Проверяем, что чат все еще активен
        if (activeConversation?.id !== currentConversationId) {
          isPollingRef.current = false;
          return;
        }

        if (messagesData && Array.isArray(messagesData) && messagesData.length > 0) {
          const newLastMessageId = messagesData[messagesData.length - 1]?.id;

          // Если появилось новое сообщение (последнее сообщение изменилось)
          if (newLastMessageId && newLastMessageId !== lastMessageIdRef.current) {
            console.log(`[POLLING] Обнаружено новое сообщение в чате ${currentConversationId} (старый ID: ${lastMessageIdRef.current}, новый ID: ${newLastMessageId}), обновляю...`);

            // Обновляем ref
            lastMessageIdRef.current = newLastMessageId;

            // Обновляем сообщения, добавляя только новые
            updateMessagesForConversation(currentConversationId, (prev) => {
              // Фильтруем временные сообщения пользователя (temp_*), чтобы избежать дублирования
              const filteredPrev = prev.filter(m => {
                // Исключаем временные сообщения, которые начинаются с "temp_"
                return !(typeof m.id === 'string' && m.id.startsWith('temp_'));
              });

              const existingIds = new Set(filteredPrev.map(m => m.id));
              const newMessages = messagesData.filter(m => !existingIds.has(m.id));

              if (newMessages.length > 0) {
                console.log(`[POLLING] Добавлено ${newMessages.length} новых сообщений`);

                // Проверяем, есть ли ответы от агента в новых сообщениях
                const hasAgentResponses = newMessages.some(
                  msg => !msg.is_from_user &&
                    msg.content &&
                    msg.content.trim().length > 0 &&
                    !(msg.is_thinking === true || msg.state === "thinking" || String(msg.id || '').startsWith('thinking_'))
                );

                // Если есть ответы от агента, НЕ сохраняем thinking сообщения
                // Сохраняем локальные thinking сообщения только если нет ответов
                const localThinkingMessages = hasAgentResponses
                  ? []
                  : filteredPrev.filter(
                    (msg) => {
                      const isThinking = msg.is_thinking === true ||
                        msg.state === "thinking" ||
                        String(msg.id || '').startsWith('thinking_');
                      return isThinking;
                    }
                  );

                // Объединяем: существующие (без временных и без thinking) + новые + thinking (только если нет ответов)
                const merged = [
                  ...filteredPrev.filter(m => {
                    const isThinking = m.is_thinking === true ||
                      m.state === "thinking" ||
                      String(m.id || '').startsWith('thinking_');
                    return !isThinking;
                  }),
                  ...newMessages,
                  ...localThinkingMessages
                ];

                // Если есть ответы, дополнительно удаляем все thinking-сообщения
                if (hasAgentResponses) {
                  return merged.filter(m => {
                    const isThinking = m.is_thinking === true ||
                      m.state === "thinking" ||
                      String(m.id || '').startsWith('thinking_');
                    if (isThinking && m.id) {
                      messageStateManager.setReceivedState(m.id);
                    }
                    return !isThinking;
                  }).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
                }

                // Сортируем по времени
                return merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
              }

              return filteredPrev;
            });

            // Обновляем превью
            const lastMessage = messagesData[messagesData.length - 1];
            if (lastMessage?.content) {
              updateConversationPreviewOnly(
                currentConversationId,
                lastMessage.content,
                lastMessage.is_from_user
              );
            }

            // Обновляем sidebar
            triggerUpdate();
          }
        }

        // Сбрасываем флаг polling после успешного выполнения
        isPollingRef.current = false;
      } catch (error) {
        // Обрабатываем ошибки polling
        isPollingRef.current = false;

        // Если разговор не найден (404), останавливаем polling
        if (error?.status === 404 || error?.message?.includes('not found') || error?.errorData?.detail?.includes('not found')) {
          console.log(`[POLLING] Разговор не найден, останавливаем polling`);
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
        // Игнорируем другие ошибки polling (не логируем, чтобы не засорять консоль)
        console.debug(`[POLLING] Ошибка при проверке новых сообщений:`, error);
      } finally {
        isPollingRef.current = false;
      }
    }, 5000); // Проверяем каждые 5 секунд (увеличено для снижения нагрузки)

    return () => {
      console.log(`[POLLING] Остановлен polling для чата ${activeConversation?.id}`);
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
      // НЕ сбрасываем lastMessageIdRef здесь, так как он может использоваться при переключении чатов
    };
  }, [activeConversation?.id, activeConversation?.is_channel, activeConversation?.is_system_chat, isAuthenticated]);

  // Загружаем разговоры только когда пользователь авторизован
  // ВАЖНО: Добавляем зависимость от user?.id, чтобы перезагружать чаты при смене пользователя
  useEffect(() => {
    if (isAuthenticated && user?.id) {
      console.log(`🔄 [ChatsContext] Загрузка чатов для пользователя ID ${user.id} (username: ${user.username})`);
      // Очищаем предыдущие чаты при смене пользователя
      setConversations([]);
      setMessagesByConversation({});
      setActiveConversation(null);
      loadConversations();
      loadUserSettings();
      loadChannels();
      loadPinnedChats();
      loadSystemChat();
    } else if (!isAuthenticated) {
      // Очищаем чаты при выходе
      console.log(`🔄 [ChatsContext] Пользователь не авторизован, очищаем чаты`);
      setConversations([]);
      setMessagesByConversation({});
      setActiveConversation(null);
      setChatReady(false);
      setIsChatLoading(false);
      setHasLoadedConversations(false); // Сбрасываем флаг загрузки
      channelsRef.current = [];
      setChannels([]);
      setChannelsError(null);
      setPinnedChats([]);
    }
  }, [isAuthenticated, user?.id]); // Удалены зависимости от функций, чтобы избежать бесконечного цикла



  // Загрузить все разговорsы
  // Ref для отслеживания процесса загрузки чатов (защита от повторных запросов)
  const loadingConversationsRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  const RATE_LIMIT_DELAY = 60000; // 60 секунд

  const loadConversations = async () => {
    console.log("[ChatsContext] loadConversations called");

    // Защита от повторных одновременных запросов
    if (loadingConversationsRef.current) {
      console.log("[loadConversations] Загрузка уже идет, пропускаем дублирующий запрос");
      return;
    }

    // Защита от слишком частых запросов (rate limiting)
    const now = Date.now();
    if (now - lastLoadTimeRef.current < 2000) { // Минимум 2 секунды между запросами
      console.log("[loadConversations] Слишком частый запрос, пропускаем");
      return;
    }

    try {
      loadingConversationsRef.current = true;
      lastLoadTimeRef.current = now;
      setIsLoading(true);
      setError(null);
      console.log("Loading conversations from server...");

      // Загружаем обычные разговоры
      const conversationsData = await apiClient.getConversations();

      // Загружаем групповые чаты с обработкой ошибок
      console.log(`🔍 [ChatsContext] Запрос групповых чатов для пользователя ID ${user?.id} (username: ${user?.username})`);
      let groupChatsData = [];
      try {
        groupChatsData = await apiClient.getGroupChats();
      } catch (error) {
        // Если ошибка 429, просто используем пустой массив и не блокируем загрузку остальных чатов
        if (error.message?.includes("429") || error.message?.includes("лимит") || error.message?.includes("Too Many Requests")) {
          console.warn("[loadConversations] Rate limit при загрузке групповых чатов, используем пустой массив");
          groupChatsData = [];
          // Увеличиваем задержку для следующего запроса
          lastLoadTimeRef.current = now + RATE_LIMIT_DELAY - 2000;
        } else {
          // Для других ошибок пробрасываем дальше
          throw error;
        }
      }
      console.log(`🔍 [ChatsContext] Получено групповых чатов: ${groupChatsData?.length || 0}`, groupChatsData);

      // КРИТИЧЕСКАЯ ПРОВЕРКА: Фильтруем групповые чаты по user_id на фронтенде для дополнительной защиты
      const currentUserId = user?.id;
      const filteredGroupChats = groupChatsData && Array.isArray(groupChatsData)
        ? groupChatsData.filter((chat) => {
          const chatUserId = chat.user_id;
          // Разрешаем чаты без user_id (на случай задержки/совместимости), иначе сравниваем с текущим пользователем
          const isOwnChat = chatUserId == null || chatUserId === currentUserId || String(chatUserId) === String(currentUserId);
          if (!isOwnChat) {
            console.warn(`🚫 [ChatsContext] ОТФИЛЬТРОВАН чужой чат: ID=${chat.id}, chat.user_id=${chatUserId}, currentUserId=${currentUserId}`);
          }
          return isOwnChat;
        })
        : [];

      console.log(`🔍 [ChatsContext] После фильтрации осталось групповых чатов: ${filteredGroupChats?.length || 0}`);

      // Логируем каждый групповой чат для отладки
      if (filteredGroupChats && Array.isArray(filteredGroupChats)) {
        filteredGroupChats.forEach((chat, index) => {
          console.log(`  ✅ Групповой чат ${index + 1}: ID=${chat.id}, user_id=${chat.user_id}, title='${chat.title}'`);
        });
      }

      // Объединяем и форматируем данные (используем отфильтрованные чаты)
      const formattedGroupChats = filteredGroupChats.map((groupChat) => ({
        id: `group-${groupChat.id}`, // Добавляем префикс для уникальности
        conversation_id: `group-${groupChat.id}`,
        real_id: groupChat.id, // Сохраняем оригинальный числовой ID
        title: groupChat.title,
        agent_id: null,
        agent_name: null,
        is_group: true,
        group_avatar: groupChat.group_avatar || "group", // Сохраняем выбранный аватар
        group_avatar_url: groupChat.group_avatar_url || null, // Сохраняем URL загруженного аватара
        group_agent_ids: groupChat.agents?.map((agent) => agent.id) || [],
        created_at: groupChat.created_at,
        updated_at: groupChat.updated_at, // Добавляем updated_at
        unread_count: groupChat.unread_count || 0, // Добавляем unread_count с backend
      }));

      const allConversations = [...conversationsData, ...formattedGroupChats];

      // Удаляем дубликаты по ID (более строгая проверка)
      const uniqueById = new Map();
      allConversations.forEach((conv) => {
        if (conv && conv.id) {
          if (!uniqueById.has(conv.id)) {
            uniqueById.set(conv.id, conv);
          } else {
            console.warn(`[loadConversations] Duplicate conversation found with ID ${conv.id}, skipping`);
          }
        }
      });

      // Дополнительная проверка: удаляем дубликаты с одинаковым agent_id и очень близким временем создания
      const uniqueConversations = [];
      const agentTimeMap = new Map();

      Array.from(uniqueById.values()).forEach((conv) => {
        // Для обычных чатов проверяем дубликаты по agent_id и времени
        if (conv.agent_id && !conv.is_group && !conv.is_channel) {
          const createdAt = conv.created_at ? new Date(conv.created_at).getTime() : 0;
          const timeKey = Math.floor(createdAt / 60000); // Округляем до минуты для более агрессивной проверки
          const key = `${conv.agent_id}-${timeKey}`;

          if (!agentTimeMap.has(key)) {
            agentTimeMap.set(key, conv);
            uniqueConversations.push(conv);
          } else {
            // Если нашли дубликат, оставляем тот, у которого больше ID (более новый)
            const existing = agentTimeMap.get(key);
            if (conv.id > existing.id) {
              const index = uniqueConversations.indexOf(existing);
              if (index !== -1) {
                uniqueConversations[index] = conv;
                agentTimeMap.set(key, conv);
                console.warn(`[loadConversations] Replaced duplicate chat: old ID=${existing.id}, new ID=${conv.id}`);
              }
            } else {
              // Normal duplicate handling - no need to warn for expected duplicates
              // console.debug(`[loadConversations] Duplicate chat by agent_id and time found, keeping existing: ${existing.id}, skipping: ${conv.id}`);
            }
          }
        } else {
          // Для групп и каналов просто добавляем
          uniqueConversations.push(conv);
        }
      });

      const mergedConversations = mergeChannelsIntoConversations(
        uniqueConversations,
        channelsRef.current,
        { replace: true }
      );

      console.log("Setting conversations:", mergedConversations);
      setConversations(mergedConversations);

      // 📬 СИНХРОНИЗАЦИЯ НЕПРОЧИТАННЫХ С BACKEND:
      // Обновляем локальное состояние непрочитанных из данных с сервера
      const newUnreadCounts = {};
      mergedConversations.forEach(conv => {
        if (conv.unread_count && conv.unread_count > 0) {
          newUnreadCounts[conv.id] = conv.unread_count;
        }
      });

      // 📬 ВАЖНО: Если пользователь находится в чате, сразу сбрасываем его счетчик
      // Это решает проблему с перезагрузкой страницы - непрочитанные не появляются для активного чата
      // КРИТИЧНО: Используем activeConversationRef.current вместо activeConversation?.id,
      // так как ref обновляется синхронно, а состояние - асинхронно
      let activeChatIdToReset = activeConversationRef.current;

      // Если activeConversationRef еще не установлен (например, при первой загрузке),
      // проверяем localStorage - там может быть сохранен последний активный чат
      if (!activeChatIdToReset) {
        try {
          const lastActiveChat = localStorage.getItem('lastActiveChat');
          if (lastActiveChat) {
            activeChatIdToReset = parseInt(lastActiveChat, 10);
          }
        } catch (e) {
          console.error('Failed to read lastActiveChat from localStorage:', e);
        }
      }

      if (activeChatIdToReset && newUnreadCounts[activeChatIdToReset]) {
        delete newUnreadCounts[activeChatIdToReset];

        // Сбрасываем на backend
        const activeConv = mergedConversations.find(c => c.id === activeChatIdToReset);
        const isGroupChat = activeConv?.is_group || false;
        const isChannelChat = activeConv?.is_channel || false;

        if (isChannelChat) {
          apiClient.post(`/channels/${activeChatIdToReset}/mark-as-read`).catch(err =>
            console.error('Failed to mark channel as read on load:', err)
          );
        } else if (isGroupChat) {
          apiClient.post(`/multi-agent-chat/${activeChatIdToReset}/mark-as-read`).catch(err =>
            console.error('Failed to mark group chat as read on load:', err)
          );
        } else {
          apiClient.post(`/conversations/${activeChatIdToReset}/mark-as-read`).catch(err =>
            console.error('Failed to mark conversation as read on load:', err)
          );
        }
      }

      setUnreadCounts(newUnreadCounts);
    } catch (error) {
      console.error("Failed to load conversations:", error);
      // Для ошибок 429 не показываем критическую ошибку, просто логируем
      if (error.message?.includes("429") || error.message?.includes("лимит") || error.message?.includes("Too Many Requests")) {
        console.warn("[loadConversations] Rate limit, но продолжаем работу с существующими данными");
        // Увеличиваем задержку для следующего запроса
        lastLoadTimeRef.current = Date.now() + RATE_LIMIT_DELAY - 2000;
      } else {
        setError(error.message);
      }
    } finally {
      setIsLoading(false);
      setHasLoadedConversations(true); // Отмечаем, что попытка загрузки завершена
      loadingConversationsRef.current = false;
    }
  };



  // Ref для отслеживания активных запросов создания чата (защита от множественных вызовов)
  const creatingChatRef = useRef(new Set());

  // Создать новый чат с агентом
  const createChat = async (agentId, setAsActive = false) => {
    // Защита от множественных одновременных вызовов для одного агента
    if (creatingChatRef.current.has(agentId)) {
      console.warn(`[createChat] Чат для агента ${agentId} уже создается, пропускаем дублирующий запрос`);
      // Ждем завершения существующего запроса (максимум 5 секунд)
      let attempts = 0;
      const maxAttempts = 50; // 50 * 100ms = 5 секунд
      while (creatingChatRef.current.has(agentId) && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      // Если все еще создается, значит что-то пошло не так
      if (creatingChatRef.current.has(agentId)) {
        console.error(`[createChat] Timeout waiting for chat creation for agent ${agentId}`);
        creatingChatRef.current.delete(agentId); // Принудительно сбрасываем
        throw new Error("Превышено время ожидания создания чата. Попробуйте еще раз.");
      }

      // Пытаемся найти созданный чат в списке
      const existingChat = conversations.find(conv => conv.agent_id === agentId && !conv.is_group && !conv.is_channel);
      if (existingChat) {
        console.log(`[createChat] Found existing chat created by parallel request: ${existingChat.id}`);
        return existingChat;
      }
      throw new Error("Не удалось создать чат: запрос был пропущен из-за параллельного создания");
    }

    try {
      creatingChatRef.current.add(agentId);
      setIsLoading(true);
      console.log("Creating chat for agent:", agentId);
      const chatData = await apiClient.createChat(agentId);
      console.log("Chat created:", chatData);

      // Форматируем данные чата для совместимости с форматом conversations
      const formattedChatData = {
        id: chatData.id || chatData.conversation_id,
        conversation_id: chatData.id || chatData.conversation_id,
        title: chatData.title || chatData.agent_name || null, // Не устанавливаем дефолтный заголовок здесь, пусть useChatComputedValues обработает
        agent_id: chatData.agent_id || agentId,
        agent_name: chatData.agent_name || null,
        is_group: false,
        is_channel: false,
        created_at: chatData.created_at || new Date().toISOString(),
        updated_at: chatData.updated_at || chatData.created_at || new Date().toISOString(),
        last_message: null,
        unread_count: 0,
        ...chatData, // Сохраняем все дополнительные поля
      };

      // Проверяем дубликаты ПЕРЕД добавлением в список
      let existingDuplicate = null;
      setConversations((prev) => {
        // Проверяем дубликаты по ID
        const existingChatById = prev.find((conv) => conv.id === formattedChatData.id);
        if (existingChatById) {
          console.log("[createChat] Chat with ID already exists, skipping duplicate:", formattedChatData.id);
          existingDuplicate = existingChatById;
          return prev;
        }

        // Также проверяем дубликаты по agent_id и очень недавнему времени создания (в пределах 2 секунд)
        // Это защищает от случаев, когда чат создается дважды с разными ID из-за ошибок
        const now = new Date().getTime();
        const chatCreatedAt = new Date(formattedChatData.created_at).getTime();
        const timeDiff = Math.abs(now - chatCreatedAt);

        // Ищем недавно созданные чаты с тем же agent_id
        const recentDuplicate = prev.find((conv) => {
          const sameAgent = (conv.agent_id === formattedChatData.agent_id ||
            conv.agent_id === Number(formattedChatData.agent_id));
          if (!sameAgent) return false;

          // Проверяем, что чат был создан очень недавно (в пределах 2 секунд)
          const convCreatedAt = conv.created_at ? new Date(conv.created_at).getTime() : 0;
          const convTimeDiff = Math.abs(now - convCreatedAt);

          // Если оба чата созданы очень недавно (в пределах 2 секунд) и с одним агентом - это дубликат
          return timeDiff < 2000 && convTimeDiff < 2000;
        });

        if (recentDuplicate) {
          console.warn("[createChat] Recent duplicate chat found (same agent, created within 2s), skipping new and returning existing:", {
            existing: recentDuplicate.id,
            new: formattedChatData.id,
            agent_id: formattedChatData.agent_id
          });
          existingDuplicate = recentDuplicate;
          // Возвращаем существующий список без изменений
          return prev;
        }

        const newConversations = [formattedChatData, ...prev];
        console.log("[createChat] Updated conversations:", newConversations.length, "New chat:", formattedChatData);
        return newConversations;
      });

      // Если найден дубликат, возвращаем существующий чат вместо нового
      if (existingDuplicate) {
        console.log("[createChat] Returning existing chat instead of newly created:", existingDuplicate.id);

        // Проверяем, является ли существующий дубликат пустым (без сообщений)
        const existingMessagesCount = messagesByConversation[existingDuplicate.id]?.length ?? 0;
        const existingPinnedCount = pinnedMessages[existingDuplicate.id]?.length ?? 0;
        if (existingMessagesCount === 0 && existingPinnedCount === 0) {
          // Добавляем существующий пустой чат в список для отслеживания
          newlyCreatedEmptyChatsRef.current.add(existingDuplicate.id);
          console.log(`[createChat] Существующий дубликат ${existingDuplicate.id} тоже пустой, добавляем в отслеживание`);
        }

        // Триггерим обновление UI
        triggerUpdate();

        // Устанавливаем как активный чат только если явно запрошено
        if (setAsActive) {
          activeConversationRef.current = existingDuplicate.id;
          setActiveConversation(existingDuplicate);
          // Принудительно подготавливаем состояние, чтобы UI был готов сразу
          updateMessagesForConversation(existingDuplicate.id, []);
          setPinnedMessages((prev) => {
            if (prev[existingDuplicate.id]) {
              return prev;
            }
            return { ...prev, [existingDuplicate.id]: [] };
          });
          setChatReady(true);
          setIsChatLoading(false);
        }

        return existingDuplicate;
      }

      // Триггерим обновление UI сразу, чтобы новый чат сразу отображался в списке
      triggerUpdate();

      // Устанавливаем как активный чат только если явно запрошено
      if (setAsActive) {
        activeConversationRef.current = formattedChatData.id;
        setActiveConversation(formattedChatData);
        // Принудительно подготавливаем состояние, чтобы UI был готов сразу
        updateMessagesForConversation(formattedChatData.id, []);
        setPinnedMessages((prev) => {
          if (prev[formattedChatData.id]) {
            return prev;
          }
          return { ...prev, [formattedChatData.id]: [] };
        });
        setChatReady(true);
        setIsChatLoading(false);
      }

      // Отслеживаем новый пустой чат для автоматического удаления при переключении
      newlyCreatedEmptyChatsRef.current.add(formattedChatData.id);
      console.log(`[createChat] Добавлен новый пустой чат ${formattedChatData.id} в список для отслеживания`);

      return formattedChatData;
    } catch (error) {
      console.error("Failed to create chat:", error);

      // Обработка превышения лимита чатов (403)
      const is403 = error.status === 403 || error.response?.status === 403;
      const isChatLimit = is403 && (
        (error.message && (error.message.includes('лимит') || error.message.includes('чат'))) ||
        (error.response?.detail && typeof error.response.detail === 'string' && (error.response.detail.includes('лимит') || error.response.detail.includes('чат')))
      );
      if (isChatLimit) {
        setShowUpgradeModal(true, "chats_limit");
        throw error;
      }

      // Специальная обработка ошибки 429 (Too Many Requests)
      if (error.status === 429 || error.response?.status === 429 || error.message?.includes('429')) {
        // Пытаемся извлечь retry_after из разных мест ответа
        const retryAfter =
          error.response?.data?.retry_after ||
          error.response?.retry_after ||
          error.response?.headers?.['retry-after'] ||
          error.retryAfter ||
          60;
        const friendlyMessage = `Превышен лимит запросов. Пожалуйста, подождите ${retryAfter} секунд перед повторной попыткой.`;
        const rateLimitError = new Error(friendlyMessage);
        rateLimitError.status = 429;
        rateLimitError.retryAfter = retryAfter;
        throw rateLimitError;
      }

      throw error;
    } finally {
      // Всегда удаляем флаг создания, даже если произошла ошибка или найден дубликат
      creatingChatRef.current.delete(agentId);
      setIsLoading(false);
    }
  };

  // Проверить лимит сообщений
  const checkMessageLimit = async () => {
    if (!user) {
      console.log("checkMessageLimit: No user data");
      return true;
    }

    try {
      // Используем специальный endpoint для проверки лимита
      // Он использует ту же логику, что и при отправке сообщения
      const limitCheck = await apiClient.checkMessageLimit();
      return limitCheck.can_send;
    } catch (error) {
      console.error(
        "checkMessageLimit: Error checking message limit:",
        error
      );
      // В случае ошибки разрешаем отправку (лучше показать ошибку от сервера, чем блокировать)
      return true;
    }
  };

  // Отправить сообщение с мгновенной обратной связью
  const sendMessage = async (
    conversationId,
    agentId,
    message,
    onInputClear
  ) => {
    // КРИТИЧНО: Сохраняем conversationId в замыкании для корректной работы при переключении чатов
    const targetConversationId = conversationId;
    // КРИТИЧНО: Сохраняем ID активного чата В МОМЕНТ ОТПРАВКИ для проверки непрочитанных
    const activeConversationIdAtSend = activeConversation?.id;

    // Находим разговор в списке
    const conversation =
      conversations.find((conv) => conv.id === targetConversationId);

    // Проверяем лимит сообщений ПЕРЕД отправкой
    const canSend = await checkMessageLimit();
    if (!canSend) {
      setShowUpgradeModal(true);
      return;
    }

    // Создаем временное состояние сообщения для мгновенной обратной связи
    const tempMessageId = messageStateManager.createMessageState();

    // Мгновенно добавляем сообщение пользователя в локальное состояние
    const tempUserMessage = {
      id: tempMessageId,
      content: message,
      is_from_user: true,
      created_at: new Date().toISOString(),
      conversation_id: targetConversationId,
      agent_id: agentId,
      state: "sending",
    };

    // Обновляем локальное состояние сообщений для мгновенного отображения
    // КРИТИЧНО: используем targetConversationId из замыкания
    updateMessagesForConversation(targetConversationId, (prev) => [
      ...prev,
      tempUserMessage,
    ]);

    // Убираем чат из списка новых пустых, так как теперь в нем есть сообщение
    if (newlyCreatedEmptyChatsRef.current.has(targetConversationId)) {
      newlyCreatedEmptyChatsRef.current.delete(targetConversationId);
      console.log(`[sendMessage] Чат ${targetConversationId} больше не пустой (отправлено сообщение), убираем из отслеживания`);
      // Триггерим обновление сайдбара, чтобы чат появился в списке
      triggerUpdate();
    }

    // Мгновенно обновляем превью последнего сообщения в списке чатов
    updateConversationPreview(targetConversationId, message, true);

    // Проверяем, является ли чат системным
    const isSystemChat = conversation?.is_system_chat || systemChat?.id === targetConversationId;

    // Если это не системный чат, добавляем thinking сообщение СРАЗУ
    if (!isSystemChat) {
      const thinkingMessage = {
        id: `thinking_${tempMessageId}`,
        content: "",
        is_from_user: false,
        created_at: new Date().toISOString(),
        conversation_id: targetConversationId,
        agent_id: agentId,
        state: "thinking",
        is_thinking: true,
        estimated_duration: 2000 + Math.random() * 2000, // 2-4 секунды
      };

      updateMessagesForConversation(targetConversationId, (prev) => [
        ...prev,
        thinkingMessage,
      ]);

      // Обновляем состояние messageStateManager для thinking
      // КРИТИЧНО: Используем ID thinking сообщения, а не tempMessageId
      messageStateManager.setThinkingState(
        `thinking_${tempMessageId}`,
        thinkingMessage.estimated_duration
      );
    }

    triggerUpdate();

    let response;
    try {
      setIsLoading(true);

      const numericId = typeof targetConversationId === 'string'
        ? targetConversationId.replace(/^(group-|channel-|conv-)/, '')
        : targetConversationId;

      // Для обычных чатов используем стандартный endpoint
      const responsePayload = {
        conversation_id: numericId,
        agent_id: agentId,
        message: message,
        instant_feedback: true,
        metadata: {
          client_timestamp: new Date().toISOString(),
          temp_message_id: tempMessageId,
        },
      };
      response = await apiClient.sendMessage(responsePayload);

      // Обновляем состояние сообщения на "отправлено"
      messageStateManager.setReceivedState(tempMessageId);

      if (!isSystemChat) {

        // Удаляем временное сообщение пользователя ПЕРЕД загрузкой с сервера
        // Это предотвращает дублирование сообщений
        updateMessagesForConversation(targetConversationId, (prev) =>
          prev.filter((m) => m.id !== tempMessageId)
        );

        // Загружаем сообщения с сервера, чтобы получить ответ агента
        await loadMessages(targetConversationId);

        // КРИТИЧНО: После загрузки сообщений убеждаемся, что чат удален из списка новых пустых
        // Это важно, так как после loadMessages состояние messagesByConversation обновляется
        setTimeout(() => {
          const messagesCount = messagesByConversation[targetConversationId]?.length ?? 0;
          if (messagesCount > 0 && newlyCreatedEmptyChatsRef.current.has(targetConversationId)) {
            newlyCreatedEmptyChatsRef.current.delete(targetConversationId);
            console.log(`[sendMessage] После loadMessages: Чат ${targetConversationId} имеет ${messagesCount} сообщений, убираем из отслеживания`);
            triggerUpdate();
          }
        }, 300);

        // КРИТИЧНО: Удаляем ВСЕ thinking сообщения сразу после загрузки ответа
        // Это должно происходить синхронно, чтобы избежать повторного появления индикатора
        updateMessagesForConversation(targetConversationId, (prev) => {
          // Проверяем, есть ли ответы от агента (не от пользователя и не thinking)
          const hasAgentResponses = prev.some(
            msg => !msg.is_from_user &&
              msg.content &&
              msg.content.trim().length > 0 &&
              !(msg.is_thinking === true || msg.state === "thinking" || String(msg.id || '').startsWith('thinking_'))
          );

          // Если есть ответы, удаляем ВСЕ thinking сообщения без исключений
          if (hasAgentResponses) {
            const filtered = prev.filter((m) => {
              const isThinking = m.is_thinking === true ||
                m.state === "thinking" ||
                String(m.id || '').startsWith('thinking_');
              if (isThinking && m.id) {
                // Обновляем состояние перед удалением
                messageStateManager.setReceivedState(m.id);
              }
              return !isThinking;
            });
            return filtered;
          }

          // Если ответов еще нет, удаляем только thinking сообщения для этого tempMessageId
          return prev.filter((m) => {
            const isThinkingForThisMessage =
              m.id === `thinking_${tempMessageId}` ||
              ((m.is_thinking === true || m.state === "thinking") &&
                m.id &&
                String(m.id).includes(String(tempMessageId)));

            if (isThinkingForThisMessage && m.id) {
              messageStateManager.setReceivedState(m.id);
              return false;
            }
            return true;
          });
        });

        // Дополнительная проверка: если есть ответы, еще раз удаляем все thinking-сообщения
        // Это защита от повторных вызовов loadMessages
        updateMessagesForConversation(targetConversationId, (prev) => {
          const hasAgentResponses = prev.some(
            msg => !msg.is_from_user &&
              msg.content &&
              msg.content.trim().length > 0 &&
              !(msg.is_thinking === true || msg.state === "thinking" || String(msg.id || '').startsWith('thinking_'))
          );

          if (hasAgentResponses) {
            return prev.filter((m) => {
              const isThinking = m.is_thinking === true ||
                m.state === "thinking" ||
                String(m.id || '').startsWith('thinking_');
              return !isThinking;
            });
          }

          return prev;
        });

        // 📬 ЛОГИКА НЕПРОЧИТАННЫХ СООБЩЕНИЙ:
        // Backend автоматически увеличивает счетчик после генерации ответа AI
        // НЕ увеличиваем счетчик локально - полагаемся на синхронизацию с backend
        // Это позволяет корректно отображать количество ответов агентов (в групповых чатах может быть несколько)

        // 📬 КРИТИЧНО: Перезагружаем список чатов ПОСЛЕ получения ответа агента
        // чтобы синхронизировать счетчики непрочитанных сообщений
        // Если пользователь переключился на другой чат, счетчик должен появиться
        setTimeout(async () => {
          await loadConversations();
          // Также перезагружаем системный чат для синхронизации updated_at
          await loadSystemChat();
        }, 500); // Небольшая задержка для завершения всех операций
      } else {
        // Для системного чата НЕ вызываем loadMessages, чтобы избежать двойного перерендеринга
        // Обновляем состояние сообщения на "отправлено" только один раз
        messageStateManager.setReceivedState(tempMessageId);

        // Обновляем временное сообщение на реальное из ответа сервера
        if (response && response.message_id) {
          // Используем функциональное обновление для предотвращения лишних перерендеров
          updateMessagesForConversation(targetConversationId, (prev) => {
            const updatedMessages = prev.map((msg) => {
              if (msg.id === tempMessageId) {
                return {
                  ...msg,
                  id: response.message_id,
                  state: "sent",
                };
              }
              return msg;
            });

            // Проверяем, действительно ли произошли изменения
            const hasChanges = updatedMessages.some(
              (msg, index) =>
                msg.id !== prev[index].id || msg.state !== prev[index].state
            );

            return hasChanges ? updatedMessages : prev;
          });
        }

        // Для системного чата обновляем UI напрямую без вызова loadMessages
        // Это предотвращает полный перерендер чата
        if (response && response.message_id) {
          // Обновляем сообщение с реальным ID от сервера
          updateMessagesForConversation(targetConversationId, (prev) => {
            return prev.map(msg =>
              msg.id === tempMessageId
                ? { ...msg, id: response.message_id, temp_message_id: null }
                : msg
            );
          });

          // Обновляем системный чат в списке conversations
          setConversations(prev => {
            return prev.map(conv =>
              conv.id === targetConversationId
                ? { ...conv, updated_at: new Date().toISOString() }
                : conv
            );
          });
        }
      }

      // Обновляем данные пользователя для актуализации счетчика сообщений
      try {
        await refreshUserData();
      } catch (error) {
        console.error("Failed to refresh user data after message send:", error);
      }

      // 📬 ПРИМЕЧАНИЕ: Перезагрузка списка чатов для синхронизации счетчиков
      // теперь происходит ПОСЛЕ получения ответа агента (см. выше, после loadMessages)
      // Это гарантирует, что счетчики обновятся после того, как backend увеличит их

      return response;
    } catch (error) {
      // Проверяем, является ли это ошибкой лимита сообщений (429)
      const isMessageLimitError =
        error.status === 429 ||
        error.message?.includes("Message limit exceeded") ||
        error.message?.includes("limit exceeded");

      if (isMessageLimitError) {
        // Для ошибки лимита показываем модальное окно вместо логирования
        setShowUpgradeModal(true);

        // Удаляем временное сообщение из локального состояния
        updateMessagesForConversation(targetConversationId, (prev) =>
          prev.filter((msg) => msg.id !== tempMessageId)
        );

        // Удаляем thinking сообщение если есть
        if (!isSystemChat) {
          updateMessagesForConversation(targetConversationId, (prev) =>
            prev.filter((msg) => msg.id !== `thinking_${tempMessageId}`)
          );
        }

        // Восстанавливаем текст в поле ввода
        if (onInputClear && typeof onInputClear === "function") {
          onInputClear(message);
        }

        // Не пробрасываем ошибку дальше, так как модальное окно уже показано
        return;
      }

      // Для других ошибок логируем как обычно
      console.error("=== SEND MESSAGE ERROR ===");
      console.error("Error details:", error);
      console.error("Error message:", error.message);
      console.error("isSystemChat:", isSystemChat);
      console.error("conversationId:", targetConversationId);
      console.error("agentId:", agentId);

      // Устанавливаем состояние ошибки для временного сообщения
      messageStateManager.setErrorState(tempMessageId, error.message);

      // Удаляем временное сообщение из локального состояния
      // КРИТИЧНО: используем targetConversationId из замыкания
      updateMessagesForConversation(targetConversationId, (prev) =>
        prev.filter((msg) => msg.id !== tempMessageId)
      );

      // Восстанавливаем текст в поле ввода при ошибке
      if (onInputClear && typeof onInputClear === "function") {
        onInputClear(message);
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const publishChannelMessage = useCallback(
    async (channelId, content) => {
      try {
        setIsLoading(true);
        const message = await apiClient.publishChannelMessage(
          channelId,
          content
        );

        if (message) {
          updateMessagesForConversation(channelId, (prev) => [
            ...(prev || []),
            message,
          ]);
          updateConversationPreview(channelId, message.content, true);
          triggerUpdate();

          // 📬 Перезагружаем список чатов и каналов для синхронизации счетчиков непрочитанных
          // После публикации сообщения счетчик увеличивается для всех подписчиков
          setTimeout(async () => {
            await loadChannels(); // Сначала обновляем каналы с актуальным unread_count
            await loadConversations(); // Затем обновляем conversations с обновленными каналами
            await loadSystemChat();
          }, 500);
        }

        return message;
      } catch (error) {
        console.error("Failed to publish channel message:", error);
        setError(error.message || "Не удалось опубликовать сообщение");
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [updateMessagesForConversation, updateConversationPreview, triggerUpdate, loadChannels, loadConversations, loadSystemChat]
  );

  // Обработка завершения состояния "думает"
  const handleThinkingComplete = useCallback(
    (messageId, aiResponse) => {
      // КРИТИЧНО: Получаем conversationId из aiResponse
      const conversationId = aiResponse?.conversation_id;

      if (!conversationId) {
        console.error(
          "handleThinkingComplete: conversationId not found in aiResponse"
        );
        return;
      }

      // Удаляем индикатор "думает" из локального состояния
      updateMessagesForConversation(conversationId, (prev) =>
        prev.filter((msg) => msg.id !== `thinking_${messageId}`)
      );

      // Обновляем состояние сообщения на "получено"
      messageStateManager.setReceivedState(messageId);

      // Если есть ответ ИИ, добавляем его в сообщения
      if (aiResponse) {
        const aiMessage = {
          id: aiResponse.id || `ai_${Date.now()}`,
          content: aiResponse.content,
          is_from_user: false,
          created_at: aiResponse.created_at || new Date().toISOString(),
          conversation_id: aiResponse.conversation_id,
          agent_id: aiResponse.agent_id,
          state: "received",
        };

        updateMessagesForConversation(conversationId, (prev) => [
          ...prev,
          aiMessage,
        ]);
      }
    },
    [messageStateManager, updateMessagesForConversation]
  );

  // Обработка ошибки состояния "думает"
  const handleThinkingError = useCallback(
    (messageId, error, conversationId) => {
      if (!conversationId) {
        console.error("handleThinkingError: conversationId not provided");
        return;
      }

      // Удаляем индикатор "думает" из локального состояния
      updateMessagesForConversation(conversationId, (prev) =>
        prev.filter((msg) => msg.id !== `thinking_${messageId}`)
      );

      // Устанавливаем состояние ошибки
      messageStateManager.setErrorState(
        messageId,
        error.message || "Ошибка обработки ИИ"
      );
    },
    [messageStateManager, updateMessagesForConversation]
  );

  // УДАЛЕНО: debouncedUpdateMessages и debouncedUpdateConversations
  // Больше не нужны, так как updateMessagesForConversation управляет обновлениями

  // MOCK-функция для симуляции получения сообщения в неактивном чате
  // Используется только для демонстрации работы непрочитанных сообщений
  const simulateIncomingMessage = useCallback(
    (conversationId, agentId, messageContent) => {
      // Определяем тип чата
      const conversation = conversations.find((c) => c.id === conversationId);
      const isChannel = conversation?.is_channel === true;
      const isGroupChat = conversation?.is_group === true;

      // Создаем mock-сообщение от AI
      const mockAiMessage = {
        id: `mock_${Date.now()}`,
        content: messageContent,
        is_from_user: false,
        created_at: new Date().toISOString(),
        conversation_id: conversationId,
        agent_id: agentId,
        state: "received",
      };

      // Добавляем сообщение в чат
      updateMessagesForConversation(conversationId, (prev) => [
        ...prev,
        mockAiMessage,
      ]);

      // Обновляем превью в списке чатов
      updateConversationPreview(conversationId, messageContent, false);

      // 📬 Если чат неактивен, увеличиваем счетчик непрочитанных
      // Работает для обычных чатов, групповых чатов и каналов
      if (activeConversation?.id !== conversationId) {
        incrementUnreadCount(conversationId);
        const chatType = isChannel ? "канала" : isGroupChat ? "группового чата" : "чата";
        console.log(
          `[MOCK] Увеличен счетчик непрочитанных для ${chatType} ${conversationId}`
        );
      }

      // Обновляем sidebar
      triggerUpdate();
    },
    [
      activeConversation,
      conversations,
      incrementUnreadCount,
      updateMessagesForConversation,
      updateConversationPreview,
      triggerUpdate,
    ]
  );

  // Загрузить сообщения разговора
  const loadMessages = useCallback(
    async (conversationId, { offset = 0, maxChars = 10000, isOlderLoad = false, beforeDate = null } = {}) => {
      console.log("[ChatsContext] loadMessages called with conversationId:", conversationId, "offset:", offset, "isOlderLoad:", isOlderLoad);

      try {
        setIsLoading(true);

        const numericId = typeof conversationId === 'string'
          ? conversationId.replace(/^(group-|channel-|conv-)/, '')
          : conversationId;

        // Для обычных чатов используем стандартный метод
        let messagesData;
        messagesData = await apiClient.getConversationMessages(numericId, offset, maxChars, beforeDate);

        console.log("[ChatsContext] loadMessages received messagesData:", messagesData?.length || 0, "messages");

        // Для системного чата используем упрощенную логику без слияния
        const isSystemChat =
          activeConversation?.is_system_chat ||
          systemChat?.id === conversationId;

        if (isSystemChat) {
          // Для системного чата: при первой загрузке заменяем, при подгрузке старых - добавляем
          if (isOlderLoad) {
            // При подгрузке старых сообщений добавляем их в начало
            updateMessagesForConversation(conversationId, (prev) => {
              // Проверяем, нет ли дубликатов
              const existingIds = new Set(prev.map(m => m.id));
              const newMessages = (messagesData || []).filter(m => !existingIds.has(m.id));
              return [...newMessages, ...prev];
            });
          } else {
            // При первой загрузке просто заменяем сообщения
            updateMessagesForConversation(conversationId, messagesData);
          }
        } else {
          // ПРОСТАЯ ЛОГИКА: Загружаем серверные данные
          if (isOlderLoad) {
            // При подгрузке старых сообщений добавляем их в начало
            updateMessagesForConversation(conversationId, (prev) => {
              // Проверяем, нет ли дубликатов
              const existingIds = new Set(prev.map(m => m.id));
              const newMessages = (messagesData || []).filter(m => !existingIds.has(m.id));

              if (newMessages.length === 0) {
                console.warn(`[loadMessages] Нет новых сообщений для добавления (все дубликаты или пустой ответ)`);
                return prev; // Возвращаем без изменений, если нет новых сообщений
              }

              console.log(`[loadMessages] Добавляем ${newMessages.length} новых старых сообщений к ${prev.length} существующим`);

              // Проверяем, есть ли ответы от агента в новых сообщениях
              const hasAgentResponses = newMessages.some(
                msg => !msg.is_from_user && msg.content && msg.content.trim().length > 0
              );

              // Если есть ответы от агента, НЕ сохраняем thinking сообщения
              // Фильтруем локальные thinking сообщения (если они есть)
              const localThinkingMessages = hasAgentResponses
                ? []
                : prev.filter(
                  (msg) => {
                    const isThinking = msg.is_thinking === true ||
                      msg.state === "thinking" ||
                      String(msg.id || '').startsWith('thinking_');
                    return isThinking;
                  }
                );

              // Объединяем: новые старые сообщения + существующие (без thinking) + thinking (только если нет ответов)
              const mergedMessages = [...newMessages, ...prev.filter(m => {
                const isThinking = m.is_thinking === true ||
                  m.state === "thinking" ||
                  String(m.id || '').startsWith('thinking_');
                return !isThinking;
              }), ...localThinkingMessages];

              // КРИТИЧНО: Thinking сообщения всегда должны быть в КОНЦЕ списка
              const sortedMessages = mergedMessages.sort((a, b) => {
                const aIsThinking =
                  a.is_thinking === true || a.state === "thinking";
                const bIsThinking =
                  b.is_thinking === true || b.state === "thinking";

                if (aIsThinking === bIsThinking) {
                  return new Date(a.created_at) - new Date(b.created_at);
                }

                return aIsThinking ? 1 : -1;
              });

              // Проверяем, что первое сообщение действительно изменилось
              const newFirstMessage = sortedMessages[0];
              const oldFirstMessage = prev[0];
              if (oldFirstMessage && newFirstMessage && newFirstMessage.id === oldFirstMessage.id) {
                console.warn(`[loadMessages] ПРЕДУПРЕЖДЕНИЕ: Первое сообщение не изменилось после подгрузки! Возможно, бэкенд вернул те же сообщения.`);
              }

              return sortedMessages;
            });
          } else {
            // При первой загрузке
            const filteredServerMessages = (messagesData || []).filter(msg => {
              // Исключаем временные сообщения, которые начинаются с "temp_"
              return !(typeof msg.id === 'string' && msg.id.startsWith('temp_'));
            });

            console.log(
              `[loadMessages] Первая загрузка для чата ${conversationId}: ` +
              `получено ${messagesData?.length || 0} сообщений, ` +
              `отфильтровано ${filteredServerMessages.length}, ` +
              `предыдущих в состоянии: ${messagesByConversation[conversationId]?.length || 0}`
            );

            updateMessagesForConversation(conversationId, (prevMessages) => {
              // КРИТИЧНО: Если есть ответы от агента в загруженных сообщениях, удаляем thinking сообщения
              // Проверяем, есть ли ответы от агента в загруженных сообщениях
              const hasAgentResponses = filteredServerMessages.some(
                msg => !msg.is_from_user && msg.content && msg.content.trim().length > 0
              );

              // Если есть ответы от агента, НЕ сохраняем thinking сообщения
              // Фильтруем локальные thinking сообщения (если они есть)
              // Удаляем ВСЕ thinking сообщения, включая те, что начинаются с 'thinking_'
              const localThinkingMessages = hasAgentResponses
                ? []
                : prevMessages.filter(
                  (msg) => {
                    const isThinking = msg.is_thinking === true ||
                      msg.state === "thinking" ||
                      String(msg.id).startsWith('thinking_');
                    return isThinking;
                  }
                );

              // Объединяем серверные сообщения с локальными thinking (только если нет ответов)
              // Также фильтруем thinking сообщения из серверных данных на всякий случай
              const filteredServerWithoutThinking = filteredServerMessages.filter(
                msg => !(msg.is_thinking === true || msg.state === "thinking" || String(msg.id).startsWith('thinking_'))
              );
              const mergedMessages = [...filteredServerWithoutThinking, ...localThinkingMessages];

              // КРИТИЧНО: Thinking сообщения всегда должны быть в КОНЦЕ списка
              // Сортируем так, чтобы thinking сообщения всегда были последними
              const sortedMessages = mergedMessages.sort((a, b) => {
                const aIsThinking =
                  a.is_thinking === true || a.state === "thinking";
                const bIsThinking =
                  b.is_thinking === true || b.state === "thinking";

                // Если оба или ни один не думает, сортируем по времени
                if (aIsThinking === bIsThinking) {
                  return new Date(a.created_at) - new Date(b.created_at);
                }

                // Thinking сообщения всегда в конце
                return aIsThinking ? 1 : -1;
              });

              // Если есть ответы от агента, удаляем ВСЕ thinking сообщения
              if (hasAgentResponses) {
                const beforeFilter = sortedMessages.length;
                const filtered = sortedMessages.filter((m) => {
                  const isThinking = m.is_thinking === true ||
                    m.state === "thinking" ||
                    String(m.id || '').startsWith('thinking_');
                  if (isThinking && m.id) {
                    messageStateManager.setReceivedState(m.id);
                  }
                  return !isThinking;
                });
                // КРИТИЧНО: Возвращаем отфильтрованные сообщения без thinking
                console.log(
                  `[loadMessages] Отфильтровано thinking сообщений: ${beforeFilter} -> ${filtered.length} для чата ${conversationId}`
                );
                return filtered;
              }

              const finalCount = sortedMessages.length;
              console.log(
                `[loadMessages] Финальное количество сообщений для чата ${conversationId}: ${finalCount}`
              );
              return sortedMessages;
            });

            // Проверяем результат обновления через небольшую задержку
            // Используем функциональное обновление для получения актуального состояния
            setTimeout(() => {
              setMessagesByConversation((current) => {
                const finalMessagesCount = current[conversationId]?.length ?? 0;
                if (finalMessagesCount > 0) {
                  console.log(
                    `✅ [loadMessages] Сообщения успешно сохранены для чата ${conversationId}: ${finalMessagesCount} сообщений`
                  );
                } else {
                  console.warn(
                    `⚠️ [loadMessages] ПРОБЛЕМА: Сообщения не сохранились для чата ${conversationId} после updateMessagesForConversation. ` +
                    `Ожидалось: ${filteredServerMessages.length}, но в состоянии: 0`
                  );
                }
                return current; // Возвращаем без изменений, только для проверки
              });
            }, 200);
          }
        }

        // Обновляем превью последнего сообщения после загрузки с сервера
        if (messagesData && messagesData.length > 0 && !isOlderLoad) {
          const lastMessage = messagesData[messagesData.length - 1];
          if (lastMessage && lastMessage.content) {
            updateConversationPreviewOnly(
              conversationId,
              lastMessage.content,
              lastMessage.is_from_user
            );
          }
        }
      } catch (error) {
        // Если ошибка авторизации, принудительно выходим
        if (error.message === "Unauthorized") {
          setError("Сессия истекла. Пожалуйста, войдите снова.");
          forceLogout();
        } else {
          setError(error.message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [
      forceLogout,
      activeConversation,
      systemChat,
      conversations,
      updateMessagesForConversation,
      updateConversationPreviewOnly,
    ]
  );

  const loadChannelMessages = useCallback(
    async (channelId, { offset = 0, maxChars = 10000, lastN = true, beforeDate = null } = {}) => {
      try {
        setIsLoading(true);
        const numericId = typeof channelId === 'string'
          ? channelId.replace(/^(group-|channel-|conv-)/, '')
          : channelId;

        const messagesData = await apiClient.getChannelMessages(
          numericId,
          offset,
          maxChars,
          lastN,
          beforeDate
        );

        if (lastN) {
          // При загрузке последних N сообщений заменяем все сообщения
          updateMessagesForConversation(channelId, messagesData || []);
        } else {
          // При подгрузке старых сообщений добавляем их в начало
          updateMessagesForConversation(channelId, (prev) => {
            // Проверяем, нет ли дубликатов
            const existingIds = new Set(prev.map(m => m.id));
            const newMessages = (messagesData || []).filter(m => !existingIds.has(m.id));
            return [...newMessages, ...prev];
          });
        }

        if (messagesData && messagesData.length > 0) {
          const lastMessage = messagesData[messagesData.length - 1];
          if (lastMessage?.content) {
            updateConversationPreviewOnly(
              channelId,
              lastMessage.content,
              lastMessage.is_from_user
            );
          }
        }
      } catch (error) {
        console.error("Failed to load channel messages:", error);
        setError(error.message);
      } finally {
        setIsLoading(false);
      }
    },
    [updateMessagesForConversation, updateConversationPreviewOnly, forceLogout]
  );


  // Функция для подгрузки старых сообщений канала при скролле вверх
  // Подгружает по 10000 символов за раз, может вызываться многократно
  const loadOlderChannelMessages = useCallback(
    async (channelId, { maxChars = 10000 } = {}) => {
      try {
        // Получаем текущие сообщения
        const currentMessages = messagesByConversation[channelId] || [];

        // Находим самое старое загруженное сообщение (первое в списке)
        const oldestMessage = currentMessages.length > 0 ? currentMessages[0] : null;
        const beforeDate = oldestMessage?.created_at || null;

        // Для каналов используем offset как fallback, но лучше использовать beforeDate
        const offset = beforeDate ? 0 : currentMessages.length;

        console.log(`[loadOlderChannelMessages] Подгружаем старые сообщения канала ${channelId}, beforeDate=${beforeDate}, offset=${offset}, maxChars=${maxChars}`);

        // Подгружаем старые сообщения с лимитом 10000 символов (lastN=false для использования offset/beforeDate)
        // Может вызываться многократно, пока не закончатся все сообщения
        await loadChannelMessages(channelId, { offset, maxChars: 10000, lastN: false, beforeDate });
      } catch (error) {
        console.error("Failed to load older channel messages:", error);
        setError(error.message);
      }
    },
    [messagesByConversation, loadChannelMessages]
  );


  // Выбрать разговор
  // Ref для хранения предыдущего активного чата
  const prevActiveConversationIdRef = useRef(null);

  // Ref для отслеживания активных запросов выбора чата (защита от множественных вызовов)
  const selectingConversationRef = useRef(new Set());
  const lastSelectTimeRef = useRef({}); // Отслеживание времени последнего выбора для каждого чата

  // Ref для отслеживания достижения конца истории сообщений
  const reachedHistoryEndRef = useRef({});

  const selectConversation = async (conversationId) => {
    console.log("[ChatsContext] selectConversation called with conversationId:", conversationId);
    console.log("[ChatsContext] activeConversationRef.current:", activeConversationRef.current);
    console.log("[ChatsContext] Current conversations:", conversations.map(c => ({ id: c.id, title: c.title })));

    const conversationIdStr = String(conversationId);
    // КРИТИЧНО: Проверяем ref ПЕРВЫМ, так как он обновляется синхронно
    // (в отличие от state, который обновляется асинхронно)
    // Это особенно важно для createChat/createGroupChat, которые устанавливают ref перед вызовом onChatSelect
    if (String(activeConversationRef.current) === conversationIdStr) {
      console.log(`✅ Чат ${conversationId} уже активен (проверка ref), пропускаем перерендер`);
      return;
    }

    // Проверяем, не выбран ли уже этот чат через state (предотвращаем перерендер)
    if (activeConversation && String(activeConversation.id) === conversationIdStr) {
      console.log(`✅ Чат ${conversationId} уже активен (проверка state), пропускаем перерендер`);
      return;
    }

    // Защита от множественных одновременных вызовов для одного чата
    if (selectingConversationRef.current.has(conversationIdStr)) {
      console.log(`[selectConversation] Чат ${conversationId} уже выбирается, пропускаем дублирующий запрос`);
      return;
    }

    // Защита от слишком частых запросов для одного чата (минимум 150ms — баланс между плавностью и защитой от спама)
    const now = Date.now();
    const lastSelectTime = lastSelectTimeRef.current[conversationIdStr] || 0;
    if (now - lastSelectTime < 150) {
      console.log(`[selectConversation] Слишком частый запрос для чата ${conversationId}, пропускаем`);
      return;
    }

    // Отмечаем, что начинаем выбор этого чата
    selectingConversationRef.current.add(conversationIdStr);
    lastSelectTimeRef.current[conversationIdStr] = now;

    // 🗑️ АВТОМАТИЧЕСКОЕ УДАЛЕНИЕ ПУСТЫХ ЧАТОВ:
    // Если переключаемся с пустого нового чата на другой - удаляем предыдущий пустой чат
    const previousConversationId = activeConversation?.id;
    if (previousConversationId && previousConversationId !== conversationId) {
      const isNewEmptyChat = newlyCreatedEmptyChatsRef.current.has(previousConversationId);
      if (isNewEmptyChat) {
        // Проверяем, действительно ли чат пустой
        const messagesCount = messagesByConversation[previousConversationId]?.length ?? 0;
        const pinnedCount = pinnedMessages[previousConversationId]?.length ?? 0;

        if (messagesCount === 0 && pinnedCount === 0) {
          console.log(`[selectConversation] Автоматически удаляем пустой новый чат ${previousConversationId}`);
          try {
            // Удаляем чат асинхронно, не блокируя переключение
            deleteConversation(previousConversationId).catch(error => {
              console.error(`[selectConversation] Ошибка при удалении пустого чата ${previousConversationId}:`, error);
            });
          } catch (error) {
            console.error(`[selectConversation] Ошибка при удалении пустого чата ${previousConversationId}:`, error);
          }
        } else {
          // Если в чате появились сообщения, убираем его из списка новых пустых
          newlyCreatedEmptyChatsRef.current.delete(previousConversationId);
          console.log(`[selectConversation] Чат ${previousConversationId} больше не пустой, убираем из отслеживания`);
        }
      }
    }

    // 📬 ВАЖНО: НЕ сбрасываем счетчик для предыдущего чата при переключении
    // Счетчик должен сбрасываться только при ОТКРЫТИИ чата (когда он становится активным)
    // Это позволяет показывать бейджи для чатов, из которых пользователь вышел
    // Например: пользователь отправил сообщение в чат A, переключился на чат B,
    // агент ответил в чат A - должен появиться бейдж на чате A

    // КРИТИЧНО: Обновляем activeConversationRef.current СРАЗУ при переключении,
    // чтобы при следующей загрузке списка чатов использовался правильный активный чат
    activeConversationRef.current = conversationIdStr;
    prevActiveConversationIdRef.current = conversationIdStr;

    // 📬 Сохраняем текущий активный чат в localStorage для корректной работы при перезагрузке
    try {
      localStorage.setItem('lastActiveChat', conversationId.toString());
    } catch (e) {
      console.error('Failed to save lastActiveChat to localStorage:', e);
    }

    // КРИТИЧНО: Проверяем, является ли чат новым пустым ДО сброса chatReady
    // Если чат новый и пустой, не сбрасываем chatReady (он уже установлен в createChat)
    const cachedMessagesCount = messagesByConversation[conversationId]?.length ?? 0;
    const cachedPinnedCount = pinnedMessages[conversationId]?.length ?? 0;
    const isNewEmptyChat = cachedMessagesCount === 0 && cachedPinnedCount === 0;
    const hasCachedData = cachedMessagesCount > 0 && pinnedMessages[conversationId] !== undefined;

    // Устанавливаем состояние загрузки только если нужна загрузка (избегаем мигания при переключении между кэшированными чатами)
    if (!hasCachedData && !isNewEmptyChat) {
      setIsChatLoading(true);
      setChatReady(false);
    }

    try {
      // ЛОГИКА НЕПРОЧИТАННЫХ СООБЩЕНИЙ:
      // Сбрасываем счетчик непрочитанных локально
      resetUnreadCount(conversationId);

      // Сбрасываем счетчик на backend (асинхронно, не блокируем UI)
      // Определяем тип чата для правильного API endpoint
      const targetConversationEntry = conversations.find(c => String(c.id) === String(conversationId));
      const isGroupChat = targetConversationEntry?.is_group || (typeof conversationId === 'string' && conversationId.startsWith('group-'));
      const isChannelChat =
        targetConversationEntry?.is_channel ||
        (typeof conversationId === 'string' && conversationId.startsWith('channel-')) ||
        channelsRef.current.some((channel) => String(channel.id) === String(conversationId));

      // Получаем чистый ID для API
      const numericId = typeof conversationId === 'string'
        ? conversationId.replace(/^(group-|channel-|conv-)/, '')
        : conversationId;

      if (isChannelChat) {
        // Для каналов используем специальный endpoint
        apiClient
          .post(`/channels/${numericId}/mark-as-read`)
          .catch((err) =>
            console.error("Failed to mark channel as read:", err)
          );
      } else if (isGroupChat) {
        apiClient
          .post(`/multi-agent-chat/${numericId}/mark-as-read`)
          .catch((err) =>
            console.error("Failed to mark group chat as read:", err)
          );
      } else {
        apiClient
          .post(`/conversations/${numericId}/mark-as-read`)
          .catch((err) =>
            console.error("Failed to mark conversation as read:", err)
          );
      }

      // Проверяем, не системный ли это чат
      if (systemChat && systemChat.id === conversationId) {
        setActiveConversation(systemChat);

        // КРИТИЧНО: Если сообщения для системного чата еще не загружены, показываем пустой массив
        if (!messagesByConversation[conversationId]) {
          updateMessagesForConversation(conversationId, []);
        }

        // Проверяем, загружены ли уже данные системного чата (кэш)
        const hasCachedMessages = messagesByConversation[conversationId]?.length > 0;
        const hasCachedPinned = pinnedMessages[conversationId]?.length !== undefined;

        if (hasCachedMessages && hasCachedPinned) {
          // Данные уже загружены, чат готов сразу
          console.log(`✅ [Chat Load] Системный чат ${conversationId} уже загружен из кэша, готов к отображению`);
          setChatReady(true);
          setIsChatLoading(false);
        } else {
          // ПОСЛЕДОВАТЕЛЬНАЯ ЗАГРУЗКА: закрепленные -> история
          console.log(`🔄 [Chat Load] Шаг 1/2: Загрузка закрепленных сообщений для системного чата ${conversationId}`);
          await loadPinnedMessages(conversationId);

          console.log(`🔄 [Chat Load] Шаг 2/2: Загрузка истории сообщений для системного чата ${conversationId}`);
          await loadMessages(conversationId);

          // Чат готов к рендерингу
          console.log(`✅ [Chat Load] Системный чат ${conversationId} готов к отображению`);
          setChatReady(true);
          setIsChatLoading(false);
        }
        return;
      }

      // Сначала пытаемся найти разговор в локальном списке
      let localConversation = conversations.find(
        (conv) => String(conv.id) === String(conversationId)
      );
      console.log(`[selectConversation] Looking for conversation ${conversationId}:`, {
        foundLocally: !!localConversation,
        localConversation: localConversation ? { id: localConversation.id, is_group: localConversation.is_group, group_agent_ids: localConversation.group_agent_ids } : null,
        totalConversations: conversations.length
      });

      // Если не найден локально, пытаемся загрузить с сервера
      if (!localConversation) {
        try {
          // Если ID содержит префикс group-, сразу пробуем загрузить групповой чат
          if (typeof conversationId === 'string' && conversationId.startsWith('group-')) {
            // Извлекаем чистый ID для API (убираем префикс group-)
            const numericId = conversationId.replace(/^(group-|channel-|conv-)/, '');
            const groupConversation = await apiClient.getGroupChat(numericId);
            // Извлекаем ID агентов из списка agents
            const groupAgentIds = groupConversation.agents?.map(a => a.agent_id || a.id) || [];
            console.log(`[selectConversation] Loaded group chat from server:`, {
              conversationId,
              numericId,
              agents: groupConversation.agents,
              groupAgentIds
            });
            localConversation = {
              ...groupConversation,
              id: conversationId, // Сохраняем оригинальный ID с префиксом
              is_group: true,
              group_avatar: groupConversation.group_avatar || "group",
              group_avatar_url: groupConversation.group_avatar_url || null,
              group_agent_ids: groupAgentIds, // Сохраняем ID агентов для совместимости
            };
          } else {
            const conversation = await apiClient.getConversation(conversationId);
            // КРИТИЧНО: Если это канал, форматируем его через formatChannel для правильной установки isSubscribed
            if (conversation && (conversation.is_channel || channelsRef.current.some(ch => ch.id === conversationId))) {
              const formatted = formatChannel(conversation);
              if (formatted) {
                localConversation = formatted;
              } else {
                localConversation = conversation;
              }
            } else {
              localConversation = conversation;
            }
          }
        } catch (error) {
          console.log(`[selectConversation] Ошибка загрузки обычного чата для ${conversationId}:`, error);
          // Проверяем, является ли это ошибкой rate limit (429)
          const isRateLimitError = error.status === 429 ||
            error.message?.includes("429") ||
            error.message?.includes("лимит") ||
            error.message?.includes("Too Many Requests") ||
            error.message?.includes("Превышен лимит");

          if (isRateLimitError) {
            // Это rate limit, не "Chat not found"
            const retryAfter = error.retryAfter || 60;
            console.warn(`[selectConversation] Rate limit для чата ${conversationId}, ждем ${retryAfter} секунд`);
            setActiveConversation(null);
            setChatReady(false);
            setIsChatLoading(false);
            throw new Error(`Превышен лимит запросов. Пожалуйста, подождите ${retryAfter} секунд перед повторной попыткой.`);
          }

          // Если обычный API не работает, пробуем групповой
          console.log(`[selectConversation] Пробуем загрузить групповой чат для ${conversationId}`);
          try {
            // Извлекаем чистый ID для API (убираем префикс group- если есть)
            const numericId = typeof conversationId === 'string'
              ? conversationId.replace(/^(group-|channel-|conv-)/, '')
              : conversationId;
            const groupConversation = await apiClient.getGroupChat(numericId);
            console.log(`[selectConversation] Raw group chat response from server:`, groupConversation);
            // Извлекаем ID агентов из списка agents
            const groupAgentIds = groupConversation.agents?.map(a => a.agent_id || a.id) || [];
            console.log(`[selectConversation] Loaded group chat from server:`, {
              conversationId,
              numericId,
              agents: groupConversation.agents,
              groupAgentIds
            });
            localConversation = {
              ...groupConversation,
              id: conversationId, // Сохраняем оригинальный ID с префиксом
              is_group: true,
              group_avatar: groupConversation.group_avatar || "group",
              group_avatar_url: groupConversation.group_avatar_url || null,
              group_agent_ids: groupAgentIds, // Сохраняем ID агентов для совместимости
            };
          } catch (groupError) {
            // Проверяем, является ли это ошибкой rate limit (429)
            const isGroupRateLimitError = groupError.status === 429 ||
              groupError.message?.includes("429") ||
              groupError.message?.includes("лимит") ||
              groupError.message?.includes("Too Many Requests") ||
              groupError.message?.includes("Превышен лимит");

            if (isGroupRateLimitError) {
              // Это rate limit, не "Chat not found"
              const retryAfter = groupError.retryAfter || 60;
              console.warn(`[selectConversation] Rate limit для группового чата ${conversationId}, ждем ${retryAfter} секунд`);
              setActiveConversation(null);
              setChatReady(false);
              setIsChatLoading(false);
              throw new Error(`Превышен лимит запросов. Пожалуйста, подождите ${retryAfter} секунд перед повторной попыткой.`);
            }

            // Если и групповой чат не найден, выбрасываем ошибку
            console.error(`Conversation ${conversationId} not found:`, groupError);
            setActiveConversation(null);
            setChatReady(false);
            setIsChatLoading(false);
            throw new Error(`Chat not found: ${conversationId}`);
          }
        }
      }

      if (localConversation) {
        // КРИТИЧНО: Групповые чаты НЕ должны определяться как каналы
        // Проверяем is_group ПЕРЕД проверкой is_channel
        const isGroupConversation = !!localConversation.is_group;
        const isChannelConversation = !isGroupConversation && (
          !!localConversation.is_channel ||
          channelsRef.current.some((channel) => String(channel.id) === String(conversationId))
        );

        // Обработка групповых чатов - добавляем в conversations если их там нет
        if (isGroupConversation) {
          setConversations((prev) => {
            // Проверяем, не добавлен ли уже этот групповой чат
            const existing = (prev || []).find(c => String(c.id) === String(conversationId) && c.is_group);
            if (existing) {
              // КРИТИЧНО: При обновлении существующего чата сохраняем group_agent_ids
              // если они уже установлены (например, из createGroupChat)
              // и новые данные с сервера их не содержат
              const mergedConversation = {
                ...localConversation,
                group_agent_ids: localConversation.group_agent_ids?.length > 0 
                  ? localConversation.group_agent_ids 
                  : existing.group_agent_ids,
                agents: localConversation.agents?.length > 0 
                  ? localConversation.agents 
                  : existing.agents,
              };
              return (prev || []).map(c =>
                String(c.id) === String(conversationId) && c.is_group ? mergedConversation : c
              );
            }
            // Добавляем новый групповой чат в начало списка
            return [localConversation, ...(prev || [])];
          });
        }

        if (isChannelConversation) {
          const channelMeta = channelsRef.current.find(
            (channel) => String(channel.id) === String(conversationId)
          );

          let mergedChannel = {
            ...localConversation,
            is_channel: true,
            // КРИТИЧНО: Убеждаемся, что канал не определяется как системный чат
            // даже если на сервере у него is_system_chat: true
            is_system_chat: false,
          };

          if (channelMeta) {
            // Если есть channelMeta, используем его данные, но сохраняем важные данные из localConversation
            mergedChannel = {
              ...channelMeta,
              ...mergedChannel,
              // Сохраняем данные об иконке, цвете и аватаре из channelMeta (они более полные)
              iconName: channelMeta.iconName || mergedChannel.iconName || "notifications",
              colorClass: channelMeta.colorClass || mergedChannel.colorClass || "bg-blue-500",
              imageSrc: channelMeta.imageSrc || channelMeta.channel_avatar_url || mergedChannel.imageSrc || mergedChannel.channel_avatar_url,
              channel_avatar_url: channelMeta.channel_avatar_url || mergedChannel.channel_avatar_url,
            };
          } else {
            // Если channelMeta нет, используем данные из отформатированного канала (localConversation)
            // formatChannel уже установил правильные iconName, colorClass и т.д.
            const fallbackChannel = {
              ...mergedChannel,
              title:
                mergedChannel.title ||
                mergedChannel.channel_description ||
                `Канал #${conversationId}`,
              // Используем данные из отформатированного канала, а не дефолтные
              iconName: mergedChannel.iconName || mergedChannel.channel_icon_name || "notifications",
              colorClass: mergedChannel.colorClass || mergedChannel.channel_color_class || "bg-blue-500",
              imageSrc: mergedChannel.imageSrc || mergedChannel.channel_avatar_url,
              preview:
                mergedChannel.preview ||
                mergedChannel.channel_description ||
                "Канал (только чтение)",
              can_write:
                mergedChannel.can_write ??
                (mergedChannel.channel_owner_id != null &&
                  user?.id != null &&
                  Number(mergedChannel.channel_owner_id) === Number(user.id)),
            };
            mergedChannel = fallbackChannel;
            // Сохраняем в channelsRef для будущего использования
            channelsRef.current = mergeChannelsIntoConversations(
              channelsRef.current || [],
              [mergedChannel]
            );
            setChannels(channelsRef.current);
          }

          // КРИТИЧНО: Проверяем подписку перед добавлением канала в conversations
          // Проверяем подписку из нескольких источников для надежности
          const isSubscribedFromMeta = channelMeta && (channelMeta.isSubscribed === true || channelMeta.is_subscribed === true);
          const isSubscribedFromMerged = mergedChannel.isSubscribed === true || mergedChannel.is_subscribed === true;
          const isSubscribed = isSubscribedFromMeta || isSubscribedFromMerged;

          console.log(`[selectConversation] Проверка подписки для канала ${mergedChannel.title} (ID: ${conversationId}):`, {
            isSubscribedFromMeta,
            isSubscribedFromMerged,
            isSubscribed,
            channelMeta: channelMeta ? { isSubscribed: channelMeta.isSubscribed, is_subscribed: channelMeta.is_subscribed } : null,
            mergedChannel: { isSubscribed: mergedChannel.isSubscribed, is_subscribed: mergedChannel.is_subscribed }
          });

          if (!isSubscribed) {
            console.log(`[selectConversation] ⚠️ Канал ${mergedChannel.title} (ID: ${conversationId}) не подписан, не добавляем в conversations`);
            // Устанавливаем активный канал для просмотра, но НЕ добавляем в список чатов
            setActiveConversation(mergedChannel);

            if (!messagesByConversation[conversationId]) {
              updateMessagesForConversation(conversationId, []);
            }

            // Загружаем сообщения для просмотра (только чтение)
            await loadChannelMessages(conversationId);

            setChatReady(true);
            setIsChatLoading(false);
            return;
          }

          // Канал подписан - добавляем в conversations
          console.log(`[selectConversation] ✅ Канал ${mergedChannel.title} (ID: ${conversationId}) подписан, добавляем в conversations`);
          setActiveConversation(mergedChannel);

          // КРИТИЧНО: Убеждаемся, что канал действительно подписан перед добавлением
          const channelToAdd = {
            ...mergedChannel,
            isSubscribed: true,
            is_subscribed: true,
          };

          setConversations((prev) => {
            // Проверяем, не добавлен ли уже этот канал
            const existing = (prev || []).find(c => String(c.id) === String(conversationId) && c.is_channel);
            if (existing) {
              // Обновляем существующий канал
              return (prev || []).map(c =>
                c.id === conversationId && c.is_channel ? channelToAdd : c
              );
            }
            // Добавляем новый канал только если он подписан
            return mergeChannelsIntoConversations(prev || [], [channelToAdd]);
          });

          if (!messagesByConversation[conversationId]) {
            updateMessagesForConversation(conversationId, []);
          }

          await loadChannelMessages(conversationId);

          setChatReady(true);
          setIsChatLoading(false);
          return;
        }

        // Устанавливаем активный разговор ДО загрузки данных
        console.log(`[selectConversation] Setting activeConversation:`, {
          id: localConversation.id,
          is_group: localConversation.is_group,
          group_agent_ids: localConversation.group_agent_ids,
          agents: localConversation.agents
        });
        setActiveConversation(localConversation);

        // КРИТИЧНО: Если сообщения для этого чата еще не загружены, показываем пустой массив
        // Это предотвращает показ сообщений из предыдущего чата
        if (!messagesByConversation[conversationId]) {
          updateMessagesForConversation(conversationId, []);
        }

        // Проверяем, загружены ли уже данные чата (кэш)
        const hasCachedMessages =
          messagesByConversation[conversationId]?.length > 0;
        const hasCachedPinned =
          pinnedMessages[conversationId]?.length !== undefined;
        const cachedMessagesCount = messagesByConversation[conversationId]?.length ?? 0;
        const cachedPinnedCount = pinnedMessages[conversationId]?.length ?? 0;

        if (hasCachedMessages && hasCachedPinned) {
          // Данные уже загружены, чат готов сразу
          console.log(
            `✅ [Chat Load] Чат ${conversationId} уже загружен из кэша, готов к отображению`
          );
          setChatReady(true);
          setIsChatLoading(false);
        } else {
          // КРИТИЧНО: Для нового пустого чата сразу устанавливаем chatReady=true
          // чтобы UI был готов принимать сообщения, а данные загружаем в фоне
          // Используем переменную isNewEmptyChat, определенную в начале функции
          if (isNewEmptyChat) {
            // Инициализируем пустые массивы для нового чата
            if (!messagesByConversation[conversationId]) {
              updateMessagesForConversation(conversationId, []);
            }
            if (pinnedMessages[conversationId] === undefined) {
              setPinnedMessages((prev) => ({
                ...prev,
                [conversationId]: [],
              }));
            }

            // Чат готов к рендерингу СРАЗУ для нового пустого чата
            console.log(
              `✅ [Chat Load] Новый пустой чат ${conversationId} готов к отображению сразу`
            );
            setChatReady(true);
            setIsChatLoading(false);

            // Загружаем данные в фоне (не блокируем UI)
            (async () => {
              try {
                console.log(
                  `🔄 [Chat Load] Фоновая загрузка: закрепленные сообщения для чата ${conversationId}`
                );
                await loadPinnedMessages(conversationId);

                console.log(
                  `🔄 [Chat Load] Фоновая загрузка: история сообщений для чата ${conversationId}`
                );
                if (localConversation.is_group) {
                  await loadGroupMessages(conversationId);
                } else {
                  await loadMessages(conversationId);
                }
                // Принудительно обновляем состояние через небольшую задержку,
                // чтобы компонент перерисовался после асинхронного обновления состояния
                setTimeout(() => {
                  setMessagesByConversation((current) => {
                    const loadedCount = current[conversationId]?.length ?? 0;
                    console.log(
                      `✅ [Chat Load] Фоновая загрузка завершена для чата ${conversationId}, загружено сообщений: ${loadedCount}`
                    );
                    return current; // Возвращаем без изменений, только для триггера перерисовки
                  });
                }, 300);
              } catch (error) {
                console.error(`[Chat Load] Ошибка фоновой загрузки для чата ${conversationId}:`, error);
              }
            })();
          } else {
            // Для существующего чата загружаем данные последовательно
            // ПОСЛЕДОВАТЕЛЬНАЯ ЗАГРУЗКА в правильном порядке:
            // 1. Закрепленные сообщения
            console.log(
              `🔄 [Chat Load] Шаг 1/3: Загрузка закрепленных сообщений для чата ${conversationId}`
            );
            console.log(`[Chat Load] Local conversation data:`, localConversation);
            await loadPinnedMessages(conversationId);

            // 2. История сообщений
            console.log(
              `🔄 [Chat Load] Шаг 2/3: Загрузка истории сообщений для чата ${conversationId}`
            );
            if (localConversation.is_group) {
              await loadGroupMessages(conversationId);
            } else {
              await loadMessages(conversationId);
            }

            // 3. Информация об агенте (для обычных чатов - загружается из кэша, синхронно)
            // Для групповых чатов агенты уже есть в conversation.group_agent_ids
            if (!localConversation.is_group && localConversation.agent_id) {
              console.log(
                `🔄 [Chat Load] Шаг 3/3: Проверка информации об агенте ${localConversation.agent_id}`
              );
              // Информация об агенте уже должна быть загружена в AgentsContext при старте приложения
              // Просто проверяем, что агент существует (синхронная операция)
            }

            // Чат готов к рендерингу
            console.log(
              `✅ [Chat Load] Чат ${conversationId} готов к отображению`
            );
            setChatReady(true);
            setIsChatLoading(false);
          }
        }
      } else {
        throw new Error(`Conversation ${conversationId} not found`);
      }
    } catch (error) {
      console.error("Failed to select conversation:", error);
      setChatReady(false);
      setIsChatLoading(false);

      // Если ошибка авторизации, принудительно выходим
      if (error.message === "Unauthorized") {
        setError("Сессия истекла. Пожалуйста, войдите снова.");
        forceLogout();
      }

      // Проверяем, является ли это ошибкой rate limit
      const isRateLimitError = error.status === 429 ||
        error.message?.includes("429") ||
        error.message?.includes("лимит") ||
        error.message?.includes("Too Many Requests") ||
        error.message?.includes("Превышен лимит");

      if (isRateLimitError) {
        // Для rate limit ошибок показываем пользователю понятное сообщение
        const retryAfter = error.retryAfter || 60;
        setError(`Превышен лимит запросов. Пожалуйста, подождите ${retryAfter} секунд перед повторной попыткой.`);
      }

      throw error;
    } finally {
      // Всегда удаляем из множества активных запросов при выходе (успех или ошибка)
      selectingConversationRef.current.delete(conversationIdStr);
    }
  };

  // Переименовать разговор
  const renameConversation = async (conversationId, newTitle) => {
    try {
      setIsLoading(true);

      const numericId = typeof conversationId === 'string'
        ? conversationId.replace(/^(group-|channel-|conv-)/, '')
        : conversationId;

      // Обновляем название через API
      await apiClient.put(`/conversations/${numericId}/title`, {
        title: newTitle,
      });

      // Обновляем название в локальном списке разговоров
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === conversationId
            ? { ...conv, title: newTitle, updated_at: new Date().toISOString() }
            : conv
        )
      );

      // Обновляем activeConversation, если это текущий чат
      if (activeConversation && activeConversation.id === conversationId) {
        setActiveConversation((prev) =>
          prev ? { ...prev, title: newTitle } : null
        );
      }

      // Триггерим обновление сайдбара
      triggerUpdate();

      console.log(`✅ Название чата ${conversationId} обновлено на: ${newTitle}`);
    } catch (error) {
      console.error("Failed to rename conversation:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Удалить разговор
  const deleteConversation = useCallback(async (conversationId) => {
    try {
      setIsLoading(true);

      // Проверяем, не системный ли это чат
      if (systemChat && systemChat.id === conversationId) {
        console.log("Cannot delete system chat");
        return;
      }

      // Находим разговор в локальном списке для определения типа
      const conversation = conversations.find(
        (conv) => String(conv.id) === String(conversationId)
      );

      // Проверяем, есть ли еще чаты с этим агентом (ДО удаления, исключая текущий)
      // Это нужно для правильного определения, удалять ли агента из библиотеки
      let otherChatsWithAgent = [];
      if (conversation && conversation.agent_id && !conversation.is_group && !conversation.is_channel) {
        otherChatsWithAgent = conversations.filter(
          (conv) => {
            // Проверяем базовые условия
            if (String(conv.id) === String(conversationId)) return false;
            if (conv.agent_id !== conversation.agent_id) return false;
            if (conv.is_group || conv.is_channel) return false;

            // Проверяем, является ли чат новым пустым (инлайн логика из isNewlyCreatedEmptyChat)
            if (newlyCreatedEmptyChatsRef.current.has(conv.id)) {
              const messagesCount = messagesByConversation[conv.id]?.length ?? 0;
              const pinnedCount = pinnedMessages[conv.id]?.length ?? 0;

              // Если чат пустой, исключаем его
              if (messagesCount === 0 && pinnedCount === 0) {
                return false;
              }
            }

            return true;
          }
        );
      }

      const numericId = typeof conversationId === 'string'
        ? conversationId.replace(/^(group-|channel-|conv-)/, '')
        : conversationId;

      try {
        if (conversation && conversation.is_group) {
          // Удаляем групповой чат
          await apiClient.deleteGroupChat(numericId);
        } else {
          // Удаляем обычный чат
          await apiClient.deleteConversation(numericId);
        }
      } catch (apiError) {
        // Если чат не найден на сервере (404), продолжаем локальное удаление
        if (apiError.status === 404 || (apiError.message && apiError.message.includes("404")) || (apiError.response && apiError.response.status === 404)) {
          console.warn(`[deleteConversation] Conversation ${conversationId} not found on server (404), proceeding with local cleanup`);
        } else {
          // Для других ошибок прекращаем выполнение
          throw apiError;
        }
      }

      // Удаляем из списка разговоров
      setConversations((prev) =>
        prev.filter((conv) => String(conv.id) !== String(conversationId))
      );

      // Удаляем из закрепленных чатов, если он был закреплен
      const chatId = conversationId.toString();
      if (pinnedChats.includes(chatId)) {
        const newPinnedChats = pinnedChats.filter((id) => id !== chatId);
        setPinnedChats(newPinnedChats);
        const numericId = Number(conversationId);
        if (!Number.isNaN(numericId)) {
          try {
            await apiClient.unpinChat(numericId);
          } catch (error) {
            console.error("Failed to sync pinned chats after deletion:", error);
          }
        }
      }

      // Удаляем сообщения этого чата из кэша
      setMessagesByConversation((prev) => {
        const newByConv = { ...prev };
        delete newByConv[conversationId];
        return newByConv;
      });

      // Если удаляемый разговор был активным, очищаем активный разговор
      if (activeConversation && String(activeConversation.id) === String(conversationId)) {
        setActiveConversation(null);
        // messages автоматически станет пустым через computed value
      }

      // Очищаем prevActiveConversationIdRef, если удаленный чат был предыдущим активным
      if (prevActiveConversationIdRef.current === conversationId) {
        prevActiveConversationIdRef.current = null;
      }

      // Убираем из списка новых пустых чатов (если был там)
      newlyCreatedEmptyChatsRef.current.delete(conversationId);

      // Очищаем счетчик непрочитанных сообщений для удаленного чата
      resetUnreadCount(conversationId);

      // Удаляем agent_id из localStorage библиотеки, если это последний чат с агентом
      if (conversation && conversation.agent_id && !conversation.is_group && !conversation.is_channel) {
        try {
          // Используем предварительно вычисленный список других чатов с этим агентом
          // Удаляем агента из библиотеки только если это был последний чат с ним
          if (otherChatsWithAgent.length === 0) {
            // Пытаемся получить агента для определения категории
            try {
              const agent = await apiClient.getAgent(conversation.agent_id);
              if (agent) {
                removeAgentFromLibrary(conversation.agent_id, agent);
                console.log(`[ChatsContext] Удален агент "${agent.name}" (ID: ${conversation.agent_id}) из библиотеки, так как удален последний чат с ним`);
              } else {
                // Если агент не найден, удаляем из всех ключей
                removeAgentFromLibrary(conversation.agent_id, null);
                console.log(`[ChatsContext] Удален агент (ID: ${conversation.agent_id}) из библиотеки, так как удален последний чат с ним`);
              }
            } catch (agentError) {
              // Если не удалось получить агента, удаляем из всех ключей
              console.warn("Failed to get agent for library cleanup:", agentError);
              removeAgentFromLibrary(conversation.agent_id, null);
              console.log(`[ChatsContext] Удален агент (ID: ${conversation.agent_id}) из библиотеки, так как удален последний чат с ним`);
            }
          } else {
            console.log(`[ChatsContext] Агент (ID: ${conversation.agent_id}) не удален из библиотеки, так как осталось ${otherChatsWithAgent.length} чат(ов) с ним`);
          }
        } catch (error) {
          console.error("Failed to remove agent from library:", error);
        }
      }
    } catch (error) {
      console.error("Failed to delete conversation:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [conversations, systemChat, pinnedChats, messagesByConversation, activeConversation, resetUnreadCount, triggerUpdate, pinnedMessages]);

  // Сохраняем функцию deleteConversation в ref для использования в useEffect
  useEffect(() => {
    deleteConversationRef.current = deleteConversation;
  }, [deleteConversation]);

  // Отслеживаем закрытие чата (когда activeConversation становится null) для удаления пустых чатов
  useEffect(() => {
    // Если активный чат закрывается (становится null), проверяем предыдущий чат
    if (!activeConversation) {
      const previousConversationId = prevActiveConversationIdRef.current;
      if (previousConversationId && deleteConversationRef.current) {
        const isNewEmptyChat = newlyCreatedEmptyChatsRef.current.has(previousConversationId);
        if (isNewEmptyChat) {
          // Проверяем, действительно ли чат пустой
          const messagesCount = messagesByConversation[previousConversationId]?.length ?? 0;
          const pinnedCount = pinnedMessages[previousConversationId]?.length ?? 0;

          if (messagesCount === 0 && pinnedCount === 0) {
            console.log(`[useEffect] Активный чат закрыт, автоматически удаляем пустой новый чат ${previousConversationId}`);
            // Удаляем чат асинхронно
            deleteConversationRef.current(previousConversationId).catch(error => {
              console.error(`[useEffect] Ошибка при удалении пустого чата ${previousConversationId}:`, error);
            });
          } else {
            // Если в чате появились сообщения, убираем его из списка новых пустых
            newlyCreatedEmptyChatsRef.current.delete(previousConversationId);
            console.log(`[useEffect] Чат ${previousConversationId} больше не пустой, убираем из отслеживания`);
          }
          // Очищаем предыдущий чат после проверки
          prevActiveConversationIdRef.current = null;
        }
      }
    }
  }, [activeConversation, messagesByConversation, pinnedMessages]);

  // Очистить все сообщения из разговора
  const clearConversationMessages = async (conversationId) => {
    console.log("=== clearConversationMessages START ===");
    console.log("conversationId:", conversationId);
    console.log("systemChat:", systemChat);

    try {
      setIsLoading(true);

      // Определяем тип чата (групповой, системный или обычный)
      const conversation =
        conversations.find((conv) => conv.id === conversationId) ||
        (systemChat?.id === conversationId ? systemChat : null);

      const isGroupChat = conversation?.is_group;
      const isSystemChat =
        conversation?.is_system_chat || systemChat?.id === conversationId;

      console.log("isGroupChat:", isGroupChat);
      console.log("isSystemChat:", isSystemChat);

      const numericId = typeof conversationId === 'string'
        ? conversationId.replace(/^(group-|channel-|conv-)/, '')
        : conversationId;

      console.log("Calling API clearConversationMessages");
      // Очищаем сообщения через API в зависимости от типа чата
      if (isGroupChat) {
        await apiClient.clearGroupConversationMessages(numericId);
      } else {
        // Для системного чата и обычных чатов используем тот же endpoint
        await apiClient.clearConversationMessages(numericId);
      }
      console.log("API call successful");

      // Очищаем сообщения в локальном состоянии
      updateMessagesForConversation(conversationId, []);
      console.log("Messages cleared from local state");

      // Обновляем закрепленные сообщения для этого чата
      setPinnedMessages((prev) => ({
        ...prev,
        [conversationId]: [],
      }));
      console.log("Pinned messages cleared");

      // Если это системный чат, перезагружаем его отдельно
      if (isSystemChat) {
        console.log("Reloading system chat");
        await loadSystemChat();
      }

      // Обновляем список разговоров, чтобы обновить last_message
      await loadConversations();
      console.log("Conversations reloaded");

      // Обновляем sidebar
      triggerUpdate();
      console.log("Sidebar updated");
    } catch (error) {
      console.error("=== clearConversationMessages ERROR ===");
      console.error("Failed to clear conversation messages:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      throw error;
    } finally {
      setIsLoading(false);
      console.log("=== clearConversationMessages END ===");
    }
  };

  // Очистить все разговоры пользователя
  const clearAllConversations = async () => {
    console.log("=== clearAllConversations START ===");

    try {
      setIsLoading(true);

      // Вызываем оригинальный эндпоинт для очистки всех данных на сервере
      // Это удалит все чаты, сообщения, папки, файлы и настройки одной операцией
      await apiClient.clearAllData();
      console.log("Server data cleared successfully");

      // Очищаем все локальные состояния чата
      setConversations([]);
      setMessagesByConversation({});
      setPinnedMessages({});
      setActiveConversation(null);
      setPinnedChats([]);

      // Сбрасываем счетчики непрочитанных
      if (typeof setUnreadCounts === 'function') {
        setUnreadCounts({});
      }

      // Обновляем sidebar и уведомляем другие контексты через updateTrigger
      triggerUpdate();

      console.log("=== clearAllConversations SUCCESS ===");
    } catch (error) {
      console.error("=== clearAllConversations ERROR ===");
      console.error("Failed to clear all conversations:", error);
      throw error;
    } finally {
      setIsLoading(false);
      console.log("=== clearAllConversations END ===");
    }
  };

  // Закрепить сообщение в разговоре
  const pinMessage = async (conversationId, messageId) => {
    try {
      setIsLoading(true);

      // Определяем тип чата по активному разговору
      const conversation = conversations.find(
        (conv) => String(conv.id) === String(conversationId)
      );
      const isGroupChat = conversation?.is_group;

      const numericId = typeof conversationId === 'string'
        ? conversationId.replace(/^(group-|channel-|conv-)/, '')
        : conversationId;

      if (isGroupChat) {
        await apiClient.pinGroupMessage(numericId, messageId);
      } else {
        await apiClient.pinMessage(numericId, messageId);
      }
    } catch (error) {
      console.error("Failed to pin message:", error);
      // Если ошибка авторизации, принудительно выходим
      if (error.message === "Unauthorized" || error.message.includes("403")) {
        setError("Сессия истекла. Пожалуйста, войдите снова.");
        forceLogout();
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Открепить сообщение в разговоре
  const unpinMessage = async (conversationId) => {
    try {
      setIsLoading(true);

      // Определяем тип чата по активному разговору
      const conversation = conversations.find(
        (conv) => conv.id === conversationId
      );
      const isGroupChat = conversation?.is_group;

      const numericId = typeof conversationId === 'string'
        ? conversationId.replace(/^(group-|channel-|conv-)/, '')
        : conversationId;

      if (isGroupChat) {
        await apiClient.unpinGroupMessage(numericId);
      } else {
        await apiClient.unpinMessage(numericId);
      }
    } catch (error) {
      console.error("Failed to unpin message:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Удалить сообщение и обновить локальное состояние
  const deleteMessage = async (messageId) => {
    console.log("=== DELETE MESSAGE DEBUG START ===");
    console.log("messageId:", messageId);
    console.log("activeConversation:", activeConversation);
    console.log(
      "activeConversation.is_system_chat:",
      activeConversation?.is_system_chat
    );

    // КРИТИЧНО: Сохраняем conversationId перед удалением
    const conversationId = activeConversation?.id;

    if (!conversationId) {
      console.error("Cannot delete message: no active conversation");
      return;
    }

    try {
      setIsLoading(true);
      console.log("Calling API deleteMessage with messageId:", messageId);
      await apiClient.deleteMessage(messageId);
      console.log("API deleteMessage successful, updating local state");

      // Удаляем сообщение из конкретного чата
      updateMessagesForConversation(conversationId, (prev) =>
        prev.filter((msg) => msg.id !== messageId)
      );
      console.log("Local state updated successfully");

      // Удаляем сообщение из локального списка закрепленных, если оно там есть
      setPinnedMessages((prev) => {
        const current = prev?.[conversationId] || [];
        if (!current.length) return prev;
        const next = current.filter((item) =>
          typeof item === "object" ? item.id !== messageId : item !== messageId
        );
        if (next.length === current.length) return prev;
        return { ...prev, [conversationId]: next };
      });
    } catch (error) {
      console.error("=== DELETE MESSAGE ERROR ===");
      console.error("Error details:", error);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
      console.error("messageId:", messageId);
      console.error("activeConversation:", activeConversation);

      // Если ошибка авторизации, принудительно выходим
      if (error.message === "Unauthorized" || error.message.includes("403")) {
        setError("Сессия истекла. Пожалуйста, войдите снова.");
        forceLogout();
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Получить разговор по ID
  const getConversation = (conversationId) => {
    return conversations.find((conv) => conv.id === conversationId);
  };

  // Получить разговоры по агенту
  const getConversationsByAgent = (agentId) => {
    return conversations.filter((conv) => conv.agent_id === agentId);
  };

  // ===== ЗАКРЕПЛЕНИЕ ЧАТОВ =====

  // Закрепить чат (глобально - для обратной совместимости)
  const pinChat = async (conversationId) => {
    const numericId = Number(conversationId);
    if (Number.isNaN(numericId)) {
      console.warn("pinChat: invalid conversationId", conversationId);
      return;
    }

    const chatId = numericId.toString();

    setPinnedChats((prev) => {
      if (prev.includes(chatId)) {
        return prev;
      }
      return [chatId, ...prev];
    });

    try {
      const response = await apiClient.pinChat(numericId);
      const pinnedFromServer = Array.isArray(response?.pinned_chats)
        ? response.pinned_chats
        : Array.isArray(response)
          ? response
          : [];
      setPinnedChats(pinnedFromServer.map((id) => id.toString()));
    } catch (error) {
      console.error("Failed to pin chat:", error);
      setPinnedChats((prev) => prev.filter((id) => id !== chatId));
    }
  };

  // Открепить чат (глобально - для обратной совместимости)
  const unpinChat = async (conversationId) => {
    const numericId = Number(conversationId);
    if (Number.isNaN(numericId)) {
      console.warn("unpinChat: invalid conversationId", conversationId);
      return;
    }

    const chatId = numericId.toString();
    setPinnedChats((prev) => prev.filter((id) => id !== chatId));

    try {
      const response = await apiClient.unpinChat(numericId);
      const pinnedFromServer = Array.isArray(response?.pinned_chats)
        ? response.pinned_chats
        : Array.isArray(response)
          ? response
          : [];
      setPinnedChats(pinnedFromServer.map((id) => id.toString()));
    } catch (error) {
      console.error("Failed to unpin chat:", error);
      setPinnedChats((prev) => {
        if (prev.includes(chatId)) {
          return prev;
        }
        return [chatId, ...prev];
      });
    }
  };

  // ===== ЗАКРЕПЛЕНИЕ ЧАТОВ В ПАПКАХ =====

  // Закрепить чат в конкретной папке
  const pinChatInFolder = async (folderId, conversationId) => {
    try {
      await apiClient.pinChatInFolder(folderId, conversationId);
      console.log(`Chat ${conversationId} pinned in folder ${folderId}`);
    } catch (error) {
      console.error("Failed to pin chat in folder:", error);
      throw error;
    }
  };

  // Открепить чат от конкретной папки
  const unpinChatFromFolder = async (folderId, conversationId) => {
    try {
      await apiClient.unpinChatFromFolder(folderId, conversationId);
      console.log(`Chat ${conversationId} unpinned from folder ${folderId}`);
    } catch (error) {
      console.error("Failed to unpin chat from folder:", error);
      throw error;
    }
  };

  // Переключить состояние закрепления чата в папке
  const togglePinChatInFolder = async (folderId, conversationId) => {
    try {
      await apiClient.togglePinChatInFolder(folderId, conversationId);
      console.log(`Chat ${conversationId} pin toggled in folder ${folderId}`);
    } catch (error) {
      console.error("Failed to toggle pin chat in folder:", error);
      throw error;
    }
  };

  // Получить закрепленные чаты в папке
  const getPinnedChatsInFolder = async (folderId) => {
    try {
      const response = await apiClient.getPinnedChatsInFolder(folderId);
      // Возвращаем массив ID закрепленных чатов, преобразуя их в строки для совместимости
      const pinnedChatIds = response.pinned_chats || [];
      return pinnedChatIds.map(id => id.toString());
    } catch (error) {
      console.error("Failed to get pinned chats in folder:", error);
      console.error("Error details:", error);
      return [];
    }
  };

  // Проверить, закреплен ли чат (глобально - для обратной совместимости)
  const isChatPinned = (conversationId) => {
    return pinnedChats.includes(conversationId.toString());
  };

  // ===== ЗАКРЕПЛЕНИЕ В СИСТЕМНЫХ ПАПКАХ =====

  // Получить ключ localStorage для системной папки
  const getSystemFolderKey = (folderId) => {
    return `pinnedChats_${folderId}`;
  };

  // Получить закрепленные чаты в системной папке
  const getPinnedChatsInSystemFolder = (folderId) => {
    try {
      const key = getSystemFolderKey(folderId);
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error(
        `Failed to get pinned chats for system folder ${folderId}:`,
        error
      );
      return [];
    }
  };

  // Закрепить чат в системной папке
  const pinChatInSystemFolder = (folderId, conversationId) => {
    try {
      const chatId = conversationId.toString();
      const currentPinned = getPinnedChatsInSystemFolder(folderId);

      if (!currentPinned.includes(chatId)) {
        const newPinned = [chatId, ...currentPinned];
        const key = getSystemFolderKey(folderId);
        localStorage.setItem(key, JSON.stringify(newPinned));
        console.log(
          `Chat ${conversationId} pinned in system folder ${folderId}`
        );
      }
    } catch (error) {
      console.error(`Failed to pin chat in system folder ${folderId}:`, error);
    }
  };

  // Открепить чат от системной папки
  const unpinChatFromSystemFolder = (folderId, conversationId) => {
    try {
      const chatId = conversationId.toString();
      const currentPinned = getPinnedChatsInSystemFolder(folderId);
      const newPinned = currentPinned.filter((id) => id !== chatId);

      const key = getSystemFolderKey(folderId);
      localStorage.setItem(key, JSON.stringify(newPinned));
      console.log(
        `Chat ${conversationId} unpinned from system folder ${folderId}`
      );
    } catch (error) {
      console.error(
        `Failed to unpin chat from system folder ${folderId}:`,
        error
      );
    }
  };

  // Проверить, закреплен ли чат в системной папке
  const isChatPinnedInSystemFolder = (folderId, conversationId) => {
    const pinnedChats = getPinnedChatsInSystemFolder(folderId);
    return pinnedChats.includes(conversationId.toString());
  };

  // Переключить состояние закрепления чата в системной папке
  const togglePinChatInSystemFolder = (folderId, conversationId) => {
    if (isChatPinnedInSystemFolder(folderId, conversationId)) {
      unpinChatFromSystemFolder(folderId, conversationId);
    } else {
      pinChatInSystemFolder(folderId, conversationId);
    }
  };

  // ===== ГРУППОВЫЕ ЧАТЫ =====

  // Создать новый групповой чат
  const createGroupChat = async (groupData, setAsActive = false) => {
    try {
      setIsLoading(true);
      console.log("[createGroupChat] Creating group chat with data:", {
        title: groupData.title,
        agent_ids: groupData.agent_ids,
        agent_ids_length: groupData.agent_ids?.length,
        setAsActive
      });

      // Если есть файл аватара, используем FormData, иначе обычный JSON
      let chatData;
      if (groupData.avatarFile) {
        // Используем FormData для загрузки файла
        const multiAgentData = {
          title: groupData.title,
          description: groupData.description,
          agent_ids: groupData.agent_ids,
          group_avatar: groupData.group_avatar || groupData.avatar || "group",
          conversation_type: "agents_only",
        };
        chatData = await apiClient.createGroupChatWithAvatar(multiAgentData, groupData.avatarFile);
      } else {
        // Обычный JSON запрос
        const multiAgentData = {
          title: groupData.title,
          description: groupData.description,
          agent_ids: groupData.agent_ids,
          group_avatar: groupData.group_avatar || groupData.avatar || "group",
        };
        chatData = await apiClient.createGroupChat(multiAgentData);
      }
      console.log("Group chat created:", chatData);

      // Проверяем, что мы получили корректные данные
      if (!chatData || !chatData.conversation_id) {
        throw new Error("Invalid group chat data received from server");
      }

      // КРИТИЧНО: Загружаем полную информацию об агентах группы сразу после создания
      let groupAgents = [];
      try {
        console.log("[createGroupChat] Loading agents for conversation:", chatData.conversation_id);
        const agentsResponse = await apiClient.getGroupChatAgents(chatData.conversation_id);
        groupAgents = agentsResponse.agents || [];
        console.log("[createGroupChat] Loaded group agents:", {
          count: groupAgents.length,
          agentIds: groupAgents.map(a => a.id)
        });
      } catch (error) {
        console.error("[createGroupChat] Failed to load group agents:", error);
        // Не прерываем создание группы, если не удалось загрузить агентов
      }

      // Добавляем новый групповой чат в список разговоров
      setConversations((prev) => {
        // Проверяем, что чат с таким ID еще не существует
        const existingChat = prev.find(
          (conv) => conv.id === chatData.conversation_id
        );
        if (existingChat) {
          console.log("Group chat already exists, skipping duplicate");
          return prev;
        }

        // Создаем объект чата в формате, совместимом с обычными чатами
        const selectedAvatar = groupData.group_avatar || groupData.avatar || "group";
        const backendAvatar = chatData.group_avatar || selectedAvatar;

        const groupChatItem = {
          id: `group-${chatData.conversation_id}`,
          conversation_id: `group-${chatData.conversation_id}`,
          real_id: chatData.conversation_id,
          title: groupData.title,
          agent_id: null, // У групповых чатов нет одного агента
          agent_name: null,
          is_group: true,
          group_avatar: backendAvatar,
          group_avatar_url: chatData.group_avatar_url || null, // Сохраняем URL загруженного аватара
          group_agent_ids: groupData.agent_ids, // Сохраняем ID агентов группы
          created_at: new Date().toISOString(),
          agents: groupAgents, // ИСПРАВЛЕНО: Используем загруженных агентов
        };

        // Добавляем новый чат в начало списка и удаляем возможные дубликаты
        const newConversations = [groupChatItem, ...prev];
        const uniqueConversations = newConversations.filter(
          (conv, index, self) =>
            index === self.findIndex((c) => c.id === conv.id)
        );

        console.log(
          "Updated conversations with group chat:",
          uniqueConversations.length
        );
        return uniqueConversations;
      });

      // Устанавливаем как активный чат только если явно запрошено
      if (setAsActive) {
        // Создаем объект чата для immediate установки с полными данными об агентах
        const groupChatItem = {
          id: `group-${chatData.conversation_id}`,
          conversation_id: `group-${chatData.conversation_id}`,
          real_id: chatData.conversation_id,
          title: groupData.title,
          agent_id: null, // У групповых чатов нет одного агента
          agent_name: null,
          is_group: true,
          group_avatar: chatData.group_avatar || groupData.group_avatar || groupData.avatar || "group",
          group_avatar_url: chatData.group_avatar_url || null, // Сохраняем URL загруженного аватара
          group_agent_ids: groupData.agent_ids, // Сохраняем ID агентов группы
          created_at: new Date().toISOString(),
          agents: groupAgents // ИСПРАВЛЕНО: Используем загруженных агентов вместо пустого массива
        };

        // КРИТИЧНО: Устанавливаем сразу как активный чат с полной информацией
        // БЕЗ вызова selectConversation, так как он не найдет чат в conversations
        // (setConversations ещё не применился)
        console.log("[createGroupChat] Setting activeConversation with group_agent_ids:", {
          id: groupChatItem.id,
          group_agent_ids: groupChatItem.group_agent_ids,
          group_agent_ids_length: groupChatItem.group_agent_ids?.length,
          agents_length: groupChatItem.agents?.length
        });
        setActiveConversation(groupChatItem);
        
        // Обновляем ref для корректной работы при последующих операциях
        activeConversationRef.current = groupChatItem.id;
        prevActiveConversationIdRef.current = groupChatItem.id;
        
        // Сохраняем в localStorage
        try {
          localStorage.setItem('lastActiveChat', groupChatItem.id);
        } catch (e) {
          console.error('Failed to save lastActiveChat to localStorage:', e);
        }
        
        // Инициализируем пустые сообщения для нового чата
        updateMessagesForConversation(groupChatItem.id, []);
        
        // Устанавливаем состояние готовности чата
        setChatReady(true);
        setIsChatLoading(false);
        
        console.log("[createGroupChat] Group chat set as active with agents:", groupAgents.length);
      }

      return chatData;
    } catch (error) {
      console.error("Failed to create group chat:", error);
      // Обработка превышения лимита чатов (403)
      const is403 = error.status === 403 || error.response?.status === 403;
      const isChatLimit = is403 && (
        (error.message && (error.message.includes('лимит') || error.message.includes('чат'))) ||
        (error.response?.detail && typeof error.response.detail === 'string' && (error.response.detail.includes('лимит') || error.response.detail.includes('чат')))
      );
      if (isChatLimit) {
        setShowUpgradeModal(true, "chats_limit");
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Получить групповые чаты
  const getGroupChats = async () => {
    try {
      setIsLoading(true);
      const groupChats = await apiClient.getGroupChats();
      return groupChats;
    } catch (error) {
      console.error("Failed to load group chats:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Удалить групповой чат
  const deleteGroupChat = async (conversationId) => {
    try {
      setIsLoading(true);
      await apiClient.deleteGroupChat(conversationId);

      // Удаляем из списка разговоров
      setConversations((prev) =>
        prev.filter((conv) => conv.id !== conversationId)
      );

      // Если удаляемый разговор был активным, очищаем активный разговор
      if (activeConversation && activeConversation.id === conversationId) {
        setActiveConversation(null);
        // messages автоматически станет пустым через computed value
      }
    } catch (error) {
      console.error("Failed to delete group chat:", error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Отправить сообщение в групповой чат
  const sendGroupMessage = async (conversationId, message, onInputClear) => {
    console.log("sendGroupMessage: Starting group message send process");

    // КРИТИЧНО: Сохраняем conversationId в замыкании
    const targetConversationId = conversationId;
    // КРИТИЧНО: Сохраняем ID активного чата В МОМЕНТ ОТПРАВКИ для проверки непрочитанных
    const activeConversationIdAtSend = activeConversation?.id;

    // Проверяем лимит сообщений перед отправкой
    const canSend = await checkMessageLimit();
    if (!canSend) {
      console.log(
        "sendGroupMessage: Message limit exceeded, showing upgrade modal"
      );
      setShowUpgradeModal(true);
      return;
    }

    try {
      const numericId = typeof targetConversationId === 'string'
        ? targetConversationId.replace(/^(group-|channel-|conv-)/, '')
        : targetConversationId;

      const messageData = {
        conversation_id: numericId.toString(),
        message: message,
      };

      // Создаем временное состояние сообщения для мгновенной обратной связи
      const tempMessageId = messageStateManager.createMessageState();

      // Мгновенно добавляем сообщение пользователя в локальное состояние
      const tempUserMessage = {
        id: tempMessageId,
        content: message,
        is_from_user: true,
        created_at: new Date().toISOString(),
        conversation_id: targetConversationId,
        agent_id: null, // У групповых чатов нет одного агента
        state: "sending",
      };

      // Обновляем локальное состояние сообщений для мгновенного отображения
      updateMessagesForConversation(targetConversationId, (prev) => [
        ...prev,
        tempUserMessage,
      ]);

      // Мгновенно обновляем превью последнего сообщения в списке чатов
      updateConversationPreview(targetConversationId, message, true);

      // Получаем информацию об агентах группы для создания thinking сообщений
      const groupConversation = conversations.find(
        (conv) => conv.id === targetConversationId
      );
      const groupAgentIds = groupConversation?.group_agent_ids || [];

      // Получаем информацию об агентах с сервера
      let agents = [];
      try {
        agents = await apiClient.getAgents();
      } catch (error) {
        console.error("Failed to get agents for thinking messages:", error);
      }

      // Создаем thinking сообщения для всех агентов группы
      const thinkingMessages = groupAgentIds.map((agentId) => {
        const agent = agents.find((a) => a.id === agentId);
        const agentName = agent ? agent.name : `Агент ${agentId}`;

        return {
          id: `thinking_${tempMessageId}_${agentId}`,
          content: "",
          is_from_user: false,
          created_at: new Date().toISOString(),
          conversation_id: targetConversationId,
          agent_id: agentId,
          agent_name: agentName,
          state: "thinking",
          is_thinking: true,
        };
      });

      // Добавляем thinking сообщения в локальное состояние
      if (thinkingMessages.length > 0) {
        updateMessagesForConversation(targetConversationId, (prev) => [
          ...prev,
          ...thinkingMessages,
        ]);
      }

      // Мгновенно обновляем время разговора и sidebar для перерендеринга с новым порядком чатов
      const currentTime = new Date().toISOString();

      // Обновляем время разговора в локальном состоянии сразу при отправке сообщения
      setConversations((prev) =>
        prev.map((conv) =>
          conv.id === targetConversationId
            ? { ...conv, updated_at: currentTime }
            : conv
        )
      );

      console.log("Triggering instant sidebar update for group message");
      triggerUpdate();

      const response = await apiClient.sendGroupMessage(messageData);

      // Очищаем поле ввода ПОСЛЕ успешной отправки
      if (onInputClear && typeof onInputClear === "function") {
        onInputClear();
      }

      // Обновляем состояние сообщения на "отправлено"
      messageStateManager.setReceivedState(tempMessageId);

      // Обновляем сообщения
      await loadGroupMessages(targetConversationId);

      // Удаляем локальные thinking сообщения ПОСЛЕ загрузки ответов
      updateMessagesForConversation(targetConversationId, (prev) =>
        prev.filter((m) => {
          const isThinkingMessage = String(m.id).startsWith(`thinking_${tempMessageId}`);
          if (isThinkingMessage) {
            // Обновляем состояние messageStateManager для thinking сообщения
            messageStateManager.setReceivedState(m.id);
            return false;
          }
          return true;
        })
      );

      // 📬 ЛОГИКА НЕПРОЧИТАННЫХ СООБЩЕНИЙ ДЛЯ ГРУППОВЫХ ЧАТОВ:
      // Backend увеличивает счетчик на количество ответов агентов (например, 4 агента = +4)
      // НЕ увеличиваем счетчик локально - полагаемся на синхронизацию с backend
      // Это позволяет корректно отображать реальное количество непрочитанных сообщений

      // Обновляем данные пользователя для актуализации счетчика сообщений
      try {
        console.log("Refreshing user data after group message send...");
        await refreshUserData();
      } catch (error) {
        console.error(
          "Failed to refresh user data after group message send:",
          error
        );
      }

      // 📬 КРИТИЧНО: Перезагружаем список чатов ПОСЛЕ загрузки сообщений
      // чтобы синхронизировать счетчики непрочитанных сообщений
      // Если пользователь переключился на другой чат, счетчик должен появиться
      setTimeout(async () => {
        await loadConversations();
        // Также перезагружаем системный чат для синхронизации updated_at
        await loadSystemChat();
      }, 500); // Небольшая задержка для завершения всех операций

      return response;
    } catch (error) {
      // Проверяем, является ли это ошибкой лимита сообщений (429)
      const isMessageLimitError =
        error.status === 429 ||
        error.message?.includes("Message limit exceeded") ||
        error.message?.includes("limit exceeded");

      if (isMessageLimitError) {
        // Для ошибки лимита показываем модальное окно вместо логирования
        setShowUpgradeModal(true);

        // Удаляем временное сообщение из локального состояния
        updateMessagesForConversation(targetConversationId, (prev) =>
          prev.filter((msg) => msg.id !== tempMessageId)
        );

        // Удаляем thinking сообщение если есть
        if (!isSystemChat) {
          updateMessagesForConversation(targetConversationId, (prev) =>
            prev.filter((msg) => msg.id !== `thinking_${tempMessageId}`)
          );
        }

        // Восстанавливаем текст в поле ввода
        if (onInputClear && typeof onInputClear === "function") {
          onInputClear(message);
        }

        // Не пробрасываем ошибку дальше, так как модальное окно уже показано
        return;
      }

      // Для других ошибок логируем как обычно
      console.error("Failed to send group message:", error);

      // Устанавливаем состояние ошибки для временного сообщения
      messageStateManager.setErrorState(tempMessageId, error.message);

      // Удаляем временное сообщение из локального состояния
      updateMessagesForConversation(targetConversationId, (prev) =>
        prev.filter((msg) => msg.id !== tempMessageId)
      );

      // Восстанавливаем текст в поле ввода при ошибке
      if (onInputClear && typeof onInputClear === "function") {
        onInputClear(message);
      }

      // Удаляем thinking сообщения при ошибке
      updateMessagesForConversation(targetConversationId, (prev) =>
        prev.filter(
          (m) => !String(m.id).startsWith(`thinking_${tempMessageId}`)
        )
      );

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  // Загрузить сообщения группового чата
  const loadGroupMessages = useCallback(
    async (conversationId, { offset = 0, maxChars = 10000, isOlderLoad = false, beforeDate = null } = {}) => {
      try {
        setIsLoading(true);
        const numericId = typeof conversationId === 'string'
          ? conversationId.replace(/^(group-|channel-|conv-)/, '')
          : conversationId;

        const messagesData = await apiClient.getGroupChatMessages(
          numericId,
          offset,
          maxChars,
          beforeDate
        );

        if (isOlderLoad) {
          // При подгрузке старых сообщений добавляем их в начало
          updateMessagesForConversation(conversationId, (prevMessages) => {
            // Проверяем, нет ли дубликатов
            const existingIds = new Set(prevMessages.map(m => m.id));
            const newMessages = (messagesData || []).filter(m => !existingIds.has(m.id));

            if (newMessages.length === 0) {
              console.warn(`[loadGroupMessages] Нет новых сообщений для добавления (все дубликаты или пустой ответ)`);
              return prevMessages; // Возвращаем без изменений, если нет новых сообщений
            }

            console.log(`[loadGroupMessages] Добавляем ${newMessages.length} новых старых сообщений к ${prevMessages.length} существующим`);

            // Фильтруем локальные thinking сообщения
            const localThinkingMessages = prevMessages.filter(
              (msg) => msg.is_thinking === true || msg.state === "thinking"
            );

            // Объединяем: новые старые сообщения + существующие + thinking
            const mergedMessages = [...newMessages, ...prevMessages.filter(m => !m.is_thinking && m.state !== "thinking"), ...localThinkingMessages];

            // КРИТИЧНО: Thinking сообщения всегда должны быть в КОНЦЕ списка
            const sorted = mergedMessages.sort((a, b) => {
              const aIsThinking =
                a.is_thinking === true || a.state === "thinking";
              const bIsThinking =
                b.is_thinking === true || b.state === "thinking";

              if (aIsThinking === bIsThinking) {
                return new Date(a.created_at) - new Date(b.created_at);
              }

              return aIsThinking ? 1 : -1;
            });

            // Проверяем, что первое сообщение действительно изменилось
            const newFirstMessage = sorted[0];
            const oldFirstMessage = prevMessages[0];
            if (oldFirstMessage && newFirstMessage && newFirstMessage.id === oldFirstMessage.id) {
              console.warn(`[loadGroupMessages] ПРЕДУПРЕЖДЕНИЕ: Первое сообщение не изменилось после подгрузки! Возможно, бэкенд вернул те же сообщения.`);
            }

            return sorted;
          });
        } else {
          // При первой загрузке
          // Сохраняем локальные thinking сообщения при загрузке с сервера
          updateMessagesForConversation(conversationId, (prevMessages) => {
            // Фильтруем временные сообщения пользователя (temp_*), чтобы избежать дублирования
            const filteredServerMessages = (messagesData || []).filter(msg => {
              // Исключаем временные сообщения, которые начинаются с "temp_"
              return !(typeof msg.id === 'string' && msg.id.startsWith('temp_'));
            });

            // КРИТИЧНО: Если есть ответы от агента в загруженных сообщениях, удаляем thinking сообщения
            const hasAgentResponses = filteredServerMessages.some(
              msg => !msg.is_from_user && msg.content && msg.content.trim().length > 0
            );

            // Фильтруем локальные thinking сообщения
            // Если есть ответы от агента, НЕ сохраняем thinking сообщения
            const localThinkingMessages = hasAgentResponses
              ? []
              : prevMessages.filter(
                (msg) => msg.is_thinking === true || msg.state === "thinking"
              );

            // Фильтруем временные сообщения пользователя (с состоянием "sending")
            const tempUserMessages = prevMessages.filter(
              (msg) => msg.state === "sending" && msg.is_from_user
            );

            // Объединяем серверные сообщения с локальными thinking
            const mergedMessages = [...messagesData, ...localThinkingMessages];

            // КРИТИЧНО: Thinking сообщения всегда должны быть в КОНЦЕ списка
            return mergedMessages.sort((a, b) => {
              const aIsThinking =
                a.is_thinking === true || a.state === "thinking";
              const bIsThinking =
                b.is_thinking === true || b.state === "thinking";

              // Если оба или ни один не думает, сортируем по времени
              if (aIsThinking === bIsThinking) {
                return new Date(a.created_at) - new Date(b.created_at);
              }

              // Thinking сообщения всегда в конце
              return aIsThinking ? 1 : -1;
            });
          });
        }

        // Обновляем превью последнего сообщения после загрузки с сервера
        if (messagesData && messagesData.length > 0 && !isOlderLoad) {
          const lastMessage = messagesData[messagesData.length - 1];
          if (lastMessage && lastMessage.content) {
            updateConversationPreviewOnly(
              conversationId,
              lastMessage.content,
              lastMessage.is_from_user
            );
          }
        }
      } catch (error) {
        console.error("Failed to load group messages:", error);
        if (error.message === "Unauthorized") {
          setError("Сессия истекла. Пожалуйста, войдите снова.");
          forceLogout();
        } else {
          setError(error.message);
        }
      } finally {
        setIsLoading(false);
      }
    },
    [forceLogout, updateMessagesForConversation, updateConversationPreviewOnly]
  );

  // Функция для подгрузки старых сообщений обычных чатов и групп при скролле вверх
  // Подгружает по 10000 символов за раз, может вызываться многократно
  const loadOlderMessages = useCallback(
    async (conversationId, { maxChars = 10000 } = {}) => {
      try {
        // Получаем актуальные сообщения через функцию, чтобы избежать проблем с замыканием
        const getCurrentMessages = () => messagesByConversation[conversationId] || [];
        const currentMessages = getCurrentMessages();

        // Находим самое старое загруженное сообщение (первое в списке, так как сообщения отсортированы от старых к новым)
        const oldestMessage = currentMessages.length > 0 ? currentMessages[0] : null;
        const storedOldest =
          oldestMessageTimestampRef.current[conversationId] ||
          oldestMessage?.created_at ||
          null;
        const beforeDate = storedOldest;

        if (!beforeDate) {
          console.warn(`[loadOlderMessages] Нет beforeDate для чата ${conversationId}, пропускаем подгрузку`);
          return;
        }

        // Проверяем, не достигли ли мы уже конца истории для этого чата
        if (reachedHistoryEndRef.current[conversationId]) {
          console.log(`[loadOlderMessages] Уже достигнут конец истории для чата ${conversationId}, пропускаем`);
          return;
        }

        // Определяем, является ли это групповым чатом
        const conversation = conversations.find(c => c.id === conversationId) ||
          (activeConversation?.id === conversationId ? activeConversation : null);
        const isGroupChat = conversation?.is_group === true;

        const beforeLength = currentMessages.length;
        // Уменьшаем частоту логирования для улучшения производительности
        if (process.env.NODE_ENV === 'development') {
          console.log(`[loadOlderMessages] Подгружаем старые сообщения ${isGroupChat ? 'группы' : 'чата'} ${conversationId}, beforeDate=${beforeDate}, maxChars=${maxChars}, текущее количество: ${beforeLength}`);
        }

        if (isGroupChat) {
          // Для групп используем loadGroupMessages с лимитом 10000 символов
          // Передаем beforeDate для правильной последовательности
          await loadGroupMessages(conversationId, { beforeDate, maxChars: 10000, isOlderLoad: true });
        } else {
          // Для обычных чатов используем loadMessages с лимитом 10000 символов
          // Передаем beforeDate для правильной последовательности
          await loadMessages(conversationId, { beforeDate, maxChars: 10000, isOlderLoad: true });
        }

        // Проверяем, добавились ли новые сообщения
        // Используем несколько попыток для проверки обновления state
        let afterMessages = getCurrentMessages();
        let afterLength = afterMessages.length;
        let attempts = 0;
        const MAX_STATE_CHECK_ATTEMPTS = 5;

        while (attempts < MAX_STATE_CHECK_ATTEMPTS && afterLength === beforeLength) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          afterMessages = getCurrentMessages();
          afterLength = afterMessages.length;
          attempts++;
        }

        const addedCount = afterLength - beforeLength;

        if (addedCount > 0) {
          const newOldestMessage = afterMessages[0];
          // Уменьшаем логирование в production
          if (process.env.NODE_ENV === 'development') {
            console.log(`[loadOlderMessages] ✅ Добавлено ${addedCount} новых старых сообщений, теперь всего: ${afterLength}`);
            console.log(`[loadOlderMessages] Самое старое сообщение: ID=${newOldestMessage?.id}, дата=${newOldestMessage?.created_at}`);
          }

          // Проверяем, что первое сообщение действительно изменилось
          if (oldestMessage && newOldestMessage && newOldestMessage.id === oldestMessage.id) {
            console.error(`[loadOlderMessages] ❌ КРИТИЧЕСКАЯ ОШИБКА: Первое сообщение не изменилось после подгрузки ${addedCount} сообщений!`);
            console.error(`[loadOlderMessages] Это означает, что новые сообщения добавились, но не в начало списка. Проверьте логику сортировки.`);
          } else {
            const currentOldest = afterMessages[0];
            // Уменьшаем логирование в production
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[loadOlderMessages] ⚠️ Новые сообщения не добавились (было: ${beforeLength}, стало: ${afterLength})`);
              if (currentOldest) {
                console.warn(`[loadOlderMessages] Текущее самое старое сообщение: ID=${currentOldest.id}, дата=${currentOldest.created_at}`);
                console.warn(`[loadOlderMessages] beforeDate был: ${beforeDate}`);

                // Если первое сообщение не изменилось и beforeDate был правильным, значит достигнут край истории
                if (currentOldest.id === oldestMessage?.id && currentOldest.created_at === beforeDate) {
                  console.warn(`[loadOlderMessages] Достигнут край истории - нет более старых сообщений`);
                  // Отмечаем, что достигли конца истории для этого чата
                  reachedHistoryEndRef.current[conversationId] = true;
                } else {
                  console.error(`[loadOlderMessages] ❌ ПРОБЛЕМА: beforeDate не совпадает с датой первого сообщения или первое сообщение изменилось, но новые не добавились!`);
                }
              } else {
                if (process.env.NODE_ENV === 'development') {
                  console.error(`[loadOlderMessages] ❌ КРИТИЧЕСКАЯ ОШИБКА: Нет сообщений в чате после подгрузки!`);
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to load older messages:", error);
        setError(error.message);
      }
    },
    [messagesByConversation, loadMessages, loadGroupMessages, conversations, activeConversation]
  );

  // Продолжить диалог между агентами в групповом чате
  const continueGroupDialogue = useCallback(async (conversationId) => {
    // КРИТИЧНО: Сохраняем conversationId в замыкании
    const targetConversationId = conversationId;

    // Объявляем tempMessageId перед try блоком, чтобы она была доступна в catch
    let tempMessageId = null;

    try {
      setIsLoading(true);

      // 📬 КРИТИЧНО: Для кнопки "продолжить диалог" счетчик ВСЕГДА должен увеличиваться,
      // потому что это автоматическая генерация БЕЗ сообщения пользователя.
      // Пользователь просто нажал кнопку, но не отправил сообщение,
      // поэтому новые сообщения от агентов должны считаться непрочитанными.
      // Передаем is_chat_active = false, чтобы счетчик увеличивался.
      const isChatActive = false;

      // Создаем временное состояние сообщения для мгновенной обратной связи
      tempMessageId = messageStateManager.createMessageState();

      // Получаем информацию об агентах группы для создания thinking сообщения
      const groupConversation = conversations.find(
        (conv) => conv.id === targetConversationId
      );
      const groupAgentIds = groupConversation?.group_agent_ids || [];

      // Получаем информацию об агентах с сервера
      let agents = [];
      try {
        agents = await apiClient.getAgents();
      } catch (error) {
        console.error(
          "Failed to get agents for continue dialogue thinking:",
          error
        );
      }

      // Создаем thinking сообщение для первого агента группы (или можно определить логику выбора)
      // Пока создаем для всех агентов, как в sendGroupMessage
      const thinkingMessages = groupAgentIds.map((agentId) => {
        const agent = agents.find((a) => a.id === agentId);
        const agentName = agent ? agent.name : `Агент ${agentId}`;

        return {
          id: `thinking_continue_${tempMessageId}_${agentId}`,
          content: "",
          is_from_user: false,
          created_at: new Date().toISOString(),
          conversation_id: targetConversationId,
          agent_id: agentId,
          agent_name: agentName,
          state: "thinking",
          is_thinking: true,
        };
      });

      // Добавляем thinking сообщения в локальное состояние
      if (thinkingMessages.length > 0) {
        updateMessagesForConversation(targetConversationId, (prev) => [
          ...prev,
          ...thinkingMessages,
        ]);
      }

      // 📬 Передаем is_chat_active = false, чтобы счетчик увеличивался
      const response = await apiClient.continueGroupDialogue(targetConversationId, null, isChatActive);

      // Обновляем состояние сообщения на "отправлено"
      messageStateManager.setReceivedState(tempMessageId);

      // Обновляем сообщения после продолжения диалога
      await loadGroupMessages(targetConversationId);

      // Удаляем локальные thinking сообщения ПОСЛЕ загрузки ответов
      updateMessagesForConversation(targetConversationId, (prev) =>
        prev.filter(
          (m) => !String(m.id).startsWith(`thinking_continue_${tempMessageId}`)
        )
      );

      // 📬 КРИТИЧНО: Перезагружаем список чатов ПОСЛЕ загрузки сообщений
      // чтобы синхронизировать счетчики непрочитанных сообщений
      // Счетчик должен увеличиться, так как это автоматическая генерация без сообщения пользователя
      setTimeout(async () => {
        await loadConversations();
        await loadSystemChat();
      }, 500); // Небольшая задержка для завершения всех операций

      return response;
    } catch (error) {
      console.error("Failed to continue group dialogue:", error);

      // Устанавливаем состояние ошибки для временного сообщения (если оно было создано)
      if (tempMessageId) {
        messageStateManager.setErrorState(tempMessageId, error.message);

        // Удаляем thinking сообщения при ошибке
        const filterMessages = (prev) => {
          return prev.filter(function (m) {
            return !String(m.id).startsWith('thinking_continue_' + tempMessageId);
          });
        };
        updateMessagesForConversation(targetConversationId, filterMessages);
      }

      if (error.message === "Unauthorized") {
        setError("Сессия истекла. Пожалуйста, войдите снова.");
        forceLogout();
      } else {
        setError(error.message);
      }
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [conversations, messageStateManager, updateMessagesForConversation, setError, forceLogout, loadConversations, loadSystemChat]);

  // Переключить видимость системного чата
  const toggleSystemChatVisibility = async () => {
    try {
      const newHiddenState = !isSystemChatHidden;
      const userId = user?.id;

      if (!userId) {
        console.error("User ID not available");
        return;
      }

      // Обновляем состояние на сервере
      try {
        await apiClient.updateSystemChatVisibility(newHiddenState);
        console.log("Settings saved to server");
      } catch (error) {
        console.log("Server update failed, using localStorage:", error);
        // Fallback: сохраняем в localStorage если сервер недоступен
        try {
          localStorage.setItem(
            `isSystemChatHidden_${userId}`,
            JSON.stringify(newHiddenState)
          );
        } catch (localError) {
          console.error("Failed to save to localStorage:", localError);
        }
      }

      // Обновляем локальное состояние
      setIsSystemChatHidden(newHiddenState);

      console.log(
        "System chat visibility toggled:",
        newHiddenState ? "hidden" : "visible"
      );
    } catch (error) {
      console.error("Failed to update system chat visibility:", error);
    }
  };

  // ===== ЗАКРЕПЛЕННЫЕ СООБЩЕНИЯ =====

  // Загрузить закрепленные сообщения для разговора
  const loadPinnedMessages = async (conversationId) => {
    try {
      // Определяем тип чата
      const conversation = conversations.find(
        (conv) => String(conv.id) === String(conversationId)
      );
      const isGroupChat = conversation?.is_group || (typeof conversationId === 'string' && conversationId.startsWith('group-'));

      let pinnedMessagesData = [];
      if (isGroupChat) {
        // Извлекаем числовой ID для группового чата
        const numericId = typeof conversationId === 'string'
          ? conversationId.replace(/^(group-|channel-|conv-)/, '')
          : conversationId;
        pinnedMessagesData = await apiClient.getPinnedGroupMessages(
          numericId
        );
      } else {
        pinnedMessagesData = await apiClient.getPinnedMessages(conversationId);
      }

      // Обновляем состояние закрепленных сообщений
      setPinnedMessages((prev) => ({
        ...prev,
        [conversationId]: pinnedMessagesData || [],
      }));
    } catch (error) {
      console.error("Failed to load pinned messages:", error);
      // Устанавливаем пустой массив в случае ошибки
      setPinnedMessages((prev) => ({
        ...prev,
        [conversationId]: [],
      }));
    }
  };

  // Закрепить сообщение в чате
  const pinMessageInChat = async (conversationId, messageId) => {
    try {
      console.log(
        "Pinning message:",
        messageId,
        "in conversation:",
        conversationId
      );

      // Определяем тип чата
      const conversation = conversations.find(
        (conv) => conv.id === conversationId
      );
      const isGroupChat = conversation?.is_group;

      if (isGroupChat) {
        await apiClient.pinGroupMessage(conversationId, messageId);
      } else {
        await apiClient.pinMessage(conversationId, messageId);
      }

      // Перезагружаем закрепленные сообщения
      await loadPinnedMessages(conversationId);

      console.log("Message pinned successfully");
    } catch (error) {
      console.error("Failed to pin message in chat:", error);
      throw error;
    }
  };

  // Открепить сообщение от чата
  const unpinMessageFromChat = async (conversationId, messageId) => {
    try {
      console.log(
        "Unpinning message:",
        messageId,
        "from conversation:",
        conversationId
      );

      // Определяем тип чата
      const conversation = conversations.find(
        (conv) => conv.id === conversationId
      );
      const isGroupChat = conversation?.is_group;

      if (isGroupChat) {
        await apiClient.unpinSpecificGroupMessage(conversationId, messageId);
      } else {
        await apiClient.unpinSpecificMessage(conversationId, messageId);
      }

      // Перезагружаем закрепленные сообщения
      await loadPinnedMessages(conversationId);

      console.log("Message unpinned successfully");
    } catch (error) {
      console.error("Failed to unpin message from chat:", error);
      throw error;
    }
  };

  // Прокрутить к сообщению
  const scrollToMessage = async (conversationId, messageId) => {
    try {
      console.log(
        "Scrolling to message:",
        messageId,
        "in conversation:",
        conversationId
      );

      // Находим сообщение в текущих сообщениях
      const message = messages.find((msg) => msg.id === messageId);
      if (message) {
        // Если сообщение уже загружено, можно добавить логику прокрутки
        // Пока просто логируем
        console.log("Message found in current messages:", message);
      } else {
        // Если сообщение не найдено, возможно нужно перезагрузить сообщения
        console.log("Message not found in current messages, reloading...");
        if (conversationId === activeConversation?.id) {
          if (activeConversation.is_group) {
            await loadGroupMessages(conversationId);
          } else {
            await loadMessages(conversationId);
          }
        }
      }
    } catch (error) {
      console.error("Failed to scroll to message:", error);
      throw error;
    }
  };

  // Проверить, является ли чат новым пустым (не должен показываться в списке)
  const isNewlyCreatedEmptyChat = useCallback((conversationId) => {
    // Проверяем, есть ли чат в списке новых пустых
    if (!newlyCreatedEmptyChatsRef.current.has(conversationId)) {
      return false;
    }

    // Дополнительно проверяем, действительно ли чат пустой
    const messagesCount = messagesByConversation[conversationId]?.length ?? 0;
    const pinnedCount = pinnedMessages[conversationId]?.length ?? 0;

    // Если есть сообщения, убираем из списка отслеживания
    if (messagesCount > 0 || pinnedCount > 0) {
      newlyCreatedEmptyChatsRef.current.delete(conversationId);
      return false;
    }

    return true;
  }, [messagesByConversation, pinnedMessages]);

  const value = {
    conversations,
    hasLoadedConversations, // Флаг: разговоры были загружены
    systemChat,
    activeConversation,
    messages,
    isLoading,
    error,
    pinnedChats,
    pinnedMessages,
    isSystemChatHidden,
    showUpgradeModal,
    upgradeModalReason,
    setShowUpgradeModal,
    checkMessageLimit,
    loadConversations,
    loadSystemChat,
    loadPinnedChats,
    toggleSystemChatVisibility,
    createChat,
    createGroupChat,
    getGroupChats,
    deleteGroupChat,
    sendMessage,
    sendGroupMessage,
    loadMessages,
    loadGroupMessages,
    continueGroupDialogue,
    selectConversation,
    deleteConversation,
    renameConversation,
    clearConversationMessages,
    clearAllConversations,
    pinMessage,
    unpinMessage,
    deleteMessage,
    getConversation,
    messageStateManager, // Добавляем менеджер состояний сообщений
    handleThinkingComplete, // Обработка завершения состояния "думает"
    handleThinkingError, // Обработка ошибки состояния "думает"
    getConversationsByAgent,
    pinChat,
    unpinChat,
    isChatPinned,
    // Закрепление чатов в папках
    pinChatInFolder,
    unpinChatFromFolder,
    togglePinChatInFolder,
    getPinnedChatsInFolder,
    // Закрепление чатов в системных папках
    getPinnedChatsInSystemFolder,
    pinChatInSystemFolder,
    unpinChatFromSystemFolder,
    isChatPinnedInSystemFolder,
    togglePinChatInSystemFolder,
    // Функции для работы с закрепленными сообщениями
    loadPinnedMessages,
    pinMessageInChat,
    unpinMessageFromChat,
    scrollToMessage,
    // Функции для работы с непрочитанными сообщениями
    unreadCounts,
    incrementUnreadCount,
    resetUnreadCount,
    getUnreadCount,
    // Функция для обновления сообщений конкретного чата
    updateMessagesForConversation,
    // Функция для проверки новых пустых чатов
    isNewlyCreatedEmptyChat,
    // Mock-функция для демонстрации
    simulateIncomingMessage,
    // Состояние загрузки чата
    isChatLoading,
    chatReady,
    // Каналы
    channels,
    isChannelsLoading,
    channelsError,
    loadChannels,
    subscribeToChannel,
    unsubscribeFromChannel,
    loadChannelMessages,
    loadOlderChannelMessages,
    publishChannelMessage,
    // Подгрузка старых сообщений для обычных чатов и групп
    loadOlderMessages,
    // Функция для получения сообщений по ID разговора (для инструментов)
    getMessagesByConversationId,
  };

  return (
    <ChatsContext.Provider value={value}>{children}</ChatsContext.Provider>
  );
};
