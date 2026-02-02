import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
  useImperativeHandle,
  forwardRef,
} from "react";
import {
  MdSearch,
  MdClose,
  MdChat,
  MdGroup,
  MdGroups,
  MdDiversity3,
  MdPeopleAlt,
  MdEmojiPeople,
  MdConnectWithoutContact,
  MdInterpreterMode,
  MdPushPin,
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
  MdTheaterComedy,
  MdStarBorder,
  MdLocalFireDepartment,
  MdDiamond,
  MdBookmark,
  MdMenu,
} from "react-icons/md";
import { FaPeopleGroup } from "react-icons/fa6";
import { RiTeamFill } from "react-icons/ri";
import { PiHandsClappingDuotone } from "react-icons/pi";
import { TbUserCog } from "react-icons/tb";
import { useChats } from "../../contexts/ChatsContext";
import { useAgents } from "../../contexts/AgentsContext";
import { useFolders } from "../../contexts/FoldersContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatTime } from "../../utils/formatters";
import apiClient from "../../services/api";
import { getAgentAvatarUrl, getGroupChatAvatarUrl } from "../../utils/agentAvatarUtils";
import RecentChatsHorizontalScroll from "../search/RecentChatsHorizontalScroll";
import ChatItem from "../chat/ChatItem";

const SearchWithAvatar = forwardRef(
  ({ onSearchToggle, sidebarRef, onChatSelect, currentChatId, onMenuClick }, ref) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState("chats"); // 'chats' or 'messages'
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [searchedMessages, setSearchedMessages] = useState([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [searchScope, setSearchScope] = useState("all"); // 'all' or 'current'
    const [wasOpenedFromChat, setWasOpenedFromChat] = useState(false); // Флаг открытия из чата
    const searchContainerRef = useRef(null);

    const { conversations, systemChat, selectConversation, activeConversation } =
      useChats();
    const { getAgent, agents } = useAgents();
    const { pinnedChats } = useFolders();
    const { t, translateAgent } = useLanguage();

    // Expose methods to parent component
    useImperativeHandle(ref, () => ({
      openSearch: (tab = "messages") => {
        setIsSearchOpen(true);
        setActiveTab(tab);
        if (currentChatId) {
          setSearchScope("current");
          setWasOpenedFromChat(true); // Устанавливаем флаг открытия из чата
        }
        onSearchToggle?.(true);
      },
    }));

    const handleSearchClick = () => {
      setIsSearchOpen(true);
      // При обычном открытии поиска ничего не меняем
      onSearchToggle?.(true);
    };

    // Функция закрытия поиска с очисткой состояния
    const closeSearch = useCallback(() => {
      setIsSearchOpen(false);
      onSearchToggle?.(false);
      setSearchQuery("");
      setWasOpenedFromChat(false); // Сбрасываем флаг при закрытии
    }, [onSearchToggle]);

    // Обработка клавиши Escape
    useEffect(() => {
      const handleEscape = (e) => {
        if (e.key === "Escape" && isSearchOpen) {
          closeSearch();
        }
      };

      if (isSearchOpen) {
        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
      }
    }, [isSearchOpen, closeSearch]);

    // Обработка клика вне области поиска
    useEffect(() => {
      const handleClickOutside = (event) => {
        if (
          isSearchOpen &&
          searchContainerRef.current &&
          !searchContainerRef.current.contains(event.target) &&
          sidebarRef?.current &&
          !sidebarRef.current.contains(event.target)
        ) {
          closeSearch();
        }
      };

      if (isSearchOpen) {
        document.addEventListener("mousedown", handleClickOutside);
        return () =>
          document.removeEventListener("mousedown", handleClickOutside);
      }
    }, [isSearchOpen, closeSearch, sidebarRef]);

    // Вкладки поиска
    const searchTabs = useMemo(() => [
      { id: "chats", label: t("chat.chats"), icon: MdChat },
      { id: "messages", label: t("chat.messages"), icon: MdGroup },
    ], [t]);

    // Обработка выбора чата
    const handleChatSelect = async (conversation) => {
      // Используем переданную функцию onChatSelect для обновления activeChatId в App.jsx
      if (onChatSelect) {
        await onChatSelect(conversation.id);
      } else {
        // Fallback к старому способу если onChatSelect не передан
        await selectConversation(conversation.id);
      }
      closeSearch();
    };

    // Обработка выбора агента из библиотеки
    const handleAgentSelect = async (agent) => {
      // Создаем новый чат с выбранным агентом
      if (onChatSelect) {
        // Передаем ID агента для создания нового чата
        await onChatSelect(`agent-${agent.id}`);
      }
      closeSearch();
    };

    // Поиск сообщений через API
    const searchMessages = useCallback(
      async (query) => {
        if (!query.trim()) {
          setSearchedMessages([]);
          return;
        }

        setIsLoadingMessages(true);
        try {
          let response;

          // Если поиск по текущему чату и есть ID чата
          if (searchScope === "current" && currentChatId) {
            response = await apiClient.searchMessagesInConversation(
              currentChatId,
              query,
              75,
              "all",
              "relevance"
            );
          } else {
            // Поиск по всем чатам
            response = await apiClient.searchMessages(query, 75, "relevance");
          }

          if (response && response.results) {
            setSearchedMessages(response.results);
          }
        } catch (error) {
          console.error("Ошибка поиска сообщений:", error);
          setSearchedMessages([]);
        } finally {
          setIsLoadingMessages(false);
        }
      },
      [searchScope, currentChatId]
    );

    // Дебаунс для поиска сообщений
    useEffect(() => {
      if (activeTab === "messages" && searchQuery.trim()) {
        const timeoutId = setTimeout(() => {
          searchMessages(searchQuery);
        }, 300);

        return () => clearTimeout(timeoutId);
      } else if (activeTab === "messages" && !searchQuery.trim()) {
        setSearchedMessages([]);
      }
    }, [searchQuery, activeTab, searchMessages]);

    // Обработка выбора сообщения (переход в чат)
    const handleMessageSelect = async (message) => {
      console.log("Message selected:", message);
      // Переходим в чат с сообщением И передаем ID сообщения для скролла
      if (onChatSelect) {
        await onChatSelect(message.conversation_id, message.id);
      } else {
        await selectConversation(message.conversation_id);
      }
      closeSearch();
    };

    const findConversationById = (conversationId) => {
      if (!conversationId) return null;

      if (systemChat && systemChat.id === conversationId) {
        return systemChat;
      }

      if (activeConversation && activeConversation.id === conversationId) {
        return activeConversation;
      }

      return conversations.find((conv) => conv.id === conversationId) || null;
    };

    // Получить название чата с номером (как в Sidebar)
    const getConversationTitleWithNumber = (message) => {
      if (!message) return t("common.chat");

      const conversation = findConversationById(message.conversation_id);
      if (conversation?.is_system_chat) {
        return conversation.title || t("chat.savedMessages");
      }

      if (message.is_channel || conversation?.is_channel) {
        return (
          message.conversation_title ||
          conversation?.title ||
          message.agent_name ||
          t("chat.channelTitleFallback", { defaultValue: "Канал" })
        );
      }

      if (!message.agent_id || !message.conversation_id) {
        if (message?.agent_name) {
          const agent = getAgent(message.agent_id);
          if (agent) {
            return translateAgent(agent).name;
          }
          return message.agent_name;
        }
        return t("common.chat");
      }

      // Находим агента для перевода
      const agent = getAgent(message.agent_id);
      if (!agent) {
        return message?.agent_name || t("common.chat");
      }

      const translatedAgent = translateAgent(agent);

      // Находим все чаты с этим агентом
      const allAgentConversations = conversations
        .filter((conv) => conv.agent_id === message.agent_id && !conv.is_group)
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // Находим индекс текущего чата
      const conversationIndex = allAgentConversations.findIndex(
        (c) => c.id === message.conversation_id
      );

      // Если чатов с агентом больше одного, добавляем номер
      if (allAgentConversations.length > 1 && conversationIndex !== -1) {
        return `${translatedAgent.name} (${conversationIndex + 1})`;
      }

      return translatedAgent.name;
    };

    // Получить название текущего чата для переключателя
    const getCurrentChatTitle = () => {
      if (!currentChatId) return t("chat.thisChat");

      const currentConv = findConversationById(currentChatId);
      if (!currentConv) return t("chat.thisChat");

      if (currentConv.is_system_chat) {
        return currentConv.title || t("chat.savedMessages");
      }

      if (currentConv.is_channel) {
        return (
          currentConv.title ||
          currentConv.channel_description ||
          t("chat.channelTitleFallback", { defaultValue: "Канал" })
        );
      }

      const agent = getAgent(currentConv.agent_id);
      if (!agent) return currentConv.title || t("chat.thisChat");

      // Находим все чаты с этим агентом
      const allAgentConversations = conversations
        .filter(
          (conv) => conv.agent_id === currentConv.agent_id && !conv.is_group
        )
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      // Находим индекс текущего чата
      const conversationIndex = allAgentConversations.findIndex(
        (c) => c.id === currentChatId
      );

      // Если чатов с агентом больше одного, добавляем номер
      const translatedAgent = translateAgent(agent);
      if (allAgentConversations.length > 1 && conversationIndex !== -1) {
        return `${translatedAgent.name} (${conversationIndex + 1})`;
      }

      return translatedAgent.name;
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

    // Получить превью сообщения с контекстом вокруг найденного слова
    // ВАЖНО: text должен быть уже очищен через cleanMessageContent перед вызовом
    const getMessagePreviewWithContext = (text, query, maxLength = 120) => {
      if (!query.trim() || !text) return text;

      const textLower = text.toLowerCase();
      const queryLower = query.toLowerCase().trim();

      // Находим позицию найденного текста
      const queryIndex = textLower.indexOf(queryLower);

      if (queryIndex === -1) {
        // Если не нашли - возвращаем начало текста
        return text.length > maxLength
          ? text.substring(0, maxLength) + "..."
          : text;
      }

      const queryLength = query.length;

      // Для длинных запросов увеличиваем maxLength и уменьшаем контекст
      const isLongQuery = queryLength > 20;
      const adjustedMaxLength = isLongQuery
        ? Math.max(maxLength, queryLength + 40)
        : maxLength;
      const contextBefore = isLongQuery ? 20 : 30;
      const contextAfter = adjustedMaxLength - contextBefore - queryLength;

      // Вычисляем начальную позицию
      let startIndex = Math.max(0, queryIndex - contextBefore);

      // Если начинаем не с начала, ищем ближайший пробел для красивой обрезки
      if (startIndex > 0) {
        const spaceIndex = text.indexOf(" ", startIndex);
        if (spaceIndex !== -1 && spaceIndex < queryIndex) {
          startIndex = spaceIndex + 1;
        }
      }

      // Вычисляем конечную позицию
      let endIndex = Math.min(
        text.length,
        queryIndex + queryLength + contextAfter
      );

      // Если заканчиваем не в конце, ищем ближайший пробел для красивой обрезки
      if (endIndex < text.length) {
        const spaceIndex = text.lastIndexOf(" ", endIndex);
        if (spaceIndex > queryIndex + queryLength) {
          endIndex = spaceIndex;
        }
      }

      // Формируем итоговый текст
      let result = "";

      if (startIndex > 0) {
        result += "...";
      }

      result += text.substring(startIndex, endIndex);

      if (endIndex < text.length) {
        result += "...";
      }

      return result;
    };

    // Подсветка текста (голубой цвет как в Telegram)
    const highlightText = (text, query) => {
      if (!query.trim()) return text;

      // Экранируем специальные символы регулярных выражений
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`(${escapedQuery})`, "gi");
      const parts = text.split(regex);

      return parts.map((part, index) => {
        // Проверяем, является ли часть совпадением (четные индексы - совпадения)
        const isMatch = index % 2 === 1;

        return isMatch ? (
          <span
            key={index}
            className="text-[var(--accent)] font-medium"
            style={{ color: "var(--accent)" }}
          >
            {part}
          </span>
        ) : (
          part
        );
      });
    };

    // Обрезка текста
    const truncateText = (text, maxLength = 100) => {
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + "...";
    };

    // Функция для получения правильного названия чата (без префикса "чат с")
    const getChatDisplayName = (conversation) => {
      // Сначала пытаемся получить имя агента из контекста агентов
      if (conversation.agent_id) {
        const agent = getAgent(conversation.agent_id);
        if (agent && agent.name) {
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
              return t("common.character");
            case "tools":
              return t("common.tool");
            case "models":
              return t("common.model");
            default:
              return t("common.agent");
          }
        }
      }
      return t("common.agent");
    };

    // Функция для правильного склонения слов
    const getPluralForm = (count, word) => {
      if (count === 1) {
        if (word === "сообщение") return "сообщение"; // "1 сообщение"
        return word; // "1 чат", "1 группа", "1 агент"
      } else if (count >= 2 && count <= 4) {
        if (word === "чат") return "чата"; // "2 чата"
        if (word === "группа") return "группы"; // "2 группы"
        if (word === "агент") return "агента"; // "2 агента"
        if (word === "сообщение") return "сообщения"; // "2 сообщения"
        return word;
      } else {
        if (word === "чат") return "чатов"; // "5 чатов"
        if (word === "группа") return "групп"; // "5 групп"
        if (word === "агент") return "агентов"; // "5 агентов"
        if (word === "сообщение") return "сообщений"; // "5 сообщений"
        return word;
      }
    };

    // Функция для получения типа агента из объекта agent
    const getAgentTypeFromAgent = (agent) => {
      if (agent && agent.category) {
        switch (agent.category) {
          case "chats":
            return t("common.character");
          case "tools":
            return t("common.tool");
          case "models":
            return t("common.model");
          default:
            return t("common.agent");
        }
      }
      return t("common.agent");
    };

    // Функция для получения агентов по категории
    const getAgentsByCategory = (category) => {
      // Нормализуем запрос категории и учитываем синонимы
      const requested = (category || "").toLowerCase();
      const synonyms = {
        characters: ["characters", "character", "персонаж", "персонажи", "chats"],
        chats: ["chats", "characters", "character", "персонаж", "персонажи"],
        tools: ["tools", "инструменты"],
        models: ["models", "модели", "ai модели", "ai models"],
      };

      const accepted = new Set(synonyms[requested] || [requested]);

      // Поддерживаем категории с запятыми (например, "персонаж, политик")
      return agents.filter((agent) => {
        const cat = (agent.category || "").toLowerCase();

        // Проверяем точное совпадение
        if (accepted.has(cat)) {
          return true;
        }

        // Проверяем, содержит ли категория одну из искомых категорий (для категорий с запятыми)
        for (const acceptedCategory of accepted) {
          if (cat.includes(acceptedCategory)) {
            return true;
          }
        }

        return false;
      });
    };

    // Функция для получения React Icon компонента по имени
    const getIconComponent = (iconName) => {
      const iconMap = {
        star: MdStar,
        notifications: MdNotifications,
        work: MdWork,
        calculate: MdCalculate,
        translate: MdTranslate,
        wb_sunny: MdWbSunny,
        psychology: MdPsychology,
        auto_awesome: MdAutoAwesome,
        group: MdGroup,
        groups: MdGroups,
        group_add: PiHandsClappingDuotone,
        group_work: TbUserCog,
        diversity: MdDiversity3,
        people_alt: MdPeopleAlt,
        emoji_people: MdEmojiPeople,
        connect: MdConnectWithoutContact,
        interpreter: MdInterpreterMode,
        chat: MdChat,
        comedy: MdTheaterComedy,
        star_border: MdStarBorder,
        fire: MdLocalFireDepartment,
        diamond: MdDiamond,
        bookmark: MdBookmark,
        notifications_active: MdNotifications,
        push_pin: MdPushPin,
        fa_people_group: FaPeopleGroup,
        team_fill: RiTeamFill,
      };
      return iconMap[iconName] || MdStar;
    };

    const decodeHtmlEntities = (text) => {
      if (!text || typeof text !== "string") return "";
      return text
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&#x27;/g, "'");
    };

    // Функция для построения элементов списка чатов (аналогично Sidebar.jsx)
    const buildChatItems = (agent, folderType, pinnedChatsList = []) => {
      const agentConversations = conversations.filter(
        (conv) => conv.agent_id === agent.id && !conv.is_group
      );

      return agentConversations.map((conversation) => {
        const decodedMessage = conversation.last_message
          ? decodeHtmlEntities(conversation.last_message)
          : null;
        const preview = decodedMessage
          ? decodedMessage.substring(0, 50) +
          (decodedMessage.length > 50 ? "..." : "")
          : getAgentTypeFromAgent(agent);

        // Определяем номер чата на основе порядка создания (как в Sidebar.jsx)
        const allAgentConversations = conversations
          .filter((conv) => conv.agent_id === agent.id)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const conversationIndex = allAgentConversations.findIndex(
          (c) => c.id === conversation.id
        );

        const translatedAgent = translateAgent(agent);
        const title =
          allAgentConversations.length > 1
            ? `${translatedAgent.name} (${conversationIndex + 1})`
            : translatedAgent.name;

        return {
          id: conversation.id.toString(),
          title: title, // Используем название с номером чата
          time: formatTime(conversation.updated_at || conversation.created_at),
          preview: preview,
          colorClass: agent.color_class || "bg-[var(--accent)]",
          iconName: agent.icon_name || "psychology",
          imageSrc: getAgentAvatarUrl(agent.image_url, agent.avatar_url, "low"),
          unreadCount: 0,
          agentId: agent.id,
          conversationId: conversation.id,
          hasConversation: true,
          isPinned: pinnedChatsList.includes(conversation.id.toString()),
        };
      });
    };

    // Функция для получения всех чатов (аналогично chatData из Sidebar.jsx)
    const getAllChatItems = useMemo(() => {
      // Проверяем, что pinnedChats определен
      const safePinnedChats = pinnedChats || [];

      const chatsAgents = getAgentsByCategory("chats");
      const charactersAgents = getAgentsByCategory("characters");

      // Получаем групповые чаты
      const groupChats = conversations.filter((conv) => conv.is_group);
      const sortedGroupChats = groupChats.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at) -
          new Date(a.updated_at || a.created_at)
      );
      const groupChatItems = sortedGroupChats.map((conversation) => {
        const agentNames =
          conversation.group_agent_ids
            ?.map((agentId) => {
              const agent = agents.find((a) => a.id === agentId);
              return agent ? agent.name : `Агент ${agentId}`;
            })
            .join(", ") || "";

        return {
          id: conversation.id.toString(),
          title: conversation.title,
          time: formatTime(conversation.updated_at || conversation.created_at),
          preview:
            agentNames ||
            `Групповой чат с ${conversation.group_agent_ids?.length || 0
            } участниками`,
          colorClass: "bg-[var(--accent)]",
          iconName: conversation.group_avatar || "group",
          imageSrc: getGroupChatAvatarUrl(conversation.group_avatar_url), // Используем загруженный аватар, если есть
          unreadCount: 0,
          agentId: null,
          conversationId: conversation.id,
          hasConversation: true,
          isGroup: true,
          groupAvatar: conversation.group_avatar || "group",
          isPinned: safePinnedChats.includes(conversation.id.toString()),
        };
      });

      const channelConversations = conversations.filter(
        (conv) => conv.is_channel
      );
      const sortedChannelConversations = channelConversations.sort(
        (a, b) =>
          new Date(b.updated_at || b.created_at) -
          new Date(a.updated_at || a.created_at)
      );
      const channelItems = sortedChannelConversations.map((conversation) => {
        const description =
          conversation.channel_description ||
          t("library.channelReadOnly", { defaultValue: "Только чтение" });
        const agentPayload = conversation.agent || null;
        const resolvedAgent =
          agentPayload ||
          agents.find((agent) => agent.id === conversation.agent_id) ||
          (conversation.agent_id ? getAgent(conversation.agent_id) : null) ||
          null;
        const channelAvatar =
          conversation.imageSrc ||
          conversation.channel_avatar_url ||
          getAgentAvatarUrl(resolvedAgent?.image_url, resolvedAgent?.avatar_url, "low");
        const colorClass =
          conversation.colorClass ||
          conversation.color_class ||
          resolvedAgent?.color_class ||
          "bg-blue-500";
        const iconName =
          conversation.iconName ||
          resolvedAgent?.icon_name ||
          "notifications";

        return {
          id: conversation.id.toString(),
          title:
            conversation.title ||
            conversation.channel_description ||
            `${t("chat.channelTitleFallback", {
              defaultValue: "Канал",
            })} #${conversation.id}`,
          time: formatTime(conversation.updated_at || conversation.created_at),
          preview: description,
          colorClass,
          iconName,
          imageSrc: channelAvatar,
          unreadCount: 0,
          agentId: null,
          conversationId: conversation.id,
          hasConversation: true,
          isChannel: true,
          is_channel: true,
          can_write: Boolean(conversation.can_write),
          isPinned: safePinnedChats.includes(conversation.id.toString()),
          channel_description: conversation.channel_description || "",
        };
      });

      // Собираем всех агентов
      const allAgents = [
        ...chatsAgents,
        ...charactersAgents,
      ];
      const uniqueAgents = allAgents.filter(
        (agent, index, self) =>
          index === self.findIndex((a) => a.id === agent.id)
      );

      // Получаем все чаты
      const allChatItems = [
        ...uniqueAgents.flatMap((agent) =>
          buildChatItems(agent, "all", safePinnedChats)
        ),
        ...groupChatItems,
        ...channelItems,
      ];

      // Сортируем по времени
      const sortedAllChats = allChatItems.sort((a, b) => {
        const convA = conversations.find((c) => c.id.toString() === a.id);
        const convB = conversations.find((c) => c.id.toString() === b.id);

        const timeA = new Date(convA?.updated_at || convA?.created_at || 0);
        const timeB = new Date(convB?.updated_at || convB?.created_at || 0);
        return timeB - timeA;
      });

      return sortedAllChats;
    }, [conversations, agents, pinnedChats]);

    // Функция для фильтрации чатов по поисковому запросу с приоритизацией
    const getFilteredChats = useMemo(() => {
      if (!searchQuery.trim()) return { chats: [], groups: [] };

      const query = searchQuery.trim();
      const queryLower = query.toLowerCase();

      const allChatItems = getAllChatItems;

      // Добавляем релевантность к каждому элементу
      const itemsWithRelevance = allChatItems.map((chatItem) => {
        let relevance = 0;

        // 1. Точное совпадение с учетом регистра - высший приоритет
        if (chatItem.title?.includes(query)) {
          if (chatItem.title.startsWith(query)) {
            relevance += 100; // Начало названия
          } else {
            relevance += 90; // Обычное точное вхождение
          }
        }

        if (chatItem.preview?.includes(query)) {
          if (chatItem.preview.startsWith(query)) {
            relevance += 95; // Начало превью
          } else {
            relevance += 85; // Обычное точное вхождение
          }
        }

        // 2. Совпадение без учета регистра
        if (chatItem.title?.toLowerCase().includes(queryLower)) {
          if (chatItem.title.toLowerCase().startsWith(queryLower)) {
            relevance += 80; // Начало названия
          } else {
            relevance += 70; // Обычное вхождение
          }
        }

        if (chatItem.preview?.toLowerCase().includes(queryLower)) {
          if (chatItem.preview.toLowerCase().startsWith(queryLower)) {
            relevance += 75; // Начало превью
          } else {
            relevance += 65; // Обычное вхождение
          }
        }

        // 3. Поиск по имени агента
        if (chatItem.agentId) {
          const agent = getAgent(chatItem.agentId);
          if (agent) {
            if (agent.name.includes(query)) {
              relevance += 60; // Точное совпадение имени агента
            } else if (agent.name.toLowerCase().includes(queryLower)) {
              relevance += 50; // Совпадение без учета регистра
            }
          }
        }

        return { ...chatItem, relevance };
      });

      // Фильтруем только релевантные элементы и сортируем по релевантности
      const filteredItems = itemsWithRelevance
        .filter((item) => item.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);

      // Разделяем на чаты и группы
      const chats = filteredItems.filter((item) => !item.isGroup);
      const groups = filteredItems.filter((item) => item.isGroup);

      return { chats, groups };
    }, [searchQuery, getAllChatItems, getAgent]);

    // Функция для фильтрации агентов по поисковому запросу с приоритизацией
    const getFilteredAgents = useMemo(() => {
      if (!searchQuery.trim()) {
        return agents; // Показываем всех агентов, если нет поискового запроса
      }

      const query = searchQuery.trim();
      const queryLower = query.toLowerCase();

      // Добавляем релевантность к каждому агенту
      const agentsWithRelevance = agents.map((agent) => {
        let relevance = 0;

        // 1. Точное совпадение имени с учетом регистра - высший приоритет
        if (agent.name?.includes(query)) {
          if (agent.name.startsWith(query)) {
            relevance += 100; // Начало имени
          } else {
            relevance += 90; // Обычное точное вхождение
          }
        }

        // 2. Совпадение имени без учета регистра
        if (agent.name?.toLowerCase().includes(queryLower)) {
          if (agent.name.toLowerCase().startsWith(queryLower)) {
            relevance += 80; // Начало имени
          } else {
            relevance += 70; // Обычное вхождение
          }
        }

        // 3. Поиск по описанию
        if (agent.description?.includes(query)) {
          relevance += 60; // Точное совпадение в описании
        } else if (agent.description?.toLowerCase().includes(queryLower)) {
          relevance += 50; // Совпадение без учета регистра
        }

        // 4. Поиск по категории
        if (agent.category?.includes(query)) {
          relevance += 40; // Точное совпадение категории
        } else if (agent.category?.toLowerCase().includes(queryLower)) {
          relevance += 30; // Совпадение без учета регистра
        }

        return { ...agent, relevance };
      });

      // Фильтруем только релевантных агентов и сортируем по релевантности
      return agentsWithRelevance
        .filter((agent) => agent.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance);
    }, [searchQuery, agents]);

    const containerClasses = `flex flex-col w-full ${isSearchOpen ? "flex-1 min-h-0" : ""
      }`;

    return (
      <div ref={searchContainerRef} className={containerClasses}>
        <div
          className="p-4 border-b border-[var(--border-color)] flex-shrink-0 select-none w-full flex items-center gap-2"
          onClick={(e) => e.stopPropagation()}
        >
          {onMenuClick && (
            <button
              className="p-2 rounded-lg text-[var(--text-gray)] hover:bg-[var(--hover-bg)] transition-colors"
              onClick={onMenuClick}
            >
              <MdMenu className="text-3xl" />
            </button>
          )}
          <div className="relative flex-1">
            <svg
              stroke="currentColor"
              fill="currentColor"
              strokeWidth="0"
              viewBox="0 0 24 24"
              className="search-icon absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-gray)] text-xl transition-all duration-300 z-[1]"
              height="1em"
              width="1em"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"></path>
            </svg>
            <input
              id="header-search"
              name="search"
              className="search-input w-full rounded-lg pl-10 pr-10 py-2.5 text-base text-[var(--text-white)] select-text focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-opacity-80 transition-all duration-300 group"
              style={{
                boxShadow: '0 0 0 0px transparent',
              }}
              placeholder={t("common.searchPlaceholderShort")}
              autoComplete="off"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={(e) => {
                e.target.style.boxShadow = '0 0 20px rgba(64, 224, 208, 0.4)';
                setIsSearchOpen(true);
                onSearchToggle?.(true);
              }}
              onBlur={(e) => {
                e.target.style.boxShadow = '0 0 0 0px transparent';
              }}
              autoFocus={isSearchOpen}
            />
            {isSearchOpen && (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  closeSearch();
                }}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--text-dim)] hover:text-[var(--text-white)] transition-all duration-300"
              >
                <MdClose className="text-lg search-close-btn" />
              </button>
            )}
          </div>
        </div>

        {/* Вкладки - зафиксированы вместе с полем поиска */}
        {isSearchOpen && (
          <div
            className="flex border-b border-[var(--border-color)] bg-[var(--bg-secondary)] flex-shrink-0 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {searchTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center py-3 px-4 text-sm font-medium transition-colors ${activeTab === tab.id
                      ? "text-[var(--accent)] border-b-2 border-[var(--accent)]"
                      : "text-[var(--text-dim)] hover:text-[var(--text-white)]"
                    }`}
                >
                  <Icon className="mr-2 text-lg" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Переключатель области поиска (только при открытии из чата через лупу) */}
        {isSearchOpen &&
          activeTab === "messages" &&
          currentChatId &&
          wasOpenedFromChat && (
            <div
              className="flex items-center gap-2 px-3 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border-color)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setSearchScope("all")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${searchScope === "all"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-dim)] hover:bg-[var(--button-hover-bg)]"
                  }`}
              >
                {t("common.allChats")}
              </button>
              <button
                onClick={() => setSearchScope("current")}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${searchScope === "current"
                    ? "bg-[var(--accent)] text-white"
                    : "bg-[var(--bg-tertiary)] text-[var(--text-dim)] hover:bg-[var(--button-hover-bg)]"
                  }`}
              >
                {getCurrentChatTitle()}
              </button>
            </div>
          )}

        {/* Панель результатов поиска */}
        {isSearchOpen && (
          <div
            className="flex-1 min-h-0 overflow-y-auto bg-[var(--bg-secondary)] w-full"
            onClick={(e) => e.stopPropagation()}
          >
            {searchQuery.trim() ? (
              <div className="w-full h-full">
                {/* Результаты поиска чатов */}
                {activeTab === "chats" && (
                  <div className="w-full h-full">
                    {/* Секция чатов */}
                    {getFilteredChats.chats.length > 0 && (
                      <>
                        <div className="flex items-center justify-between mb-3 w-full px-3 pt-3">
                          <h3 className="text-sm font-medium text-[var(--text-dim)]">
                            Чаты
                          </h3>
                          <span className="text-xs text-[var(--text-dim)]">
                            {getFilteredChats.chats.length}{" "}
                            {getPluralForm(
                              getFilteredChats.chats.length,
                              "чат"
                            )}
                          </span>
                        </div>
                        <div className="space-y-1 mb-4 w-full">
                          {getFilteredChats.chats.map((chatItem) => (
                            <ChatItem
                              key={chatItem.id}
                              id={chatItem.id}
                              title={chatItem.title}
                              time={chatItem.time}
                              preview={chatItem.preview}
                              colorClass={chatItem.colorClass}
                              iconName={chatItem.iconName}
                              imageSrc={chatItem.imageSrc}
                              isSelected={false}
                              unreadCount={chatItem.unreadCount}
                              onClick={() => handleChatSelect(chatItem)}
                              agentId={chatItem.agentId}
                              conversationId={chatItem.conversationId}
                              hasConversation={chatItem.hasConversation}
                              isGroup={chatItem.isGroup}
                              groupAvatar={chatItem.groupAvatar}
                              isPinned={chatItem.isPinned}
                              isChannel={chatItem.is_channel || chatItem.isChannel || false}
                              canWriteChannel={chatItem.can_write || chatItem.canWrite || false}
                              channelDescription={
                                chatItem.channel_description ||
                                chatItem.channelDescription ||
                                ""
                              }
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Секция групп */}
                    {getFilteredChats.groups.length > 0 && (
                      <>
                        <div className="flex items-center justify-between mb-3 w-full px-3">
                          <h3 className="text-sm font-medium text-[var(--text-dim)]">
                            Группы
                          </h3>
                          <span className="text-xs text-[var(--text-dim)]">
                            {getFilteredChats.groups.length}{" "}
                            {getPluralForm(
                              getFilteredChats.groups.length,
                              "группа"
                            )}
                          </span>
                        </div>
                        <div className="space-y-1 w-full pb-3">
                          {getFilteredChats.groups.map((chatItem) => (
                            <ChatItem
                              key={chatItem.id}
                              id={chatItem.id}
                              title={chatItem.title}
                              time={chatItem.time}
                              preview={chatItem.preview}
                              colorClass={chatItem.colorClass}
                              iconName={chatItem.iconName}
                              imageSrc={chatItem.imageSrc}
                              isSelected={false}
                              unreadCount={chatItem.unreadCount}
                              onClick={() => handleChatSelect(chatItem)}
                              agentId={chatItem.agentId}
                              conversationId={chatItem.conversationId}
                              hasConversation={chatItem.hasConversation}
                              isGroup={chatItem.isGroup}
                              groupAvatar={chatItem.groupAvatar}
                              isPinned={chatItem.isPinned}
                              isChannel={chatItem.is_channel || chatItem.isChannel || false}
                              canWriteChannel={chatItem.can_write || chatItem.canWrite || false}
                              channelDescription={
                                chatItem.channel_description ||
                                chatItem.channelDescription ||
                                ""
                              }
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {/* Секция поиска в библиотеке */}
                    {getFilteredAgents.length > 0 && (
                      <>
                        <div className="flex items-center justify-between mb-3 w-full px-3">
                          <h3 className="text-sm font-medium text-[var(--text-dim)]">
                            {t("common.searchInLibrary")}
                          </h3>
                        </div>

                        <div className="space-y-1 w-full pb-3">
                          {getFilteredAgents.map((agent) => {
                            const IconComponent = agent.icon_name
                              ? getIconComponent(agent.icon_name)
                              : null;

                            return (
                              <div key={agent.id} className="relative w-full">
                                <div
                                  className="has-ripple relative flex items-center w-full h-16 px-1.5 py-1.5 chat-item select-none"
                                  onClick={() => handleAgentSelect(agent)}
                                >
                                  <div className="flex-shrink-0 mr-3">
                                    {(() => {
                                      const avatarUrl = getAgentAvatarUrl(agent.image_url, agent.avatar_url, "low");
                                      return avatarUrl ? (
                                        <img
                                          src={avatarUrl}
                                          alt={agent.name}
                                          className="w-12 h-12 rounded-full object-cover shadow-md select-none"
                                          onError={(e) => {
                                            console.warn("Failed to load agent avatar:", avatarUrl);
                                            e.target.style.display = "none";
                                          }}
                                        />
                                      ) : null;
                                    })()}
                                    {!getAgentAvatarUrl(agent.image_url, agent.avatar_url, "low") && (
                                      <div
                                        className={`w-12 h-12 rounded-full ${agent.color_class ||
                                          "bg-[var(--accent)]"
                                          } flex items-center justify-center text-white shadow-md select-none`}
                                      >
                                        {IconComponent ? (
                                          <IconComponent
                                            style={{
                                              fontSize: "26px",
                                              transform: "scale(0.8)",
                                            }}
                                          />
                                        ) : (
                                          <span className="text-lg font-semibold">
                                            {agent.name.charAt(0).toUpperCase()}
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex-1 min-w-0 w-full">
                                    <div className="flex justify-between items-center mb-0.5 w-full">
                                      <p className="flex-1 min-w-0 truncate text-base font-semibold text-[var(--text-white)]">
                                        {agent.name}
                                      </p>
                                      <p className="text-[12px] text-[var(--text-gray)]">
                                        {agent.category === "chats"
                                          ? t("common.character")
                                          : agent.category === "work"
                                            ? t("common.work")
                                            : agent.category === "system"
                                              ? t("common.system")
                                              : agent.category === "favorites"
                                                ? t("common.favorites")
                                                : t("common.agent")}
                                      </p>
                                    </div>
                                    <div className="flex items-center justify-between w-full">
                                      <div className="flex items-center flex-1 min-w-0 w-full">
                                        <p className="flex-1 min-w-0 text-[13px] truncate text-[var(--text-gray)]">
                                          {agent.description ||
                                            "AI агент для общения"}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {/* Сообщение если ничего не найдено */}
                    {getFilteredChats.chats.length === 0 &&
                      getFilteredChats.groups.length === 0 &&
                      getFilteredAgents.length === 0 && (
                        <div className="text-center py-8 text-[var(--text-dim)] px-3 pb-3">
                          <MdChat className="mx-auto text-4xl mb-3" />
                          <p>Чаты не найдены</p>
                        </div>
                      )}
                  </div>
                )}

                {/* Результаты сообщений */}
                {activeTab === "messages" && (
                  <div className="w-full h-full">
                    {isLoadingMessages ? (
                      <div className="text-center py-8 text-[var(--text-dim)] px-3">
                        <div className="animate-spin mx-auto w-8 h-8 border-4 border-[var(--accent)] border-t-transparent rounded-full mb-3"></div>
                        <p>{t("common.searchingMessages")}</p>
                      </div>
                    ) : searchedMessages.length > 0 ? (
                      <>
                        <div className="flex items-center justify-between mb-3 w-full px-3 pt-3">
                          <h3 className="text-sm font-medium text-[var(--text-dim)]">
                            Сообщения
                          </h3>
                          <span className="text-xs text-[var(--text-dim)]">
                            {searchedMessages.length}{" "}
                            {getPluralForm(
                              searchedMessages.length,
                              "сообщение"
                            )}
                          </span>
                        </div>
                        <div className="space-y-1 w-full pb-3">
                          {searchedMessages.map((message) => {
                            const iconName = message.is_group
                              ? (message.group_avatar || "group")
                              : (message.agent_icon || "psychology");
                            const IconComponent = getIconComponent(iconName);

                            return (
                              <div
                                key={message.id}
                                className="has-ripple relative flex items-center w-full h-16 px-1.5 py-1.5 chat-item select-none cursor-pointer hover:bg-[var(--bg-tertiary)]"
                                onClick={() => handleMessageSelect(message)}
                              >
                                <div className="flex-shrink-0 mr-3">
                                  {message.agent_avatar ? (
                                    <img
                                      src={getAgentAvatarUrl(message.agent_avatar, null, "low")}
                                      alt={message.agent_name}
                                      className="w-12 h-12 rounded-full object-cover shadow-md select-none"
                                    />
                                  ) : (
                                    message.is_group ? (
                                      <div className="relative w-12 h-12 rounded-full overflow-hidden shadow-md select-none">
                                        <div
                                          className="absolute inset-0 bg-center bg-cover"
                                          style={{
                                            backgroundImage:
                                              "url('/images/agents/Under_Icon_Groups.png')",
                                          }}
                                          aria-hidden="true"
                                        />
                                        <div className="absolute inset-0 flex items-center justify-center text-white">
                                          {IconComponent && (
                                            <IconComponent
                                              style={{
                                                fontSize: "26px",
                                                transform: "scale(0.8)",
                                              }}
                                            />
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className={`w-12 h-12 rounded-full ${message.agent_color || "bg-[var(--accent)]"
                                          } flex items-center justify-center text-white shadow-md select-none`}
                                      >
                                        {IconComponent && (
                                          <IconComponent
                                            style={{
                                              fontSize: "26px",
                                              transform: "scale(0.8)",
                                            }}
                                          />
                                        )}
                                      </div>
                                    )
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 w-full">
                                  <div className="flex justify-between items-center mb-0.5 w-full">
                                    <p className="flex-1 min-w-0 truncate text-base font-semibold text-[var(--text-white)]">
                                      {getConversationTitleWithNumber(message)}
                                    </p>
                                  </div>
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex items-center flex-1 min-w-0 w-full">
                                      <p className="flex-1 min-w-0 text-[13px] text-[var(--text-gray)] line-clamp-1">
                                        {message.is_from_user && (
                                          <span className="text-[var(--accent)] mr-1">
                                            Вы:
                                          </span>
                                        )}
                                        {highlightText(
                                          getMessagePreviewWithContext(
                                            cleanMessageContent(message.content),
                                            searchQuery,
                                            searchQuery.length > 20 ? 200 : 120
                                          ),
                                          searchQuery
                                        )}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-8 text-[var(--text-dim)] px-3">
                        <MdGroup className="mx-auto text-4xl mb-3" />
                        <p>{t("chat.messagesNotFound")}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full">
                {/* Статичный список последних чатов когда нет поискового запроса */}
                {activeTab === "chats" && (
                  <RecentChatsHorizontalScroll
                    onChatSelect={handleChatSelect}
                  />
                )}

                {/* Пустое состояние для сообщений */}
                {activeTab === "messages" && (
                  <div className="text-center py-8 text-[var(--text-dim)] px-3">
                    <MdSearch className="mx-auto text-4xl mb-3" />
                    <p>{t("chat.enterQueryToSearchMessages")}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

export default SearchWithAvatar;
