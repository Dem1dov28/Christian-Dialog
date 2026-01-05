import React, { useState, useEffect, useRef } from "react";
import { useLanguage } from "../../contexts/LanguageContext";
import {
  MdClose,
  MdCheck,
  MdPsychology,
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdAutoAwesome,
  MdPerson,
  MdSchool,
  MdFavorite,
  MdFolderOpen,
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

const ChatSelector = ({
  isOpen = false,
  onClose = () => {},
  onChatsSelected = () => {},
  conversations = [],
  agents = [],
  groups = [],
  channels = [],
  folderId = null,
  existingChatIds = [],
}) => {
  const { t, translateAgent } = useLanguage();
  const [selectedChats, setSelectedChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isShown, setIsShown] = useState(false);
  const modalRef = useRef(null);
  const closingRef = useRef(false);

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
      setSelectedChats([]);
      setSearchQuery("");
    }
  }, [isOpen]);

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
    setTimeout(() => {
      setSelectedChats([]);
      setSearchQuery("");
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

  const handleConfirm = () => {
    if (selectedChats.length > 0) {
      onChatsSelected(selectedChats);
    }
    handleClose();
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
          const translatedAgent = translateAgent(agent);
          return `${translatedAgent.name} (${conversationIndex + 1})`;
        }

        return translateAgent(agent).name;
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

  // Фильтрация чатов по поисковому запросу и исключение уже добавленных (включая группы и каналы)
  const allAvailableChats = [...conversations, ...groups, ...channels];
  const filteredChats = allAvailableChats.filter((chat) => {
    // Исключаем чаты, которые уже есть в папке
    if (existingChatIds.includes(chat.id)) return false;

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
      className={`fixed inset-0 z-[55] flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm ${
        isShown ? "ai-panel-backdrop" : "ai-panel-backdrop-closing"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        ref={modalRef}
        onTransitionEnd={handleTransitionEnd}
        className={`bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[90vh] overflow-hidden ${
          isShown ? "ai-panel-modal-fade-in" : "ai-panel-modal-fade-out"
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
          <h3 className="text-lg font-semibold text-[var(--accent)]">
            {t("chat.addChatsToFolder")}
          </h3>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg text-[var(--text-dim)] hover:bg-[var(--hover-bg)] hover:text-[var(--accent)] transition-colors"
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
              className="w-full px-3 py-2 bg-[var(--bg-primary)] border border-[var(--border-color)] rounded-lg text-[var(--accent)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)] transition-colors"
            />
          </div>
        </div>

        {/* Список чатов */}
        <div className="max-h-96 overflow-y-auto">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => {
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
                          className: "text-lg text-[var(--accent)]",
                        })}
                      </div>
                    )}
                    <div>
                      <p className="text-[var(--accent)] font-medium">
                        {getChatDisplayName(chat)}
                      </p>
                      <p className="text-[var(--text-dim)] text-xs">
                        {chat.created_at
                          ? new Date(
                              chat.created_at
                            ).toLocaleDateString("ru-RU")
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
            })
          ) : (
            <div className="p-4 text-center text-[var(--text-dim)]">
              {searchQuery
                ? t("chat.noChatsFound")
                : t("chat.noAvailableChats")}
            </div>
          )}
        </div>

        {/* Футер */}
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--bg-tertiary)]">
          <div className="flex space-x-3">
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-[var(--accent)] font-medium hover:text-[var(--accent)] transition-colors"
            >
              {t("common.cancel")}
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedChats.length === 0}
              className="flex-1 px-4 py-2 bg-[var(--accent)] text-white rounded-lg font-medium hover:bg-[var(--accent)]/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t("chat.addChats")} ({selectedChats.length})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatSelector;
