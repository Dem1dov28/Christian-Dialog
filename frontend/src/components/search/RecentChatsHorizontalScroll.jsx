import React, { useMemo } from "react";
import {
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
  MdNotifications,
} from "react-icons/md";
import { FaPeopleGroup } from "react-icons/fa6";
import { RiTeamFill } from "react-icons/ri";
import { PiHandsClappingDuotone } from "react-icons/pi";
import { TbUserCog } from "react-icons/tb";
import { useChats } from "../../contexts/ChatsContext";
import { useAgents } from "../../contexts/AgentsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getAgentAvatarUrl, getGroupChatAvatarUrl } from "../../utils/agentAvatarUtils";

const RecentChatsHorizontalScroll = ({ onChatSelect }) => {
  const { conversations } = useChats();
  const { agents, getAgent } = useAgents();
  const { t, translateAgent } = useLanguage();

  // Получаем последние чаты, отсортированные по времени обновления
  const recentChats = useMemo(() => {
    if (!conversations || conversations.length === 0) {
      return [];
    }

    // Сортируем по updated_at (последние сначала) и берем первые 10
    return conversations
      .filter((chat) => chat.updated_at) // Фильтруем чаты с updated_at
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
      .slice(0, 10);
  }, [conversations]);

  // Функция для получения инициалов из названия чата
  const getInitials = (name) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Функция для получения цвета аватара
  const getAvatarColor = (chat) => {
    const isChannel = chat.is_channel || chat.isChannel;

    if (isChannel) {
      return (
        chat.colorClass ||
        chat.color_class ||
        "bg-[var(--accent)]"
      );
    }

    // Для групповых чатов используем специальные цвета
    if (chat.is_group) {
      const colors = [
        "bg-[var(--accent)]",
        "bg-[var(--accent)]",
        "bg-[var(--accent)]",
        "bg-[var(--accent)]",
        "bg-[var(--accent)]",
      ];
      const hash = chat.id
        .toString()
        .split("")
        .reduce((a, b) => {
          a = (a << 5) - a + b.charCodeAt(0);
          return a & a;
        }, 0);
      return colors[Math.abs(hash) % colors.length];
    }

    // Для обычных чатов используем цвета на основе agent_id
    // Используем акцентный цвет и его вариации для соответствия палитре темы
    const colors = [
      "bg-[var(--accent)]",
      "bg-[var(--accent)]",
      "bg-[var(--accent)]",
      "bg-[var(--accent)]",
      "bg-[var(--accent)]",
      "bg-[var(--accent)]",
      "bg-[var(--accent)]",
      "bg-[var(--accent)]",
    ];

    const hash = chat.agent_id ? chat.agent_id.toString() : chat.id.toString();
    const hashValue = hash.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0);

    return colors[Math.abs(hashValue) % colors.length];
  };

  const getGroupIconComponent = (iconName) => {
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
      star: MdStarBorder,
      star_border: MdStarBorder,
      fire: MdLocalFireDepartment,
      diamond: MdDiamond,
      fa_people_group: FaPeopleGroup,
      team_fill: RiTeamFill,
    };
    return iconMap[iconName] || MdGroup;
  };

  // Функция для получения аватара чата
  const getChatAvatar = (chat) => {
    const isChannel = chat.is_channel || chat.isChannel;

    if (isChannel) {
      const agent =
        (chat.agent_id && getAgent(chat.agent_id)) ||
        chat.agent ||
        null;
      const channelAvatar =
        chat.channel_avatar_url ||
        chat.imageSrc ||
        agent?.image_url ||
        agent?.avatar_url ||
        null;
      if (channelAvatar) {
        return {
          type: "image",
          src: channelAvatar,
        };
      }
      return {
        type: "channel",
        color: getAvatarColor(chat),
      };
    }

    if (chat.is_group) {
      // Проверяем, есть ли загруженный аватар
      const groupAvatarUrl = getGroupChatAvatarUrl(chat.group_avatar_url);
      if (groupAvatarUrl) {
        return {
          type: "image",
          src: groupAvatarUrl,
        };
      }
      
      // Иначе используем иконку
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
      const normalizedAvatar = (chat.group_avatar || "").toLowerCase();
      const iconName = allowedIcons.includes(normalizedAvatar)
        ? normalizedAvatar
        : "group";

      // Для групповых чатов используем ту же стилизацию, что и в списке чатов
      return {
        type: "group",
        icon: iconName,
      };
    } else {
      // Для обычных чатов
      const agent = chat.agent_id ? getAgent(chat.agent_id) : null;
      const agentAvatar = getAgentAvatarUrl(agent?.image_url, agent?.avatar_url, "low");
      if (agentAvatar) {
        return {
          type: "image",
          src: agentAvatar,
        };
      }
      return {
        type: "initials",
        initials: getInitials(chat.title || agent?.name || t("common.chat")),
        color: getAvatarColor(chat),
      };
    }
  };

  // Функция для получения названия чата
  const getChatTitle = (chat) => {
    const isChannel = chat.is_channel || chat.isChannel;

    if (isChannel) {
      return (
        chat.title ||
        chat.channel_description ||
        `${t("chat.channelTitleFallback", { defaultValue: "Канал" })} #${
          chat.id
        }`
      );
    }

    if (chat.is_group) {
      return chat.title || t("chat.groupChat");
    } else {
      const agent = chat.agent_id ? getAgent(chat.agent_id) : null;
      // Показываем только имя агента, а не название чата
      if (agent) {
        return translateAgent(agent).name || t("common.chat");
      }
      return t("common.chat");
    }
  };

  if (recentChats.length === 0) {
    return (
      <div className="px-4 py-3">
        <div className="flex items-center justify-center py-8">
          <span className="text-sm text-[var(--text-dim)]">
            {t("chat.noRecentChats")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 w-full">
      <div className="flex items-center justify-between mb-3 w-full">
        <h3 className="text-sm font-medium text-[var(--text-dim)]">
          {t("chat.recentChats")}
        </h3>
        <span className="text-xs text-[var(--text-dim)]">
          {recentChats.length} {t("chat.chatsCount")}
        </span>
      </div>

      {/* Горизонтальный скролл */}
      <div className="flex overflow-x-auto space-x-4 pb-2 scrollbar-hide w-full">
        {recentChats.map((chat) => {
          const avatar = getChatAvatar(chat);
          const title = getChatTitle(chat);

          return (
            <div
              key={chat.id}
              onClick={() => onChatSelect?.(chat)}
              className="flex flex-col items-center flex-shrink-0 w-20 cursor-pointer group relative z-10000 mt-6"
            >
              {/* Аватар чата */}
              <div className="relative">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[var(--bg-tertiary)] flex items-center justify-center group-hover:ring-2 group-hover:ring-[var(--accent)] group-hover:ring-opacity-80 transition-all duration-300" style={{ 
                  '--hover-shadow': '0 0 20px rgba(64, 224, 208, 0.4)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 20px hsla(var(--accent-hsl) / 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
                >
                  {avatar.type === "image" ? (
                    <img
                      src={avatar.src}
                      alt={title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        // Fallback к инициалам если изображение не загрузилось
                        e.target.style.display = "none";
                        e.target.nextSibling.style.display = "flex";
                      }}
                    />
                  ) : avatar.type === "group" ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="relative w-full h-full">
                        <div
                          className="absolute inset-0 bg-center bg-cover shadow-md"
                          style={{
                            backgroundImage:
                              "url('/images/agents/Under_Icon_Groups.png')",
                          }}
                          aria-hidden="true"
                        />
                        <div className="absolute inset-0 flex items-center justify-center text-white">
                          {(() => {
                            const GroupIcon = getGroupIconComponent(
                              avatar.icon
                            );
                            return (
                              <GroupIcon
                                style={{
                                  fontSize: "32px",
                                  transform: "scale(0.8)",
                                }}
                              />
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ) : avatar.type === "channel" ? (
                    <div
                      className={`w-full h-full ${avatar.color} flex items-center justify-center text-white`}
                    >
                      <MdNotifications style={{ fontSize: "28px" }} />
                    </div>
                  ) : null}
                  <div
                    className={`w-full h-full ${
                      avatar.color
                    } flex items-center justify-center text-white font-bold text-xl ${
                      avatar.type === "image" ||
                      avatar.type === "group" ||
                      avatar.type === "channel"
                        ? "hidden"
                        : "flex"
                    }`}
                  >
                    {avatar.initials}
                  </div>
                </div>
              </div>

              {/* Название чата */}
              <div className="mt-2 text-center w-full">
                <p className="text-sm text-[var(--text-white)] font-medium truncate group-hover:text-[var(--accent)] transition-all duration-300"
                style={{
                  filter: 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'drop-shadow(0 0 8px hsla(var(--accent-hsl) / 0.8))';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                }}
                >
                  {title}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentChatsHorizontalScroll;
