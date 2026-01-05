import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  MdClose,
  MdAdd,
  MdCheck,
  MdPerson,
  MdSchool,
  MdFavorite,
  MdFolderOpen,
  MdPsychology,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdAutoAwesome,
  MdStar,
  MdNotifications,
  MdHome,
  MdBusiness,
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
  MdLocalHospital,
  MdGroup,
  MdGroups,
  MdDiversity3,
  MdPeopleAlt,
  MdEmojiPeople,
  MdConnectWithoutContact,
  MdInterpreterMode,
  MdChat,
  MdTheaterComedy,
  MdStarBorder,
  MdLocalFireDepartment,
  MdDiamond,
} from "react-icons/md";
import { FaPeopleGroup } from "react-icons/fa6";
import { RiTeamFill } from "react-icons/ri";
import { PiHandsClappingDuotone } from "react-icons/pi";
import { TbUserCog } from "react-icons/tb";

const CreateFolderForm = ({
  isOpen = false,
  onClose = () => {},
  onCreateFolder = () => {},
  conversations = [],
  agents = [],
  groups = [],
  channels = [],
  editingFolder = null,
  isEditMode = false,
}) => {
  const { t, language, translateAgent } = useLanguage();
  const [folderName, setFolderName] = useState("");
  const [selectedChats, setSelectedChats] = useState([]);
  const [showChatSelector, setShowChatSelector] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("folder");
  const [showIconSelector, setShowIconSelector] = useState(false);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const modalRef = useRef(null);
  const closingRef = useRef(false);
  const [chatSelectorRendered, setChatSelectorRendered] = useState(false);
  const [chatSelectorShown, setChatSelectorShown] = useState(false);
  const chatSelectorRef = useRef(null);
  const chatSelectorClosingRef = useRef(false);

  // Анимация появления/исчезновения модального окна
  useEffect(() => {
    if (isOpen) {
      closingRef.current = false;
      setIsRendered(true);
      requestAnimationFrame(() => setIsShown(true));
    } else if (isRendered) {
      setIsShown(false);
    }
  }, [isOpen, isRendered]);

  // Сброс формы при открытии/закрытии
  useEffect(() => {
    if (isOpen) {
      if (isEditMode && editingFolder) {
        // Режим редактирования - заполняем форму данными папки
        setFolderName(editingFolder.name || "");
        setSelectedIcon(editingFolder.icon || "folder");

        // Загружаем чаты папки (обычные чаты, группы и каналы)
        const allChats = [...conversations, ...groups, ...channels];
        if (editingFolder.chat_ids && editingFolder.chat_ids.length > 0) {
          const folderChats = allChats.filter((chat) =>
            editingFolder.chat_ids.includes(chat.id)
          );
          setSelectedChats(folderChats);
        } else {
          setSelectedChats([]);
        }
      } else {
        // Режим создания - очищаем форму
        setFolderName("");
        setSelectedChats([]);
        setSelectedIcon("folder");
      }
      setSearchQuery("");
      setShowChatSelector(false);
      setShowIconSelector(false);
      setChatSelectorRendered(false);
      setChatSelectorShown(false);
    }
  }, [isOpen, isEditMode, editingFolder, conversations, groups, channels]);

  // Закрытие по Escape
  useEffect(() => {
    if (!isRendered) return;

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isRendered]);

  const handleClose = () => {
    if (closingRef.current) return;
    closingRef.current = true;
    setIsShown(false);
    // Закрываем вложенное модальное окно, если оно открыто
    if (showChatSelector) {
      handleChatSelectorClose();
    }
    setTimeout(() => {
      setFolderName("");
      setSelectedChats([]);
      setSearchQuery("");
      setShowChatSelector(false);
      setSelectedIcon("folder");
      setShowIconSelector(false);
      setIsRendered(false);
      onClose();
    }, 300); // Длительность анимации
  };

  const handleTransitionEnd = (e) => {
    // Срабатывает только на модальном окне, не на backdrop
    if (e.target === modalRef.current && !isShown && closingRef.current) {
      // Дополнительная проверка на случай, если timeout уже сработал
    }
  };

  const handleCreateFolder = () => {
    if (folderName.trim()) {
      // Формируем список ID чатов
      const chatIds = selectedChats.map((chat) => chat.id).filter((id) => id != null);
      
      // Формируем список ID агентов (уникальные, без null/undefined)
      const agentIds = selectedChats
        .map((chat) => chat.agent_id)
        .filter((id) => id != null && id !== undefined)
        .filter((id, index, arr) => arr.indexOf(id) === index);

      const folderData = {
        name: folderName.trim(),
        chat_ids: chatIds.length > 0 ? chatIds : [], // Отправляем пустой массив, если нет чатов
        agent_ids: agentIds.length > 0 ? agentIds : [], // Отправляем пустой массив, если нет агентов
        icon: selectedIcon,
      };

      // В режиме редактирования ID папки передается отдельно в URL через onFolderUpdate
      // Не включаем id в body запроса, так как его нет в модели FolderUpdate

      onCreateFolder(folderData);
      handleClose();
    }
  };

  // Анимация для вложенного модального окна "Выберите чаты"
  useEffect(() => {
    if (showChatSelector) {
      chatSelectorClosingRef.current = false;
      setChatSelectorRendered(true);
      requestAnimationFrame(() => setChatSelectorShown(true));
    } else if (chatSelectorRendered) {
      setChatSelectorShown(false);
    }
  }, [showChatSelector, chatSelectorRendered]);

  const handleAddChat = () => {
    setShowChatSelector(true);
  };

  const handleChatSelectorClose = () => {
    if (chatSelectorClosingRef.current) return;
    chatSelectorClosingRef.current = true;
    setChatSelectorShown(false);
    setTimeout(() => {
      setChatSelectorRendered(false);
      setShowChatSelector(false);
    }, 300); // Длительность анимации
  };

  const handleChatSelectorTransitionEnd = (e) => {
    // Срабатывает только на модальном окне, не на backdrop
    if (e.target === chatSelectorRef.current && !chatSelectorShown && chatSelectorClosingRef.current) {
      // Дополнительная проверка на случай, если timeout уже сработал
    }
  };

  const handleChatSelect = (chat) => {
    const isSelected = selectedChats.some(
      (selected) => selected.id === chat.id
    );
    if (isSelected) {
      setSelectedChats((prev) =>
        prev.filter((selected) => selected.id !== chat.id)
      );
    } else {
      setSelectedChats((prev) => [...prev, chat]);
    }
  };

  const handleRemoveChat = (chatId) => {
    setSelectedChats((prev) => prev.filter((chat) => chat.id !== chatId));
  };

  const handleIconClick = () => {
    setShowIconSelector(true);
  };

  const handleIconSelect = (iconName) => {
    setSelectedIcon(iconName);
    setShowIconSelector(false);
  };

  // Получение иконки для папки
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

  // Получение иконки для агента
  const getAgentIcon = (iconName) => {
    const iconMap = {
      star: MdStar,
      notifications: MdNotifications,
      work: MdWork,
      calculate: MdCalculate,
      translate: MdTranslate,
      wb_sunny: MdWbSunny,
      psychology: MdPsychology,
      auto_awesome: MdAutoAwesome,
      person: MdPerson,
      school: MdSchool,
      favorite: MdFavorite,
      folder: MdFolderOpen,
    };
    return iconMap[iconName] || MdPsychology;
  };

  // Получение иконки для группы
  const getGroupIcon = (iconName) => {
    const iconMap = {
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
      fa_people_group: FaPeopleGroup,
      team_fill: RiTeamFill,
    };
    return iconMap[iconName] || MdGroup;
  };

  // Получение аватарки для чата (агент, группа или канал)
  const getChatAvatar = (chat) => {
    // Проверяем, является ли это каналом
    if (chat.is_channel || chat.isChannel) {
      const channelAvatar =
        chat.channel_avatar_url ||
        chat.imageSrc ||
        chat.image_url ||
        null;
      if (channelAvatar) {
        return { type: "image", src: channelAvatar };
      }
      // Если нет аватарки, используем иконку
      const agent = agents.find((a) => a.id === chat.agent_id);
      const iconName = chat.iconName || agent?.icon_name || "notifications";
      return { type: "icon", icon: getAgentIcon(iconName), colorClass: "bg-blue-500 dark:bg-blue-600" };
    }

    // Проверяем, является ли это группой
    if (chat.is_group || chat.isGroup) {
      const allowedIcons = [
        "group",
        "groups",
        "group_add",
        "group_work",
        "diversity",
        "people_alt",
        "emoji_people",
        "connect",
        "interpreter",
        "chat",
        "comedy",
        "star",
        "star_border",
        "fire",
        "diamond",
        "fa_people_group",
        "team_fill",
      ];
      const normalizedAvatar = (chat.group_avatar || "group").toLowerCase();
      const iconName = allowedIcons.includes(normalizedAvatar)
        ? normalizedAvatar
        : "group";
      return { type: "group", icon: iconName };
    }

    // Обычный чат с агентом
    const agent = agents.find((a) => a.id === chat.agent_id);
    const agentImage = agent?.image_url || agent?.avatar_url;
    if (agentImage) {
      return { type: "image", src: agentImage };
    }
    const iconName = agent?.icon_name || "psychology";
    return { type: "icon", icon: getAgentIcon(iconName), colorClass: agent?.color_class || "bg-purple-500 dark:bg-purple-600" };
  };

  // Функция для получения правильного названия чата (без префикса "чат с")
  const getChatDisplayName = (chat) => {
    // Для групп и каналов просто возвращаем название
    if (chat.is_group || chat.isGroup) {
      return chat.title || t("common.group");
    }
    
    if (chat.is_channel || chat.isChannel) {
      return chat.title || t("common.channel");
    }

    // Сначала пытаемся получить имя агента из пропса agents
    if (chat.agent_id) {
      const agent = agents.find((a) => a.id === chat.agent_id);
      if (agent && agent.name) {
        const translatedAgent = translateAgent(agent);
        // Находим все разговоры с этим агентом
        const agentConversations = conversations.filter(
          (conv) => conv.agent_id === chat.agent_id && !conv.is_group
        );

        // Если чатов с агентом больше одного, добавляем номер
        if (agentConversations.length > 1) {
          // Сортируем по времени создания для правильного порядка
          const sortedConversations = agentConversations.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );
          
          // Находим индекс текущего чата
          const conversationIndex = sortedConversations.findIndex(
            (conv) => conv.id === chat.id
          );

          // Добавляем номер в скобках
          return `${translatedAgent.name} (${conversationIndex + 1})`;
        }

        return translatedAgent.name;
      }
    }

    // Если агент не найден, парсим название чата
    if (chat.title) {
      let title = chat.title;

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

  // Фильтрация чатов по поисковому запросу (включая группы и каналы)
  const allAvailableChats = [...conversations, ...groups, ...channels];
  const filteredChats = allAvailableChats.filter((chat) => {
    const searchLower = searchQuery.toLowerCase();
    
    // Для обычных чатов
    if (!chat.is_group && !chat.isGroup && !chat.is_channel && !chat.isChannel) {
      const agent = agents.find((a) => a.id === chat.agent_id);
      if (!agent) return false;
      return (
        agent.name.toLowerCase().includes(searchLower) ||
        chat.title?.toLowerCase().includes(searchLower)
      );
    }
    
    // Для групп и каналов
    return chat.title?.toLowerCase().includes(searchLower);
  });

  if (!isRendered) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm ${
        isShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
      }`}
      style={{ paddingTop: '120px', paddingBottom: '20px' }}
      onClick={(e) => {
        // Закрываем только если клик был по backdrop, а не по содержимому модального окна
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        onTransitionEnd={handleTransitionEnd}
        className={`bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[calc(100vh-160px)] overflow-hidden ${
          isShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"
        }`}
        onClick={(e) => e.stopPropagation()} // Предотвращаем всплытие события
        style={{
          background:
            "linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)",
          border: "1px solid var(--border-color)",
        }}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--border-color)]">
          <h2 className="text-xl font-semibold text-[var(--text-black-for-folder)]">
            {isEditMode ? t("chat.editFolder") : t("chat.newFolder")}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-[var(--text-dim)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-white)] transition-colors"
          >
            <MdClose className="text-xl" />
          </button>
        </div>

        {/* Содержимое */}
        <div className="p-6 space-y-6">
          {/* Название папки */}
          <div className="space-y-2">
            <label className="text-[var(--text-black-for-folder)] font-medium text-sm">
              {t("chat.folderName")}
            </label>
            <div className="relative">
              <input
                type="text"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder={t("chat.folderNamePlaceholder")}
                className="w-full px-3 py-2 bg-transparent border-b-2 border-[var(--accent)] text-[var(--text-black-for-folder)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                autoFocus
              />
              <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
                <div
                  className="w-9 h-9 rounded flex items-center justify-center cursor-pointer transition-colors"
                  onClick={handleIconClick}
                >
                  {React.createElement(getFolderIcon(selectedIcon), {
                    className:
                      "text-[25px] text-[var(--text-black-for-folder)] transition-all duration-300 hover:drop-shadow-[0_0_8px_var(--accent)] hover:brightness-110",
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Выбранные чаты */}
          <div className="space-y-3">
            <h3 className="text-[var(--text-black-for-folder)] font-medium text-sm">
              {t("chat.selectedChats")}
            </h3>

            {/* Список выбранных чатов */}
            {selectedChats.length > 0 && (
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {selectedChats.map((chat) => {
                  const avatar = getChatAvatar(chat);

                  return (
                    <div
                      key={chat.id}
                      className="flex items-center justify-between p-2 bg-[var(--bg-tertiary)] rounded-lg"
                    >
                      <div className="flex items-center space-x-2">
                        {avatar.type === "image" ? (
                          <img
                            src={avatar.src}
                            alt={chat.title || "Chat"}
                            className="w-6 h-6 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : avatar.type === "group" ? (
                          <div className="relative w-6 h-6 rounded-full overflow-hidden">
                            <div
                              className="absolute inset-0 bg-center bg-cover"
                              style={{ backgroundImage: "url('/images/agents/Under_Icon_Groups.png')" }}
                              aria-hidden="true"
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-white">
                              {React.createElement(getGroupIcon(avatar.icon), {
                                className: "text-xs",
                                style: { transform: "scale(0.6)" },
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className={`w-6 h-6 rounded-full ${avatar.colorClass || "bg-[var(--accent)]/20"} flex items-center justify-center`}>
                            {React.createElement(avatar.icon, {
                              className: "text-xs text-[var(--text-black-for-folder)]",
                            })}
                          </div>
                        )}
                        <span className="text-[var(--text-black-for-folder)] text-sm">
                          {getChatDisplayName(chat)}
                        </span>
                      </div>
                      <button
                        onClick={() => handleRemoveChat(chat.id)}
                        className="p-1 rounded text-[var(--text-dim)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                      >
                        <MdClose className="text-sm" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Кнопка добавления чатов */}
            <button
              onClick={handleAddChat}
              className="w-full flex items-center space-x-2 p-3 rounded-lg hover:bg-[var(--hover-bg)] transition-colors text-[var(--text-black-for-folder)] border border-dashed border-[var(--accent)]/30"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--accent)]/20 flex items-center justify-center">
                <MdAdd className="text-sm text-[var(--text-black-for-folder)]" />
              </div>
              <span className="font-medium">{t("chat.addChats")}</span>
            </button>
          </div>

          {/* Инструкция */}
          <div className="text-[var(--text-dim)] text-xs leading-relaxed">
            {t("chat.selectChatsDescription")}
          </div>
        </div>

        {/* Селектор чатов */}
        {chatSelectorRendered && (
          <div
            className={`fixed inset-0 z-[55] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm ${
              chatSelectorShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
            }`}
            style={{ paddingTop: '120px', paddingBottom: '20px' }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                handleChatSelectorClose();
              }
            }}
          >
            <div
              ref={chatSelectorRef}
              onTransitionEnd={handleChatSelectorTransitionEnd}
              className={`bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[calc(100vh-160px)] overflow-hidden ${
                chatSelectorShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"
              }`}
              onClick={(e) => e.stopPropagation()}
              style={{
                background:
                  "linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)",
                border: "1px solid var(--border-color)",
              }}
            >
              {/* Заголовок */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
                <h3 className="text-lg font-semibold text-[var(--text-black-for-folder)]">
                  {t("chat.selectChats")}
                </h3>
                <button
                  onClick={handleChatSelectorClose}
                  className="p-2 rounded-lg text-[var(--text-dim)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-white)] transition-colors"
                >
                  <MdClose className="text-xl" />
                </button>
              </div>

              {/* Поиск */}
              <div className="p-4 border-b border-[var(--border-color)]">
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("chat.searchChatsPlaceholder")}
                    className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--text-black-for-folder)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors"
                  />
                </div>
              </div>

              {/* Список чатов */}
              <div className="max-h-96 overflow-y-auto">
                {filteredChats.map((chat) => {
                  const avatar = getChatAvatar(chat);
                  const isSelected = selectedChats.some(
                    (selected) => selected.id === chat.id
                  );

                  return (
                    <div
                      key={chat.id}
                      onClick={() => handleChatSelect(chat)}
                      className="flex items-center justify-between p-3 hover:bg-[var(--hover-bg)] transition-colors cursor-pointer"
                    >
                      <div className="flex items-center space-x-3">
                        {avatar.type === "image" ? (
                          <img
                            src={avatar.src}
                            alt={chat.title || "Chat"}
                            className="w-8 h-8 rounded-full object-cover"
                            loading="lazy"
                          />
                        ) : avatar.type === "group" ? (
                          <div className="relative w-8 h-8 rounded-full overflow-hidden">
                            <div
                              className="absolute inset-0 bg-center bg-cover"
                              style={{ backgroundImage: "url('/images/agents/Under_Icon_Groups.png')" }}
                              aria-hidden="true"
                            />
                            <div className="absolute inset-0 flex items-center justify-center text-white">
                              {React.createElement(getGroupIcon(avatar.icon), {
                                className: "text-sm",
                                style: { transform: "scale(0.7)" },
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className={`w-8 h-8 rounded-full ${avatar.colorClass || "bg-[var(--accent)]/20"} flex items-center justify-center`}>
                            {React.createElement(avatar.icon, {
                              className: "text-lg text-[var(--text-black-for-folder)]",
                            })}
                          </div>
                        )}
                        <div>
                          <p className="text-[var(--text-black-for-folder)] font-medium">
                            {getChatDisplayName(chat)}
                          </p>
                          <p className="text-[var(--text-dim)] text-xs">
                            {chat.created_at
                              ? new Date(
                                  chat.created_at
                                ).toLocaleDateString(language === "ru" ? "ru-RU" : "en-US")
                              : t("chat.newChat")}
                          </p>
                        </div>
                      </div>
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-[var(--accent)] flex items-center justify-center">
                          <MdCheck className="text-sm text-white" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Футер */}
              <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]">
                <button
                  onClick={handleChatSelectorClose}
                  className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/80 transition-colors"
                >
                  {t("chat.done")}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Футер с кнопками */}
        <div className="flex justify-end space-x-4 p-6 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]">
          <button
            onClick={handleClose}
            className="px-6 py-2 text-[var(--text-black-for-folder)] font-medium hover:text-[var(--text-white)] transition-colors"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={handleCreateFolder}
            disabled={!folderName.trim()}
            className="px-6 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isEditMode ? t("common.save") : t("common.create")}
          </button>
        </div>
      </div>

      {/* Всплывающее окно выбора иконок */}
      {showIconSelector && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm"
          style={{ paddingTop: '120px', paddingBottom: '20px' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowIconSelector(false);
            }
          }}
        >
          <div
            className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-sm mx-4 max-h-[calc(100vh-160px)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              background:
                "linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)",
              border: "1px solid var(--border-color)",
            }}
          >
            {/* Заголовок */}
            <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)]">
              <h3 className="text-lg font-semibold text-[var(--text-black-for-folder)]">
                {t("chat.selectFolderIcon")}
              </h3>
              <button
                onClick={() => setShowIconSelector(false)}
                className="p-2 rounded-lg text-[var(--text-dim)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-white)] transition-colors"
              >
                <MdClose className="text-xl" />
              </button>
            </div>

            {/* Сетка иконок */}
            <div className="p-4">
              <div className="grid grid-cols-4 gap-3">
                {[
                  "folder",
                  "home",
                  "business",
                  "work",
                  "school",
                  "person",
                  "favorite",
                  "star",
                  "psychology",
                  "calculate",
                  "translate",
                  "wb_sunny",
                  "auto_awesome",
                  "notifications",
                  "sports",
                  "music",
                  "movie",
                  "restaurant",
                  "shopping",
                  "car",
                ].map((iconName) => {
                  const IconComponent = getFolderIcon(iconName);
                  const isSelected = selectedIcon === iconName;

                  return (
                    <div
                      key={iconName}
                      onClick={() => handleIconSelect(iconName)}
                      className={`flex items-center justify-center p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                        isSelected
                          ? "bg-[var(--accent)]/20 border-2 border-[var(--accent)] scale-105"
                          : "hover:bg-[var(--hover-bg)] hover:scale-105"
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isSelected
                            ? "bg-[var(--accent)]/30"
                            : "bg-[var(--bg-primary)]"
                        }`}
                      >
                        <IconComponent
                          className={`text-xl ${
                            isSelected
                              ? "text-[var(--text-black-for-folder)]"
                              : "text-[var(--text-dim)]"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Футер */}
            <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]">
              <button
                onClick={() => setShowIconSelector(false)}
                className="w-full px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/80 transition-colors"
              >
                {t("chat.done")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateFolderForm;
