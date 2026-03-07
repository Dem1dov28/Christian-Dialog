import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
} from "react";
import SearchWithAvatar from "../header/SearchWithAvatar";
import ChatList from "../chat/ChatList";
import AgentsLibrary from "../chat/AgentsLibrary";
import CharactersLibrary from "../chat/CharactersLibrary";
import { motion, AnimatePresence } from "framer-motion";
import { useSidebarUpdate } from "../../contexts/SidebarUpdateContext";
import { formatTime } from "../../utils/formatters";
// Импортируем нужные иконки из react-icons
import {
  MdForum,
  MdMemory,
  MdFolderOpen,
  MdFolder,
  MdHome,
  MdBusiness,
  MdWork,
  MdSchool,
  MdPerson,
  MdFavorite,
  MdStar,
  MdPsychology,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdAutoAwesome,
  MdNotifications,
  MdSportsEsports,
  MdMusicNote,
  MdMovie,
  MdRestaurant,
  MdShoppingCart,
  MdDirectionsCar,
  MdFlight,
  MdBeachAccess,
  MdPets,
  MdChildCare,
  MdScience,
  MdPalette,
  MdCode,
  MdSecurity,
  MdCloud,
  MdSmartToy,
  MdLocalHospital,
  MdAdd,
} from "react-icons/md";
import { FaTools } from "react-icons/fa";
import { useAgents } from "../../contexts/AgentsContext";
import { useChats } from "../../contexts/ChatsContext";
import { useFolders } from "../../contexts/FoldersContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { usePanelWidth } from "../../contexts/PanelWidthContext";
import { useIsMobile } from "../../hooks/common/use-mobile";
import ProfileScreen from "../profile/ProfileScreen";
import CreateFolderForm from "../chat/CreateFolderForm";
import DeleteFolderModal from "../chat/DeleteFolderModal";
import apiClient from "../../services/api";
import { getAgentAvatarUrl, getGroupChatAvatarUrl } from "../../utils/agentAvatarUtils";

const Sidebar = ({
  onMenuClick,
  onChatSelect,
  onExplicitChatSwitch,
  onFolderChange,
  activeChatId,
  activeFolder,
  onOpenLibrary,
  onDeleteChat,
  onOpenFolderManager,
  // ChatActions callbacks
  onPinToTop,
  onDeleteAgent,
  onUnsubscribeChannel,
  onHideChat,
  searchRef, // Ref для SearchWithAvatar
  onSearchClose,
  isFullWidth = false,
  showProfile = false,
  profileScreenProps,
}) => {
  const isMobileViewport = useIsMobile();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { updateTrigger } = useSidebarUpdate();
  const sidebarRef = useRef(null);
  const { t, translateAgent } = useLanguage();

  // Состояние для отслеживания выбранной модели (для показа истории чатов)
  // Состояние для отображения библиотек
  const [isAgentsLibraryOpen, setIsAgentsLibraryOpen] = useState(false);
  const [isCharactersLibraryOpen, setIsCharactersLibraryOpen] = useState(false);

  const handleSearchToggle = (isOpen) => {
    setIsSearchOpen(isOpen);
    if (!isOpen) onSearchClose?.();
  };

  // Состояние для хранения предыдущей папки (для возврата назад)
  const [previousFolder, setPreviousFolder] = useState("religion");

  // Получаем данные из контекстов ДО определения обработчиков, которые их используют
  const { agents, getAgentsByCategory, getAgent, getUserAgents } = useAgents();
  const {
    conversations,
    systemChat,
    activeConversation,
    pinnedChats,
    pinChatInFolder,
    unpinChatFromFolder,
    getPinnedChatsInFolder,
    // Функции для системных папок
    getPinnedChatsInSystemFolder,
    pinChatInSystemFolder,
    unpinChatFromSystemFolder,
    isChatPinnedInSystemFolder,
    togglePinChatInSystemFolder,
    isSystemChatHidden,
    // Функции для непрочитанных сообщений
    getUnreadCount,
    resetUnreadCount,
    // Функция для создания чата
    createChat,
    selectConversation,
    subscribeToChannel,
    loadChannels,
    // Функция для проверки новых пустых чатов
    isNewlyCreatedEmptyChat,
  } = useChats();

  // Слушаем события открытия библиотек
  useEffect(() => {
    const handleOpenAgentsLibrary = () => {
      setIsAgentsLibraryOpen(true);
    };
    const handleOpenCharactersLibrary = () => {
      setIsCharactersLibraryOpen(true);
    };

    window.addEventListener("aigram:open-agents-library", handleOpenAgentsLibrary);
    window.addEventListener("aigram:open-characters-library", handleOpenCharactersLibrary);

    return () => {
      window.removeEventListener("aigram:open-agents-library", handleOpenAgentsLibrary);
      window.removeEventListener("aigram:open-characters-library", handleOpenCharactersLibrary);
    };
  }, []);

  // Обработчики закрытия библиотек
  const handleCloseAgentsLibrary = useCallback(() => {
    setIsAgentsLibraryOpen(false);
  }, []);

  const handleCloseCharactersLibrary = useCallback(() => {
    setIsCharactersLibraryOpen(false);
  }, []);

  const handleAgentAdded = useCallback(
    async (agentId) => {
      console.log("Agent added to library:", agentId);
      try {
        // Ищем существующий чат с этим агентом
        const existingChat = conversations.find(
          (conv) => conv.agent_id === agentId && !conv.is_group && !conv.is_channel
        );

        if (existingChat) {
          // Если чат существует, просто открываем его
          await selectConversation(existingChat.id);
          if (onChatSelect) {
            onChatSelect(existingChat.id);
          }
        } else {
          // Если чата нет, создаем новый чат с агентом
          const newConversation = await createChat(agentId, true);
          if (newConversation?.id) {
            // createChat уже установил activeConversation и activeConversationRef
            // selectConversation пропустится (чат уже активен), вызываем onChatSelect для синхронизации activeChatId
            await selectConversation(newConversation.id);
            if (onChatSelect) {
              onChatSelect(newConversation.id);
            }
          }
        }
      } catch (error) {
        console.error("Failed to create chat for agent:", error);
      }
    },
    [conversations, createChat, selectConversation, onChatSelect]
  );

  const handleCharacterAdded = useCallback(
    async (characterId) => {
      console.log("Character added to library:", characterId);
      // Не создаем чат автоматически при добавлении персонажа в библиотеку
      // Чат будет создан только когда пользователь явно начнет разговор
    },
    []
  );

  const [forceUpdate, setForceUpdate] = useState(0);
  const [systemFolderOrder, setSystemFolderOrder] = useState(null);
  const [hiddenSystemFoldersVersion, setHiddenSystemFoldersVersion] = useState(0);
  const [pinnedChatsInCurrentFolder, setPinnedChatsInCurrentFolder] = useState(
    []
  );

  // Загружаем добавленные агенты/персонажи/инструменты из localStorage
  const [addedAgents, setAddedAgents] = useState(() => {
    try {
      const saved = localStorage.getItem("addedAgents");
      const parsed = saved ? JSON.parse(saved) : [];
      // Нормализуем ID к строкам для корректного сравнения
      return Array.isArray(parsed) ? parsed.map(id => String(id)) : [];
    } catch {
      return [];
    }
  });
  const [addedCharacters, setAddedCharacters] = useState(() => {
    try {
      const saved = localStorage.getItem("addedCharacters");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  // УДАЛЕНО - addedTools (инструменты были удалены)

  // Используем контекст для управления шириной панели
  const { sidebarWidth, updateSidebarWidth, MIN_WIDTH, MAX_WIDTH } = usePanelWidth();

  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const containerRef = useRef(null);

  // Обработчик подписки на канал (должен быть после useChats)
  const handleChannelSubscribe = useCallback(async (channelId) => {
    if (subscribeToChannel) {
      try {
        await subscribeToChannel(channelId);
        // Обновляем список каналов после подписки
        if (loadChannels) {
          loadChannels();
        }
      } catch (error) {
        console.error("Failed to subscribe to channel:", error);
      }
    }
  }, [subscribeToChannel, loadChannels]);


  // Загрузить закрепленные чаты в текущей папке
  const loadPinnedChatsInFolder = async (folderId) => {
    // Системные папки используют localStorage
    const systemFolders = [
      "all",
      "chats",
      "religion",
      "science",
      "politics",
      "philosophy",
      "inventions",
      "art",
      "literature",
      "business",
    ];

    // Проверяем, является ли папка системной (по строковому ID)
    const folderIdStr = String(folderId || "");
    const isSystemFolder = !folderId ||
      (typeof folderId === 'string' && systemFolders.includes(folderId)) ||
      (typeof folderId === 'number' && false); // Числовые ID - это всегда пользовательские папки

    if (isSystemFolder) {
      // Для системных папок загружаем из localStorage
      const pinnedChats = getPinnedChatsInSystemFolder(folderId || "all");
      setPinnedChatsInCurrentFolder(pinnedChats);
      return;
    }

    // Для пользовательских папок (числовой ID) загружаем через API
    const numericFolderId = typeof folderId === 'number' ? folderId : Number(folderId);

    if (!isNaN(numericFolderId) && numericFolderId > 0) {
      try {
        const pinnedChats = await getPinnedChatsInFolder(numericFolderId);
        setPinnedChatsInCurrentFolder(pinnedChats);
      } catch (error) {
        console.error("Failed to load pinned chats in folder:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response,
          status: error.response?.status,
          data: error.response?.data
        });
        setPinnedChatsInCurrentFolder([]);
      }
    } else {
      console.warn("Invalid folder ID for loading pinned chats:", folderId);
      setPinnedChatsInCurrentFolder([]);
    }
  };

  // Ref для защиты от множественных вызовов создания чата
  const creatingModelChatRef = useRef(new Set());


  // Обновление списка после изменения conversations
  useEffect(() => {
    // Форсим обновление компонента при изменении списка чатов
    setForceUpdate((prev) => prev + 1);
  }, [conversations]);

  // Фильтруем группы и каналы из conversations
  const groups = conversations.filter((conv) => conv.is_group || conv.isGroup);
  const channels = conversations.filter((conv) => conv.is_channel || conv.isChannel);
  const { folders, getChatsByFolder, reorderFolders, loadFolders, updateFolder, deleteFolder } =
    useFolders();

  // Состояние для редактирования папки
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingFolder, setEditingFolder] = useState(null);

  // Состояние для модального окна удаления папки
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState(null);

  // Убираем автоматическую перезагрузку папок при изменении чатов
  // Это предотвращает бесконечный цикл ошибок аутентификации
  // Папки загружаются только при инициализации и при явном вызове loadFolders()

  // Функция для получения типа системной папки по ID
  const getSystemFolderTypeById = useCallback((folderId) => {
    const systemFolderIds = ["chats", "religion", "science", "politics", "philosophy", "inventions", "art", "literature", "business"];
    if (systemFolderIds.includes(String(folderId))) {
      return String(folderId);
    }
    return null;
  }, []);

  // Обработчик скрытия системной папки
  const handleFolderHide = useCallback((folderId) => {
    try {
      const sysType = getSystemFolderTypeById(folderId);
      if (!sysType) return;

      // Находим папку в БД по типу (folder_type === "system" и имя соответствует типу)
      const folder = folders.find((f) => {
        if (!f || f.folder_type !== "system") return false;
        // Проверяем, соответствует ли имя папки нужному типу
        const nameMap = {
          [t("common.allChats")]: "chats",
          [t("common.characters")]: "characters",
          [t("common.tools")]: "tools",
          [t("common.models")]: "models",
          [t("library.channelsTitle", { defaultValue: "Каналы" })]: "channels",
          [t("common.allChats")]: "chats",
          [t("common.characters")]: "characters",
          [t("common.tools")]: "tools",
          [t("common.models")]: "models",
          [t("library.channelsTitle", { defaultValue: "Каналы" })]: "channels",
        };
        const folderSysType = nameMap[f.name] || null;
        return folderSysType === sysType;
      });

      if (folder) {
        // Сохраняем в БД через updateFolder(settings.hidden=true)
        updateFolder(folder.id, { settings: { hidden: true } }).catch(() => { });
      }

      // Сохраняем скрытую папку в localStorage
      const key = "hiddenSystemFolders";
      let hidden = [];
      try {
        const raw = localStorage.getItem(key);
        hidden = raw ? JSON.parse(raw) : [];
      } catch { }
      if (!hidden.includes(sysType)) hidden.push(sysType);
      try {
        localStorage.setItem(key, JSON.stringify(hidden));
      } catch { }

      // Сообщаем Sidebar об изменении
      try {
        window.dispatchEvent(new Event("aigram:hidden-system-folders-changed"));
      } catch { }
    } catch (error) {
      console.error("Failed to hide folder:", error);
    }
  }, [folders, updateFolder, getSystemFolderTypeById, t]);

  // Обработчик удаления пользовательской папки
  const handleFolderDelete = useCallback((folderId) => {
    const folder = folders.find((f) => f && f.id === folderId);
    if (folder) {
      setFolderToDelete(folder);
      setShowDeleteModal(true);
    }
  }, [folders]);

  // Подтверждение удаления папки
  const handleConfirmDeleteFolder = useCallback(async () => {
    if (!folderToDelete) return;

    try {
      await deleteFolder(folderToDelete.id);
      setShowDeleteModal(false);
      setFolderToDelete(null);
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  }, [folderToDelete, deleteFolder]);

  // Обработчик редактирования папки
  const handleFolderEdit = useCallback((folderId) => {
    const folder = folders.find((f) => f && f.id === folderId);
    if (folder) {
      setEditingFolder(folder);
      setShowEditForm(true);
    }
  }, [folders]);

  // Обработчик пометки всех чатов в папке как прочитанных
  const handleMarkAsRead = useCallback(async (folderId) => {
    try {
      const folderChats = getChatsByFolder(folderId, conversations);

      // Помечаем каждый чат как прочитанный
      for (const conversation of folderChats) {
        if (!conversation.id) continue;

        const isGroupChat = conversation.is_group || false;
        const isChannelChat = conversation.is_channel || false;

        if (!isChannelChat) {
          // Помечаем чат как прочитанный через API
          try {
            if (isGroupChat) {
              await apiClient.post(`/multi-agent-chat/${conversation.id}/mark-as-read`);
            } else {
              await apiClient.post(`/conversations/${conversation.id}/mark-as-read`);
            }

            // Обновляем локальный счетчик непрочитанных - сбрасываем его
            resetUnreadCount(conversation.id);
          } catch (err) {
            console.error("Failed to mark conversation as read:", err);
          }
        }
      }
    } catch (error) {
      console.error("Failed to mark folder as read:", error);
    }
  }, [getChatsByFolder, conversations, resetUnreadCount]);

  // Загружаем закрепленные чаты при изменении активной папки
  useEffect(() => {
    loadPinnedChatsInFolder(activeFolder);
  }, [activeFolder]);

  // Обработчики для закрепления в папках
  const handlePinInFolder = async ({ chatId, agentId, conversationId, folderId: explicitFolderId }) => {
    const systemFolders = [
      "all",
      "chats",
      "characters",
      "tools",
      "models",
      "agents",
      "channels",
    ];
    const targetConversationId = conversationId || chatId;
    if (!targetConversationId) {
      console.warn("handlePinInFolder: targetConversationId is missing", { chatId, agentId, conversationId });
      return;
    }

    // Используем явно переданный folderId, если он есть, иначе activeFolder
    const targetFolderId = explicitFolderId || activeFolder;
    const activeFolderStr = String(targetFolderId || "");

    console.log(`[Sidebar] handlePinInFolder: chatId=${targetConversationId}, explicitFolderId=${explicitFolderId}, activeFolder=${activeFolder}, targetFolderId=${targetFolderId}`);

    // Определяем тип папки: системная (строка из списка) или пользовательская (число)
    const isSystemFolder = !targetFolderId ||
      (typeof targetFolderId === 'string' && systemFolders.includes(targetFolderId)) ||
      (typeof targetFolderId === 'number' && false); // Числовые ID - это всегда пользовательские папки


    if (isSystemFolder) {
      // Для системных папок используем localStorage
      console.log(`[Sidebar] Pinning chat ${targetConversationId} in system folder: ${targetFolderId}`);
      pinChatInSystemFolder(targetFolderId || "all", targetConversationId);
      // Перезагружаем закрепленные чаты в папке
      await loadPinnedChatsInFolder(targetFolderId);
    } else {
      // Для пользовательских папок (числовой ID или числовая строка) используем API
      const folderId = typeof targetFolderId === 'number' ? targetFolderId : Number(targetFolderId);

      if (isNaN(folderId)) {
        console.error("handlePinInFolder: Invalid folder ID", { targetFolderId, folderId });
        return;
      }

      // Преобразуем targetConversationId в число для API
      const numericConversationId = typeof targetConversationId === 'number'
        ? targetConversationId
        : Number(targetConversationId);

      if (isNaN(numericConversationId)) {
        console.error("handlePinInFolder: Invalid conversation ID", { targetConversationId, numericConversationId });
        return;
      }

      try {
        await pinChatInFolder(folderId, numericConversationId);
        // Перезагружаем закрепленные чаты в папке
        await loadPinnedChatsInFolder(folderId);
      } catch (error) {
        console.error("Failed to pin chat in folder:", error);
        console.error("Error details:", {
          message: error.message,
          status: error.status,
          statusText: error.statusText,
          response: error.response || error.data,
          url: error.url,
          folderId,
          conversationId: numericConversationId,
          fullError: error
        });

        // Показываем более понятное сообщение пользователю
        if (error.status === 404) {
          console.error("404 error - возможно папка не найдена или принадлежит другому пользователю");
        } else if (error.status === 403) {
          console.error("403 error - доступ запрещен к этой папке");
        } else if (error.status === 401) {
          console.error("401 error - требуется авторизация");
        }
      }
    }
  };

  const handleUnpinFromFolder = async ({ chatId, agentId, conversationId, folderId: explicitFolderId }) => {
    const systemFolders = [
      "all",
      "chats",
      "characters",
      "tools",
      "models",
      "agents",
      "channels",
    ];
    const targetConversationId = conversationId || chatId;
    if (!targetConversationId) {
      console.warn("handleUnpinFromFolder: targetConversationId is missing", { chatId, agentId, conversationId });
      return;
    }

    // Используем явно переданный folderId, если он есть, иначе activeFolder
    const targetFolderId = explicitFolderId || activeFolder;
    const activeFolderStr = String(targetFolderId || "");

    console.log(`[Sidebar] handleUnpinFromFolder: chatId=${targetConversationId}, explicitFolderId=${explicitFolderId}, activeFolder=${activeFolder}, targetFolderId=${targetFolderId}`);

    // Определяем тип папки: системная (строка из списка) или пользовательская (число)
    const isSystemFolder = !targetFolderId ||
      (typeof targetFolderId === 'string' && systemFolders.includes(targetFolderId)) ||
      (typeof targetFolderId === 'number' && false); // Числовые ID - это всегда пользовательские папки


    if (isSystemFolder) {
      // Для системных папок используем localStorage
      console.log(`[Sidebar] Unpinning chat ${targetConversationId} from system folder: ${targetFolderId}`);
      unpinChatFromSystemFolder(targetFolderId || "all", targetConversationId);
      // Перезагружаем закрепленные чаты в папке
      await loadPinnedChatsInFolder(targetFolderId);
    } else {
      // Для пользовательских папок (числовой ID или числовая строка) используем API
      const folderId = typeof targetFolderId === 'number' ? targetFolderId : Number(targetFolderId);

      if (isNaN(folderId)) {
        console.error("handleUnpinFromFolder: Invalid folder ID", { targetFolderId, folderId });
        return;
      }

      // Преобразуем targetConversationId в число для API
      const numericConversationId = typeof targetConversationId === 'number'
        ? targetConversationId
        : Number(targetConversationId);

      if (isNaN(numericConversationId)) {
        console.error("handleUnpinFromFolder: Invalid conversation ID", { targetConversationId, numericConversationId });
        return;
      }

      try {
        await unpinChatFromFolder(folderId, numericConversationId);
        // Перезагружаем закрепленные чаты в папке
        await loadPinnedChatsInFolder(folderId);
      } catch (error) {
        console.error("Failed to unpin chat from folder:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response,
          status: error.response?.status,
          data: error.response?.data,
          folderId,
          conversationId: numericConversationId
        });
      }
    }
  };

  // Функция для получения иконки папки
  const getFolderIcon = (iconName) => {
    const iconMap = {
      folder: MdFolderOpen,
      home: MdHome,
      business: MdBusiness,
      work: MdWork,
      school: MdSchool,
      person: MdPerson,
      favorite: MdFavorite,
      star: MdStar,
      psychology: MdPsychology,
      calculate: MdCalculate,
      translate: MdTranslate,
      wb_sunny: MdWbSunny,
      auto_awesome: MdAutoAwesome,
      notifications: MdNotifications,
      sports: MdSportsEsports,
      music: MdMusicNote,
      movie: MdMovie,
      restaurant: MdRestaurant,
      shopping: MdShoppingCart,
      car: MdDirectionsCar,
      flight: MdFlight,
      beach: MdBeachAccess,
      pets: MdPets,
      child: MdChildCare,
      science: MdScience,
      palette: MdPalette,
      code: MdCode,
      security: MdSecurity,
      cloud: MdCloud,
      hospital: MdLocalHospital,
    };
    return iconMap[iconName] || MdFolderOpen;
  };

  // Отслеживаем изменения updateTrigger для обновления последних сообщений
  useEffect(() => {
    setForceUpdate((prev) => prev + 1);
  }, [updateTrigger]);

  // Слушаем событие скрытия/показа системных папок
  useEffect(() => {
    const handler = () => setHiddenSystemFoldersVersion((v) => v + 1);
    window.addEventListener("aigram:hidden-system-folders-changed", handler);
    return () => window.removeEventListener("aigram:hidden-system-folders-changed", handler);
  }, []);

  // Слушаем события обновления агентов/персонажей/инструментов для обновления списка чатов
  useEffect(() => {
    const loadAddedItems = () => {
      try {
        const savedAgents = localStorage.getItem("addedAgents");
        const savedCharacters = localStorage.getItem("addedCharacters");
        // УДАЛЕНО - savedTools (инструменты были удалены)
        if (savedAgents) {
          const parsed = JSON.parse(savedAgents);
          // Нормализуем ID к строкам для корректного сравнения
          setAddedAgents(Array.isArray(parsed) ? parsed.map(id => String(id)) : []);
        }
        if (savedCharacters) {
          const parsed = JSON.parse(savedCharacters);
          setAddedCharacters(Array.isArray(parsed) ? parsed.map(id => String(id)) : []);
        }
        setForceUpdate((prev) => prev + 1);
      } catch (error) {
        console.error("[Sidebar] Failed to load added items:", error);
      }
    };

    const handleAgentsUpdate = () => {
      console.log("[Sidebar] Agents updated, reloading from localStorage");
      loadAddedItems();
    };

    // Загружаем начальные значения
    loadAddedItems();

    window.addEventListener("aigram:agents-updated", handleAgentsUpdate);
    window.addEventListener("aigram:characters-updated", handleAgentsUpdate);

    return () => {
      window.removeEventListener("aigram:agents-updated", handleAgentsUpdate);
      window.removeEventListener("aigram:characters-updated", handleAgentsUpdate);
    };
  }, []);

  // После успешной загрузки папок из БД оставляем только БД как источник истины
  useEffect(() => {
    try {
      // Собираем скрытые системные папки из БД
      const hiddenFromDb = (folders || [])
        .filter((f) => f && f.folder_type === "system")
        .filter((f) => {
          try {
            const s = typeof f.settings === "string" ? JSON.parse(f.settings || "{}") : f.settings || {};
            return !!s.hidden;
          } catch {
            return false;
          }
        })
        .map((f) => {
          const name = f.name || "";
          if (/все/i.test(name)) return "chats";
          if (/персонаж/i.test(name)) return "characters";
          if (/инструмент/i.test(name)) return "tools";
          if (/модел/i.test(name)) return "models";
          return null;
        })
        .filter(Boolean);

      // Перезаписываем localStorage строго данными из БД (очищая кэш/расхождения)
      localStorage.setItem("hiddenSystemFolders", JSON.stringify(hiddenFromDb));
      // Тригерим локальный апдейт
      setHiddenSystemFoldersVersion((v) => v + 1);
    } catch { }
  }, [folders]);

  const getHiddenSystemFolders = () => {
    try {
      const raw = localStorage.getItem("hiddenSystemFolders");
      const parsed = raw ? JSON.parse(raw) : [];
      const ls = Array.isArray(parsed) ? parsed : [];

      // Мержим с данными из БД: скрытые системные папки приходят как обычные папки
      const hiddenFromDb = (folders || [])
        .filter((f) => f && f.folder_type === "system")
        .filter((f) => {
          try {
            const s = typeof f.settings === "string" ? JSON.parse(f.settings || "{}") : f.settings || {};
            return !!s.hidden;
          } catch {
            return false;
          }
        })
        .map((f) => {
          const name = f.name || "";
          if (/все/i.test(name)) return "chats";
          if (/религ/i.test(name)) return "religion";
          if (/наук/i.test(name)) return "science";
          if (/политик/i.test(name)) return "politics";
          if (/философ/i.test(name)) return "philosophy";
          if (/изобретен/i.test(name)) return "inventions";
          if (/искусств/i.test(name)) return "art";
          if (/литератур/i.test(name)) return "literature";
          if (/бизнес/i.test(name)) return "business";
          return null;
        })
        .filter(Boolean);

      return Array.from(new Set([...ls, ...hiddenFromDb]));
    } catch {
      return [];
    }
  };

  // Resize: mouse handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const delta = e.clientX - startXRef.current;
      const next = Math.min(
        MAX_WIDTH,
        Math.max(MIN_WIDTH, startWidthRef.current + delta)
      );
      // Используем updateSidebarWidth с флагом isManual=true
      updateSidebarWidth(next, true);
    };
    const handleMouseUp = () => {
      if (isResizing) setIsResizing(false);
    };
    if (isResizing) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing, MIN_WIDTH, MAX_WIDTH, updateSidebarWidth]);

  // Expose total left panel width (icons + resizable sidebar) via CSS variable
  useEffect(() => {
    const navIconsWidthPx = 80; // must match NavigationIcons container width
    const totalLeftWidth = Math.round(navIconsWidthPx + sidebarWidth);
    document.documentElement.style.setProperty(
      "--left-panel-width",
      `${totalLeftWidth}px`
    );
    // Сохранение в localStorage теперь происходит в PanelWidthContext
  }, [sidebarWidth]);

  /**
   * Декодирует HTML entities в тексте, сохраняя HTML-теги как текст
   * Это центральная функция для обработки last_message в списке чатов
   */
  const decodeHtmlEntities = (text) => {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/&amp;/g, "&")    // Декодируем &amp; в & (сначала!)
      .replace(/&lt;/g, "<")      // Декодируем &lt; в <
      .replace(/&gt;/g, ">")      // Декодируем &gt; в >
      .replace(/&quot;/g, '"')    // Декодируем &quot; в "
      .replace(/&#039;/g, "'")    // Декодируем &#039; в '
      .replace(/&#x27;/g, "'");   // Декодируем &#x27; в '
  };

  const buildListItems = (agent, category = null) => {
    // Получаем ID активного чата
    const activeConversationId = activeConversation?.id;

    const agentConversations = conversations.filter(
      (conv) => {
        // Показываем активный чат даже если он новый пустой
        if (conv.id === activeConversationId) {
          return conv.agent_id === agent.id;
        }
        // Фильтруем новые пустые чаты - они не должны показываться в списке (кроме активного)
        if (isNewlyCreatedEmptyChat(conv.id)) {
          return false;
        }
        return conv.agent_id === agent.id;
      }
    );

    // Если нет разговоров - не показываем плейсхолдер; чат отсутствует в списке
    if (agentConversations.length === 0) {
      return [];
    }

    // Возвращаем все разговоры с агентом, отсортированные по времени последнего сообщения
    const sortedConversations = agentConversations.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at) -
        new Date(a.updated_at || a.created_at)
    );

    return sortedConversations.map((conversation, index) => {
      const isLatest = index === 0;

      // Определяем название чата: используем сохраненное название или стандартное с номером
      const translatedAgent = translateAgent(agent);
      let title;

      // Проверяем, является ли название стандартным "Чат с ..." или "Chat with ..."
      const isDefaultTitle = conversation.title && (
        conversation.title.startsWith("Чат с ") ||
        conversation.title.startsWith("Chat with ")
      );

      if (conversation.title && conversation.title.trim() && !isDefaultTitle) {
        // Используем сохраненное название чата (переименованное пользователем)
        title = conversation.title;
      } else {
        // Fallback: используем стандартное название с номером
        // Определяем номер чата на основе порядка создания, а не текущей сортировки
        // Получаем все разговоры с агентом в порядке создания
        const allAgentConversations = conversations
          .filter((conv) => conv.agent_id === agent.id)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        const conversationIndex = allAgentConversations.findIndex(
          (c) => c.id === conversation.id
        );

        title =
          allAgentConversations.length > 1
            ? `${translatedAgent.name} (${conversationIndex + 1})`
            : translatedAgent.name;
      }

      // Декодируем HTML entities в last_message перед обрезкой
      const decodedMessage = conversation.last_message
        ? decodeHtmlEntities(conversation.last_message)
        : null;

      return {
        id: conversation.id.toString(), // Всегда используем conversation.id как строку
        title,
        time: formatTime(
          conversation.updated_at || conversation.created_at
        ),
        preview: decodedMessage
          ? decodedMessage.substring(0, 50) +
          (decodedMessage.length > 50 ? "..." : "")
          : translatedAgent.name,
        colorClass: agent.color_class || "bg-purple-500",
        iconName: agent.icon_name || "psychology",
        imageSrc: getAgentAvatarUrl(agent.image_url, agent.avatar_url, "low"),
        unreadCount: getUnreadCount(conversation.id),
        agentId: agent.id,
        conversationId: conversation.id,
        hasConversation: true,
      };
    });
  };

  // Функция для определения категорий персонажа (может возвращать несколько категорий)
  const getCharacterCategories = useCallback((agent) => {
    if (!agent || !agent.category) {
      return [];
    }

    const category = (agent.category || "").toLowerCase();
    const name = (agent.name || "").toLowerCase();
    const description = (agent.description || "").toLowerCase();
    const combined = `${category} ${name} ${description}`;

    const categories = [];

    // Религия
    if (
      category.includes("религия") || category.includes("религиоз") ||
      category.includes("religion") || category.includes("religious") ||
      category.includes("бог") || category.includes("божество") ||
      category.includes("god") || category.includes("deity") ||
      category.includes("пророк") || category.includes("prophet") ||
      category.includes("священнослужитель") || category.includes("priest") ||
      category.includes("папа") || category.includes("pope") ||
      category.includes("святой") || category.includes("saint") ||
      combined.includes("религия") || combined.includes("религиоз") ||
      combined.includes("бог") || combined.includes("божество") ||
      combined.includes("пророк") || combined.includes("святой") ||
      name.includes("иисус") || name.includes("мухаммед") ||
      name.includes("будда") || name.includes("исус") ||
      name.includes("jesus") || name.includes("muhammad") ||
      name.includes("buddha") || name.includes("моисей") ||
      name.includes("moses")
    ) {
      categories.push("religion");
    }

    // Наука
    if (
      category.includes("ученый") || category.includes("ученые") ||
      category.includes("scientist") || category.includes("scientists") ||
      category.includes("наука") || category.includes("science") ||
      category.includes("физик") || category.includes("physicist") ||
      category.includes("математик") || category.includes("mathematician") ||
      category.includes("химик") || category.includes("chemist") ||
      category.includes("биолог") || category.includes("biologist") ||
      category.includes("астроном") || category.includes("astronomer") ||
      category.includes("медик") || category.includes("physician") ||
      combined.includes("ученый") || combined.includes("ученые") ||
      combined.includes("наука") || combined.includes("science") ||
      combined.includes("физик") || combined.includes("математик") ||
      combined.includes("химик") || combined.includes("биолог") ||
      name.includes("эйнштейн") || name.includes("ньютон") ||
      name.includes("дарвин") || name.includes("тесла") ||
      name.includes("einstein") || name.includes("newton") ||
      name.includes("darwin") || name.includes("tesla")
    ) {
      categories.push("science");
    }

    // Политика
    if (
      category.includes("политик") || category.includes("politics") ||
      category.includes("правитель") || category.includes("правители") ||
      category.includes("ruler") || category.includes("rulers") ||
      category.includes("президент") || category.includes("president") ||
      category.includes("король") || category.includes("king") ||
      category.includes("император") || category.includes("emperor") ||
      category.includes("царь") || category.includes("tsar") ||
      category.includes("королева") || category.includes("queen") ||
      category.includes("министр") || category.includes("minister") ||
      category.includes("премьер") || category.includes("prime minister") ||
      combined.includes("политик") || combined.includes("politics") ||
      combined.includes("правитель") || combined.includes("президент") ||
      combined.includes("король") || combined.includes("император") ||
      combined.includes("царь") || combined.includes("королева") ||
      name.includes("путин") || name.includes("putin") ||
      name.includes("ленин") || name.includes("сталин") ||
      name.includes("lenin") || name.includes("stalin") ||
      name.includes("марк аврелий") || name.includes("marcus aurelius")
    ) {
      categories.push("politics");
    }

    // Философия
    if (
      category.includes("философ") || category.includes("философы") ||
      category.includes("philosopher") || category.includes("philosophers") ||
      category.includes("философия") || category.includes("philosophy") ||
      combined.includes("философ") || combined.includes("философы") ||
      combined.includes("философия") || combined.includes("philosopher") ||
      combined.includes("philosophy") ||
      name.includes("платон") || name.includes("сократ") ||
      name.includes("ницше") || name.includes("кант") ||
      name.includes("гегель") ||
      name.includes("plato") || name.includes("socrates") ||
      name.includes("nietzsche") || name.includes("kant") ||
      name.includes("hegel") || name.includes("марк аврелий") ||
      name.includes("marcus aurelius") || name.includes("аристотель") ||
      name.includes("aristotle")
    ) {
      categories.push("philosophy");
    }

    // Изобретения
    if (
      category.includes("изобретатель") || category.includes("inventor") ||
      category.includes("изобретение") || category.includes("invention") ||
      category.includes("инженер") || category.includes("engineer") ||
      category.includes("конструктор") || category.includes("designer") ||
      category.includes("техник") || category.includes("technician") ||
      combined.includes("изобретатель") || combined.includes("inventor") ||
      combined.includes("изобретение") || combined.includes("invention") ||
      combined.includes("инженер") || combined.includes("конструктор") ||
      name.includes("эдисон") || name.includes("бель") ||
      name.includes("ford") || name.includes("wright") ||
      name.includes("edison") || name.includes("bell") ||
      name.includes("ford") || name.includes("wright")
    ) {
      categories.push("inventions");
    }

    // Искусство
    if (
      category.includes("художник") || category.includes("artist") ||
      category.includes("писатель") || category.includes("writer") ||
      category.includes("поэт") || category.includes("poet") ||
      category.includes("музыкант") || category.includes("musician") ||
      category.includes("композитор") || category.includes("composer") ||
      category.includes("актер") || category.includes("actor") ||
      category.includes("режиссер") || category.includes("director") ||
      category.includes("литература") || category.includes("literature") ||
      category.includes("искусство") || category.includes("art") ||
      category.includes("живопись") || category.includes("painting") ||
      category.includes("скульптор") || category.includes("sculptor") ||
      combined.includes("художник") || combined.includes("писатель") ||
      combined.includes("поэт") || combined.includes("музыкант") ||
      combined.includes("композитор") || combined.includes("актер") ||
      combined.includes("режиссер") || combined.includes("литература") ||
      combined.includes("искусство") || combined.includes("творчество") ||
      combined.includes("artist") || combined.includes("writer") ||
      combined.includes("poet") || combined.includes("musician")
    ) {
      categories.push("art");
    }

    return categories;
  }, []);

  const chatData = useMemo(() => {
    const charactersAgents = getAgentsByCategory("characters"); // Все персонажи
    const createdAgents = getUserAgents(); // Пользовательские созданные агенты
    // Объединяем персонажей и созданных агентов для отображения чатов
    const allCharacterAgents = [...charactersAgents, ...createdAgents];

    // Получаем групповые чаты, отсортированные по времени последнего сообщения
    const groupChats = conversations.filter((conv) => conv.is_group);
    const sortedGroupChats = groupChats.sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at) -
        new Date(a.updated_at || a.created_at)
    );

    // Фильтруем групповые чаты с персонажами
    // Используем allCharacterAgents для проверки, является ли агент персонажем
    const charactersAgentIds = new Set(allCharacterAgents.map((agent) => agent.id));
    const characterGroupChats = sortedGroupChats.filter((conversation) => {
      if (!conversation.group_agent_ids || conversation.group_agent_ids.length === 0) {
        return false;
      }

      // Проверяем, что все агенты в группе являются персонажами
      // Используем charactersAgentIds для надежной проверки
      return conversation.group_agent_ids.every((agentId) =>
        charactersAgentIds.has(agentId)
      );
    });

    const groupChatItems = sortedGroupChats.map((conversation) => {
      // Получаем имена агентов группы
      const agentNames =
        conversation.group_agent_ids
          ?.map((agentId) => {
            const agent = agents.find((a) => a.id === agentId);
            return agent ? translateAgent(agent).name : t("chat.agent") + ` ${agentId}`;
          })
          .join(", ") || "";

      return {
        id: conversation.id.toString(), // Используем conversation.id как строку, как для обычных чатов
        title: conversation.title,
        time: formatTime(
          conversation.updated_at || conversation.created_at
        ),
        preview:
          agentNames ||
          t("chat.groupChatWithCount", { count: conversation.group_agent_ids?.length || 0 }),
        colorClass: "bg-purple-500",
        iconName: conversation.group_avatar || "group",
        imageSrc: getGroupChatAvatarUrl(conversation.group_avatar_url), // Используем загруженный аватар, если есть
        unreadCount: getUnreadCount(conversation.id),
        agentId: null,
        conversationId: conversation.id,
        hasConversation: true,
        isGroup: true,
        groupAvatar: conversation.group_avatar,
      };
    });

    const channelConversations = conversations.filter((conv) => conv.is_channel);
    const channelItems = channelConversations.map((conversation) => {
      const description =
        conversation.channel_description ||
        t("library.channelReadOnly", { defaultValue: "Только чтение" });

      const agentFromConversation = conversation.agent || null;
      const resolvedAgent =
        agentFromConversation ||
        agents.find((agent) => agent.id === conversation.agent_id) ||
        null;
      const channelAvatar =
        conversation.imageSrc ||
        conversation.channel_avatar_url ||
        getAgentAvatarUrl(resolvedAgent?.image_url, resolvedAgent?.avatar_url, "low");
      const colorClass =
        conversation.colorClass ||
        resolvedAgent?.color_class ||
        "bg-blue-500";
      const iconName =
        conversation.iconName || resolvedAgent?.icon_name || "notifications";

      return {
        id: conversation.id.toString(),
        title:
          conversation.title ||
          conversation.channel_description ||
          `Канал #${conversation.id}`,
        time: formatTime(
          conversation.updated_at || conversation.created_at
        ),
        preview: description,
        colorClass,
        iconName,
        imageSrc: channelAvatar,
        unreadCount: getUnreadCount(conversation.id),
        agentId: null,
        conversationId: conversation.id,
        hasConversation: true,
        isChannel: true,
        is_channel: true,
        can_write: Boolean(conversation.can_write),
        channel_description: conversation.channel_description || "",
      };
    });

    // Для папки "Все чаты" объединяем все чаты с персонажами и сортируем по времени последнего сообщения
    const allChatItems = [
      ...allCharacterAgents.flatMap((agent) => buildListItems(agent, "all")),
      ...groupChatItems,
      // Добавляем системный чат в общий список для сортировки
      ...(systemChat && !isSystemChatHidden
        ? [
          {
            id: systemChat.id.toString(),
            title: systemChat.title,
            time: formatTime(
              systemChat.updated_at || systemChat.created_at
            ),
            preview: (() => {
              const decoded = systemChat.last_message
                ? decodeHtmlEntities(systemChat.last_message)
                : null;
              return decoded
                ? decoded.substring(0, 50) + (decoded.length > 50 ? "..." : "")
                : t("chat.savedMessages");
            })(),
            colorClass: "bg-gray-500",
            iconName: "bookmark",
            imageSrc: "/images/agents/Saved_Messages.png",
            unreadCount: getUnreadCount(systemChat.id),
            agentId: null,
            conversationId: systemChat.id,
            hasConversation: true,
            isSystemChat: true,
          },
        ]
        : []),
    ];

    // Сортируем все чаты по времени последнего сообщения (включая системный чат)
    const sortedAllChats = allChatItems.sort((a, b) => {
      // Специальная обработка для системного чата
      if (a.isSystemChat) {
        const convB = conversations.find((c) => c.id.toString() === b.id);
        const timeA = new Date(
          systemChat?.updated_at || systemChat?.created_at || 0
        );
        const timeB = new Date(convB?.updated_at || convB?.created_at || 0);
        return timeB - timeA;
      }

      if (b.isSystemChat) {
        const convA = conversations.find((c) => c.id.toString() === a.id);
        const timeA = new Date(convA?.updated_at || convA?.created_at || 0);
        const timeB = new Date(
          systemChat?.updated_at || systemChat?.created_at || 0
        );
        return timeB - timeA;
      }

      // Обычная сортировка для остальных чатов
      const convA = conversations.find((c) => c.id.toString() === a.id);
      const convB = conversations.find((c) => c.id.toString() === b.id);

      const timeA = new Date(convA?.updated_at || convA?.created_at || 0);
      const timeB = new Date(convB?.updated_at || convB?.created_at || 0);
      return timeB - timeA; // Новые чаты сверху
    });

    // Разделяем закрепленные и незакрепленные чаты (включая системный чат в общую сортировку)
    const pinnedChatItems = pinnedChats
      .map((pinnedId) =>
        sortedAllChats.find((item) => item.id.toString() === pinnedId)
      )
      .filter(Boolean); // Убираем undefined значения
    const unpinnedChatItems = sortedAllChats.filter(
      (item) => !pinnedChats.includes(item.id.toString())
    );

    // Закрепленные чаты сортируются по порядку закрепления (последний закрепленный сверху), незакрепленные по времени
    // Объединяем: сначала закрепленные, потом незакрепленные (включая системный чат если он не закреплен)
    const finalSortedChats = [...pinnedChatItems, ...unpinnedChatItems];

    // Функция для создания данных категории персонажей
    const createCategoryData = (categoryId, categoryAgents) => {
      const categoryChats = categoryAgents.flatMap((agent) => buildListItems(agent, categoryId));

      // Групповые чаты с персонажами этой категории
      const categoryGroupChats = characterGroupChats
        .filter((conversation) => {
          return conversation.group_agent_ids?.some((agentId) => {
            const agent = agents.find((a) => a.id === agentId);
            return agent && getCharacterCategories(agent).includes(categoryId);
          });
        })
        .map((conversation) => {
          const agentNames =
            conversation.group_agent_ids
              ?.map((agentId) => {
                const agent = agents.find((a) => a.id === agentId);
                return agent ? translateAgent(agent).name : t("chat.agent") + ` ${agentId}`;
              })
              .join(", ") || "";

          return {
            id: conversation.id.toString(),
            title: conversation.title,
            time: formatTime(
              conversation.updated_at || conversation.created_at
            ),
            preview:
              agentNames ||
              t("chat.groupChatWithCount", { count: conversation.group_agent_ids?.length || 0 }),
            colorClass: "bg-purple-500",
            iconName: conversation.group_avatar || "group",
            imageSrc: getGroupChatAvatarUrl(conversation.group_avatar_url), // Используем загруженный аватар, если есть
            unreadCount: getUnreadCount(conversation.id),
            agentId: null,
            conversationId: conversation.id,
            hasConversation: true,
            isGroup: true,
            groupAvatar: conversation.group_avatar,
          };
        });

      const allCategoryChats = [...categoryChats, ...categoryGroupChats];
      return allCategoryChats.sort((a, b) => {
        const convA = conversations.find((c) => String(c.id) === String(a.id));
        const convB = conversations.find((c) => String(c.id) === String(b.id));
        if (!convA || !convB) return 0;
        return (
          new Date(convB.updated_at || convB.created_at) -
          new Date(convA.updated_at || convA.created_at)
        );
      });
    };

    // Фильтруем персонажей по категориям (персонаж может быть в нескольких категориях)
    const religionAgents = charactersAgents.filter((agent) => getCharacterCategories(agent).includes("religion"));
    const scienceAgents = charactersAgents.filter((agent) => getCharacterCategories(agent).includes("science"));
    const politicsAgents = charactersAgents.filter((agent) => getCharacterCategories(agent).includes("politics"));
    const philosophyAgents = charactersAgents.filter((agent) => getCharacterCategories(agent).includes("philosophy"));
    const inventionsAgents = charactersAgents.filter((agent) => getCharacterCategories(agent).includes("inventions"));
    const artAgents = charactersAgents.filter((agent) => getCharacterCategories(agent).includes("art"));
    const literatureAgents = charactersAgents.filter((agent) => getCharacterCategories(agent).includes("literature"));
    const businessAgents = charactersAgents.filter((agent) => getCharacterCategories(agent).includes("business"));

    const baseData = {
      // "Все чаты" содержит все чаты с персонажами, отсортированные по времени последнего сообщения
      chats: finalSortedChats.filter((item) => item !== null),

      // Религия
      religion: createCategoryData("religion", religionAgents),

      // Наука
      science: createCategoryData("science", scienceAgents),

      // Политика
      politics: createCategoryData("politics", politicsAgents),

      // Философия
      philosophy: createCategoryData("philosophy", philosophyAgents),

      // Изобретения
      inventions: createCategoryData("inventions", inventionsAgents),

      // Искусство
      art: createCategoryData("art", artAgents),

      // Литература
      literature: createCategoryData("literature", literatureAgents),

      // Бизнес
      business: createCategoryData("business", businessAgents),
    };

    // Добавляем пользовательские папки
    const customFoldersData = {};
    (folders || [])
      .filter((folder) => folder && folder.folder_type === "custom")
      .forEach((folder) => {
        const folderChats = getChatsByFolder(folder.id, conversations);

        // Системный чат больше не добавляется в пользовательские папки
        // Он показывается только в папке "Все чаты"

        const customFolderChats = folderChats
          .filter((conversation) => {
            // Фильтруем чаты инструментов - они не должны отображаться в списке
            if (!conversation.agent_id) return true; // Групповые чаты и каналы
            const agent = agents.find((a) => a.id === conversation.agent_id);
            return !agent || !toolsAgentIds.has(agent.id);
          })
          .map((conversation) => {
            // Проверка на инструменты уже выполнена в filter выше
            if (conversation.is_channel) {
              const description =
                conversation.channel_description ||
                t("library.channelReadOnly", { defaultValue: "Только чтение" });

              const channelColorClass =
                conversation.colorClass ||
                conversation.channel_color_class ||
                "bg-blue-500";

              const channelIconName =
                conversation.iconName ||
                conversation.channel_icon_name ||
                "notifications";

              const channelAvatar =
                conversation.imageSrc ||
                conversation.channel_avatar_url ||
                conversation.channelAvatar ||
                conversation.avatar_url ||
                conversation.avatar ||
                null;

              return {
                id: conversation.id.toString(),
                title:
                  conversation.title ||
                  conversation.channel_description ||
                  `Канал #${conversation.id}`,
                time: formatTime(
                  conversation.updated_at || conversation.created_at
                ),
                preview: description,
                colorClass: channelColorClass,
                iconName: channelIconName,
                imageSrc: channelAvatar,
                unreadCount: getUnreadCount(conversation.id),
                agentId: null,
                conversationId: conversation.id,
                hasConversation: true,
                isChannel: true,
                is_channel: true,
                can_write: Boolean(conversation.can_write),
                channel_description: conversation.channel_description || "",
              };
            }

            // Обработка групповых чатов
            if (conversation.is_group) {
              // Получаем имена агентов группы
              const agentNames =
                conversation.group_agent_ids
                  ?.map((agentId) => {
                    const agent = agents.find((a) => a.id === agentId);
                    return agent ? translateAgent(agent).name : t("chat.agent") + ` ${agentId}`;
                  })
                  .join(", ") || "";

              const decoded = conversation.last_message
                ? decodeHtmlEntities(conversation.last_message)
                : null;

              return {
                id: conversation.id.toString(),
                title: conversation.title,
                time: formatTime(
                  conversation.updated_at || conversation.created_at
                ),
                preview: decoded
                  ? decoded.substring(0, 50) + (decoded.length > 50 ? "..." : "")
                  : agentNames ||
                  t("chat.groupChatWithCount", { count: conversation.group_agent_ids?.length || 0 }),
                colorClass: "bg-purple-500",
                iconName: conversation.group_avatar || "group",
                imageSrc: getGroupChatAvatarUrl(conversation.group_avatar_url), // Используем загруженный аватар, если есть
                unreadCount: getUnreadCount(conversation.id),
                agentId: null,
                conversationId: conversation.id,
                hasConversation: true,
                isGroup: true,
                groupAvatar: conversation.group_avatar,
              };
            }

            const agent = agents.find((a) => a.id === conversation.agent_id);

            // Показываем активный чат даже если он новый пустой
            // Фильтруем новые пустые чаты - они не должны показываться в списке до отправки сообщения
            if (conversation.id !== activeConversation?.id && isNewlyCreatedEmptyChat(conversation.id)) {
              return null;
            }

            // Фильтруем чаты инструментов - они не должны отображаться в списке
            if (agent && toolsAgentIds.has(agent.id)) {
              return null; // Инструменты работают как мини-приложения, их чаты не показываются
            }

            // Используем ту же логику, что и в buildListItems для правильного названия
            const agentConversations = conversations.filter(
              (conv) => conv.agent_id === agent?.id
            );

            // Определяем номер чата на основе порядка создания, а не текущей сортировки
            const allAgentConversations = agentConversations.sort(
              (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
            const conversationIndex = allAgentConversations.findIndex(
              (conv) => conv.id === conversation.id
            );

            const translatedAgent = agent ? translateAgent(agent) : null;

            // Проверяем, является ли название стандартным "Чат с ..." или "Chat with ..."
            const isDefaultTitle = conversation.title && (
              conversation.title.startsWith("Чат с ") ||
              conversation.title.startsWith("Chat with ")
            );

            let title;
            if (conversation.title && conversation.title.trim() && !isDefaultTitle) {
              // Используем сохраненное название чата (переименованное пользователем)
              title = conversation.title;
            } else {
              // Fallback: используем стандартное название с номером
              title =
                allAgentConversations.length > 1
                  ? `${translatedAgent?.name} (${conversationIndex + 1})`
                  : (translatedAgent?.name || t("chat.unknownAgent"));
            }

            // Формируем данные в том же формате, что и buildListItems
            return {
              id: conversation.id.toString(),
              title,
              time: formatTime(
                conversation.updated_at || conversation.created_at
              ),
              preview: (() => {
                const decoded = conversation.last_message
                  ? decodeHtmlEntities(conversation.last_message)
                  : null;
                return decoded
                  ? decoded.substring(0, 50) + (decoded.length > 50 ? "..." : "")
                  : (translatedAgent?.name || t("chat.unknownAgent"));
              })(),
              colorClass:
                agent?.color_class || "bg-purple-500 dark:bg-purple-600",
              iconName: agent?.icon_name || "psychology",
              imageSrc: getAgentAvatarUrl(agent?.image_url, agent?.avatar_url, "low"),
              unreadCount: getUnreadCount(conversation.id),
              agentId: agent?.id,
              conversationId: conversation.id,
              hasConversation: true,
            };
          });

        // Объединяем только чаты папки без системного чата
        // Фильтруем null значения от отфильтрованных инструментов
        customFoldersData[folder.id] = customFolderChats.filter((item) => item !== null);
      });

    return { ...baseData, ...customFoldersData };
  }, [
    agents,
    conversations,
    systemChat,
    getCharacterCategories,
    getAgentsByCategory,
    translateAgent,
    t,
    buildListItems,
    decodeHtmlEntities,
    getUnreadCount,
    folders,
    getChatsByFolder,
    isSystemChatHidden,
    forceUpdate,
    isNewlyCreatedEmptyChat,
    pinnedChats,
  ]);

  // Функция для подсчета общего количества непрочитанных сообщений в папке
  const getFolderUnreadCount = (folderId) => {
    const folderChats = chatData[folderId] || [];
    return folderChats.reduce(
      (total, chat) => total + (chat.unreadCount || 0),
      0
    );
  };

  // Навигационные элементы с динамическим подсчетом непрочитанных сообщений
  // Пользовательские папки
  const customFolders = useMemo(() => {
    const allFolders = folders || [];

    const custom = allFolders
      .filter((folder) => folder && folder.folder_type === "custom")
      .map((folder) => ({
        id: folder.id,
        label: folder.name,
        icon: getFolderIcon(folder.icon),
        unreadCount: getFolderUnreadCount(folder.id),
      }));

    return custom;
  }, [folders, chatData, getFolderUnreadCount]);

  const navItems = useMemo(() => {
    // Системные папки - папка "Все чаты" + 8 категорий персонажей
    const hidden = getHiddenSystemFolders();
    const baseSystemFolders = [
      {
        id: "chats",
        label: t("common.allChats"),
        icon: MdHome,
        unreadCount: getFolderUnreadCount("chats"),
      },
      {
        id: "religion",
        label: t("library.categories.religion"),
        icon: MdFavorite,
        unreadCount: getFolderUnreadCount("religion"),
      },
      {
        id: "science",
        label: t("library.categories.science"),
        icon: MdSchool,
        unreadCount: getFolderUnreadCount("science"),
      },
      {
        id: "politics",
        label: t("library.categories.politics"),
        icon: MdBusiness,
        unreadCount: getFolderUnreadCount("politics"),
      },
      {
        id: "philosophy",
        label: t("library.categories.philosophy"),
        icon: MdPsychology,
        unreadCount: getFolderUnreadCount("philosophy"),
      },
      {
        id: "inventions",
        label: t("library.categories.inventions"),
        icon: MdWork,
        unreadCount: getFolderUnreadCount("inventions"),
      },
      {
        id: "art",
        label: t("library.categories.art"),
        icon: MdStar,
        unreadCount: getFolderUnreadCount("art"),
      },
      {
        id: "literature",
        label: t("library.categories.literature"),
        icon: MdAutoAwesome,
        unreadCount: getFolderUnreadCount("literature"),
      },
      {
        id: "business",
        label: t("library.categories.business"),
        icon: MdCalculate,
        unreadCount: getFolderUnreadCount("business"),
      },
    ];

    const systemFolders = baseSystemFolders.filter((f) => !hidden.includes(f.id));

    // Восстанавливаем порядок системных разделов из localStorage или состояния
    let orderedSystemFolders = [...systemFolders];
    try {
      const savedOrder =
        systemFolderOrder || localStorage.getItem("systemFolderOrder");
      if (savedOrder) {
        const systemOrder = JSON.parse(savedOrder);
        const orderArray = Array.isArray(systemOrder) ? systemOrder : [];
        const expectedIds = systemFolders.map((folder) => folder.id);
        const orderedSet = new Set();

        orderedSystemFolders = orderArray
          .map((id) => {
            const folder = systemFolders.find((item) => item.id === id);
            if (folder) {
              orderedSet.add(folder.id);
            }
            return folder;
          })
          .filter(Boolean);

        const missingFolders = expectedIds
          .filter((id) => !orderedSet.has(id))
          .map((id) => systemFolders.find((folder) => folder.id === id))
          .filter(Boolean);

        if (missingFolders.length > 0) {
          orderedSystemFolders = [...orderedSystemFolders, ...missingFolders];
        }
      }
    } catch (error) {
      console.error("Failed to load system folder order:", error);
    }

    return [...orderedSystemFolders, ...customFolders];
  }, [forceUpdate, customFolders, getFolderUnreadCount, systemFolderOrder, hiddenSystemFoldersVersion, t]);

  // Определяем направление анимации при смене папки
  const prevActiveFolderRef = useRef(activeFolder);
  const direction = useMemo(() => {
    // Нормализуем ID к строкам для надежного сравнения
    const prevIndex = navItems.findIndex((item) => String(item.id) === String(prevActiveFolderRef.current));
    const currentIndex = navItems.findIndex((item) => String(item.id) === String(activeFolder));

    if (prevIndex === -1 || currentIndex === -1 || prevIndex === currentIndex) return 0;

    // Если новая папка ниже (индекс больше) -> направление 1 (вниз/вперед) -> уходит влево, приходит справа
    // Если новая папка выше (индекс меньше) -> направление -1 (вверх/назад) -> уходит вправо, приходит слева
    return currentIndex > prevIndex ? 1 : -1;
  }, [activeFolder, navItems]);

  useEffect(() => {
    prevActiveFolderRef.current = activeFolder;
  }, [activeFolder]);

  // Автоматически переключаем на существующую категорию, если текущая не найдена
  useEffect(() => {
    if (navItems.length > 0 && onFolderChange) {
      const currentFolderExists = navItems.some(
        (item) => String(item.id) === String(activeFolder)
      );

      // Если текущая категория не найдена, переключаемся на первую доступную
      if (!currentFolderExists) {
        const firstFolder = navItems[0];
        if (firstFolder) {
          console.log(`[Sidebar] Active folder "${activeFolder}" not found, switching to "${firstFolder.id}"`);
          onFolderChange(firstFolder.id);
        }
      }
    }
  }, [navItems, activeFolder, onFolderChange]);

  const variants = {
    enter: (direction) => ({
      // Движение вниз (direction > 0): новый список появляется справа налево (100% → 0)
      // Движение вверх (direction < 0): новый список появляется слева направо (-100% → 0)
      x: direction > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction) => ({
      // Движение вниз (direction > 0): текущий список уходит влево (0 → -100%)
      // Движение вверх (direction < 0): текущий список уходит вправо (0 → 100%)
      x: direction > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
  };

  const handleFolderChange = (folderId) => {
    if (onFolderChange) {
      onFolderChange(folderId);
    }
  };

  // Обработчик переупорядочивания элементов
  const handleReorderItems = useCallback(
    (draggedIndex, targetIndex) => {
      // Определяем, какие элементы перетаскиваются
      const draggedItem = navItems[draggedIndex];
      const targetItem = navItems[targetIndex];

      if (!draggedItem || !targetItem) return;

      // Создаем новый порядок элементов
      const newOrder = [...navItems];
      const [draggedElement] = newOrder.splice(draggedIndex, 1);
      newOrder.splice(targetIndex, 0, draggedElement);

      // Определяем типы элементов
      const systemFolderIds = ["chats", "religion", "science", "politics", "philosophy", "inventions", "art", "literature", "business"];
      const isDraggedSystem = systemFolderIds.includes(draggedItem.id);
      const isTargetSystem = systemFolderIds.includes(targetItem.id);
      const isDraggedCustom = customFolders.some(
        (f) => f.id === draggedItem.id
      );
      const isTargetCustom = customFolders.some((f) => f.id === targetItem.id);

      // Обрабатываем перетаскивание системных папок
      if (isDraggedSystem || isTargetSystem) {
        try {
          const systemOrder = newOrder
            .filter((item) => systemFolderIds.includes(item.id))
            .map((item) => item.id);
          localStorage.setItem(
            "systemFolderOrder",
            JSON.stringify(systemOrder)
          );
          setSystemFolderOrder(JSON.stringify(systemOrder));
        } catch (error) {
          console.error("Failed to save system folder order:", error);
        }
      }

      // Обрабатываем перетаскивание пользовательских папок
      if (isDraggedCustom || isTargetCustom) {
        // Находим новые индексы пользовательских папок
        const newCustomOrder = newOrder.filter((item) =>
          customFolders.some((f) => f.id === item.id)
        );

        // Обновляем порядок пользовательских папок
        if (reorderFolders && newCustomOrder.length > 0) {
          // Находим индексы в исходном массиве customFolders
          const draggedFolderIndex = customFolders.findIndex(
            (f) => f.id === draggedItem.id
          );
          const targetFolderIndex = customFolders.findIndex(
            (f) => f.id === targetItem.id
          );

          if (draggedFolderIndex !== -1 && targetFolderIndex !== -1) {
            reorderFolders(draggedFolderIndex, targetFolderIndex);
          }
        }
      }
    },
    [navItems, customFolders, reorderFolders]
  );
  const containerClassName = isFullWidth
    ? "relative flex min-h-0 h-full w-full"
    : "relative flex min-h-0 w-fit h-full";
  const mergedProfileScreenProps = profileScreenProps ?? {};

  const asideBaseClasses =
    "md:flex-shrink-0 bg-[var(--bg-secondary)] flex flex-col min-h-0 h-full border-r border-[var(--border-color)] relative";
  const asideClassName = `${asideBaseClasses} ${isFullWidth ? "flex-1 min-w-0" : "w-full"
    }`.trim();

  return (
    <section ref={containerRef} className={containerClassName} aria-label="Sidebar">
      {(
        <aside
          ref={sidebarRef}
          className={asideClassName}
          style={{
            width: isFullWidth ? undefined : `${sidebarWidth}px`,
            flex: isFullWidth ? "1 1 auto" : undefined,
            transition: isResizing ? "none" : "width 240ms ease-out",
          }}
        >
          <SearchWithAvatar
            onMenuClick={onMenuClick}
            ref={searchRef}
            onSearchToggle={handleSearchToggle}
            sidebarRef={sidebarRef}
            onChatSelect={onChatSelect}
            currentChatId={activeChatId}
          />
          {!isSearchOpen && (
            <main className="relative flex-1 w-full min-h-0 overflow-hidden">
              <AnimatePresence mode="sync" initial={false} custom={direction}>
                <motion.div
                  key={activeFolder}
                  custom={direction}
                  variants={variants}
                  className="absolute inset-0 w-full h-full flex flex-col"
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{
                    type: "tween",
                    duration: 0.25,
                    ease: [0.4, 0, 0.2, 1],
                  }}
                  style={{
                    willChange: "transform, opacity",
                    backfaceVisibility: "hidden",
                  }}
                >
                  {/* Для остальных разделов показываем обычный ChatList */}
                  <ChatList
                    items={chatData[activeFolder] || []}
                    onChatSelect={onChatSelect}
                    activeChatId={activeChatId}
                    onDeleteChat={onDeleteChat}
                    onPinToTop={onPinToTop}
                    onDeleteAgent={onDeleteAgent}
                    onUnsubscribeChannel={onUnsubscribeChannel}
                    onHideChat={onHideChat}
                    pinnedChats={pinnedChats}
                    // Пропсы для закрепления в папках
                    folderId={activeFolder}
                    pinnedChatsInFolder={pinnedChatsInCurrentFolder}
                    onPinInFolder={handlePinInFolder}
                    onUnpinFromFolder={handleUnpinFromFolder}
                  />
                </motion.div>
              </AnimatePresence>
              {/* Кнопка добавления нового чата в центре внизу */}
              {(
                <button
                  className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center gap-2 h-12 px-4 rounded-2xl shadow-lg z-[1] transform transition-all duration-200 hover:scale-105 hover:brightness-110 hover:shadow-xl shine-effect"
                  style={{
                    backgroundColor: "var(--accent)",
                    bottom: "calc(1rem + var(--safe-area-inset-bottom))",
                  }}
                  onClick={() => {
                    // Открываем библиотеку персонажей для всех категорий персонажей
                    onOpenLibrary(); // ChatLibraryInline для персонажей
                  }}
                  title={t("common.openLibrary")}
                >
                  <MdAdd className="text-white text-2xl shrink-0" />
                  <span className="text-white font-medium text-sm whitespace-nowrap">
                    {t("chat.newChat")}
                  </span>
                </button>
              )}
            </main>
          )}
          {/** Invisible right-edge resizer hit area inside aside */}
          {isMobileViewport || isFullWidth ? null : (
            <div
              className="absolute top-0 right-0 h-full w-[8px] cursor-col-resize select-none"
              style={{ background: "transparent" }}
              onMouseDown={(e) => {
                startXRef.current = e.clientX;
                startWidthRef.current = sidebarWidth;
                setIsResizing(true);
              }}
            />
          )}
        </aside>
      )}

      {/* Форма редактирования папки */}
      <CreateFolderForm
        isOpen={showEditForm}
        onClose={() => {
          setShowEditForm(false);
          setEditingFolder(null);
        }}
        onCreateFolder={async (folderData) => {
          try {
            if (editingFolder) {
              await updateFolder(editingFolder.id, folderData);
              setShowEditForm(false);
              setEditingFolder(null);
            }
          } catch (error) {
            console.error("Failed to update folder:", error);
          }
        }}
        conversations={conversations.filter((conv) => !conv.is_group && !conv.isGroup && !conv.is_channel && !conv.isChannel)}
        agents={agents}
        groups={groups}
        channels={channels}
        editingFolder={editingFolder}
        isEditMode={true}
      />

      {/* Модальное окно удаления папки */}
      <DeleteFolderModal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setFolderToDelete(null);
        }}
        onConfirm={handleConfirmDeleteFolder}
        folderName={folderToDelete?.name || null}
        folderIcon={folderToDelete?.icon || "folder"}
      />

      {/* Библиотека агентов */}
      {isAgentsLibraryOpen && (
        <AgentsLibrary
          onClose={handleCloseAgentsLibrary}
          onAddAgent={handleAgentAdded}
        />
      )}

      {/* Библиотека персонажей */}
      {isCharactersLibraryOpen && (
        <CharactersLibrary
          onClose={handleCloseCharactersLibrary}
          onAddCharacter={handleCharacterAdded}
        />
      )}

      <ProfileScreen isOpen={showProfile} {...mergedProfileScreenProps} />
    </section>
  );
};

export default Sidebar;
