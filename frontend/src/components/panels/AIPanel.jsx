import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  MdClose,
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
  MdSmartToy,
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
  MdBookmark,
} from "react-icons/md";
import { FaPeopleGroup } from "react-icons/fa6";
import { RiTeamFill } from "react-icons/ri";
import { PiHandsClappingDuotone } from "react-icons/pi";
import { TbUserCog } from "react-icons/tb";
import { useAgents } from "../../contexts/AgentsContext";
import { useChats } from "../../contexts/ChatsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { getAgentAvatarUrl, getGroupChatAvatarUrl } from "../../utils/agentAvatarUtils";
import PinnedMessagesSection from "./PinnedMessagesSection";
import InformationSection from "./InformationSection";
import ExportChatSection from "./ExportChatSection";
import ClearChatSection from "./ClearChatSection";
import RemoveAgentSection from "./RemoveAgentSection";
import HideChatSection from "./HideChatSection";
import AgentSettingsSection from "./AgentSettingsSection";
import ImageModal from "../chat/ImageModal";
import { usePanelWidth } from "../../contexts/PanelWidthContext";

const ExpandableDescription = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    setIsExpanded(false);
  }, [text]);

  useEffect(() => {
    const checkOverflow = () => {
      if (textRef.current) {
        const hasOverflow = textRef.current.scrollHeight > textRef.current.clientHeight + 1;
        setIsOverflowing(hasOverflow);
      }
    };

    checkOverflow();
    const timer = setTimeout(checkOverflow, 100);

    window.addEventListener('resize', checkOverflow);
    return () => {
      window.removeEventListener('resize', checkOverflow);
      clearTimeout(timer);
    };
  }, [text]);

  return (
    <div className="flex flex-col items-center w-full px-2">
      <p
        ref={textRef}
        className="text-[var(--text-gray)] text-sm text-center transition-all duration-200"
        style={!isExpanded ? {
          display: '-webkit-box',
          WebkitLineClamp: 4,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        } : {}}
      >
        {text}
      </p>
      {!isExpanded && isOverflowing && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(true);
          }}
          className="text-blue-400 hover:text-blue-500 text-sm mt-0.5 hover:underline focus:outline-none cursor-pointer"
        >
          еще...
        </button>
      )}
    </div>
  );
};

export default function AIPanel({
  onClose,
  activeChatId,
  chatData,
  onDeleteChat,
  isModal = false,
  isClosing = false,
}) {
  const { getAgent, agents } = useAgents();
  const { activeConversation, messages, conversations } = useChats();
  const { translateAgent, t } = useLanguage();
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const {
    sidebarWidth,
    updateRightPanelWidth,
    setRightPanelOpen,
  } = usePanelWidth();

  // Состояние для ширины правой панели с сохранением в localStorage
  const [rightPanelWidth, setRightPanelWidth] = useState(() => {
    try {
      const stored =
        typeof window !== "undefined"
          ? window.localStorage.getItem("rightPanelWidth")
          : null;
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (Number.isFinite(parsed) && parsed >= 240 && parsed <= 450) {
        return parsed;
      }
    } catch { }
    return 280; // значение по умолчанию
  });

  // Состояние для анимации появления панели - начинаем с 0
  const [displayWidth, setDisplayWidth] = useState(0);

  // Получаем данные текущего агента из активного разговора
  const currentAgentId = activeConversation?.agent_id ?? null;
  const currentAgent = currentAgentId ? getAgent(currentAgentId) : null;

  // Проверяем, является ли активный чат групповым
  const isGroupChat = activeConversation?.is_group ?? false;
  const isChannelChat = activeConversation?.is_channel ?? false;

  // Мемоизированная функция для получения имен агентов группы
  const groupAgentNames = useMemo(() => {
    if (!isGroupChat || !activeConversation?.group_agent_ids) {
      return "";
    }

    const agentNames = activeConversation.group_agent_ids
      .map((agentId) => {
        const agent = agents.find((a) => a.id === agentId);
        if (agent) {
          const translatedAgent = translateAgent(agent);
          return translatedAgent.name;
        }
        return `${t("chat.agent")} ${agentId}`;
      })
      .join(", ");

    return agentNames;
  }, [isGroupChat, activeConversation?.group_agent_ids, agents, translateAgent, t]);

  // Функция для определения категории агента
  const getAgentCategory = useCallback((agent) => {
    if (!agent) return null;

    // Используем категорию из базы данных, если она есть
    if (agent.category && agent.category !== 'general') {
      return agent.category;
    }

    // Определяем категорию на основе имени или описания агента
    const name = agent.name.toLowerCase();
    const description = (agent.description || '').toLowerCase();

    if (name.includes('deepseek') || name.includes('assistant') || name.includes('ai') ||
      description.includes('ai') || description.includes('модель') || description.includes('ассистент')) {
      return 'models';
    }

    if (name.includes('калькулятор') || name.includes('перевод') || name.includes('погода') ||
      description.includes('инструмент') || description.includes('утилита') || description.includes('математический')) {
      return 'tools';
    }

    return 'chats';
  }, []);

  // Мемоизированная категория текущего агента
  const agentCategory = useMemo(() => {
    if (
      !currentAgent ||
      isGroupChat ||
      isChannelChat ||
      activeConversation?.is_system_chat
    ) {
      return null;
    }
    return getAgentCategory(currentAgent);
  }, [
    currentAgent,
    isGroupChat,
    isChannelChat,
    activeConversation?.is_system_chat,
    getAgentCategory,
  ]);

  // Мемоизированный динамический заголовок чата, как в левой панели
  const chatTitle = useMemo(() => {
    if (!activeConversation) {
      return t("chat.aiAssistant");
    }

    // Проверяем, является ли это системным чатом
    if (activeConversation.is_system_chat) {
      return activeConversation.title || t("chat.savedMessages");
    }

    if (isChannelChat) {
      return (
        activeConversation.title ||
        t("chat.channelTitleFallback", { defaultValue: "Канал" })
      );
    }

    if (isGroupChat) {
      return activeConversation.title || t("chat.groupChat");
    }

    if (!currentAgent) {
      return t("chat.aiAssistant");
    }

    // Если у разговора есть сохраненное название, используем его
    if (activeConversation.title && activeConversation.title.trim()) {
      return activeConversation.title;
    }

    // Находим все разговоры с этим агентом
    const agentConversations = conversations.filter(
      (conv) => conv.agent_id === currentAgentId
    );

    const translatedAgent = translateAgent(currentAgent);
    if (agentConversations.length <= 1) {
      return translatedAgent.name;
    }

    // Находим индекс текущего разговора среди всех разговоров с агентом
    // Номера чатов определяются по времени создания (фиксированные номера)
    // Используем ту же логику, что и в Sidebar и Chat.jsx: сортировка по возрастанию времени создания
    const sortedConversations = agentConversations.sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    );
    const conversationIndex = sortedConversations.findIndex(
      (conv) => conv.id === activeConversation.id
    );

    const title = `${translatedAgent.name} (${conversationIndex + 1})`;
    console.log(`AIPanel title for ${currentAgent.name}:`, {
      conversationId: activeConversation.id,
      conversationIndex,
      title,
      sortedConversations: sortedConversations.map((c) => ({
        id: c.id,
        created_at: c.created_at,
      })),
    });

    return title;
  }, [
    activeConversation,
    isChannelChat,
    isGroupChat,
    currentAgent,
    currentAgentId,
    conversations,
    translateAgent,
    t,
  ]);

  // Получаем данные чата
  const currentChat = useMemo(() => {
    if (!activeConversation) {
      return { info: { name: t("chat.aiAssistant"), colorClass: "bg-purple-500" } };
    }

    // КРИТИЧНО: Проверяем канал ПЕРЕД системным чатом, чтобы каналы не показывали иконку Saved Messages
    // Проверяем как is_channel, так и наличие channel_owner_id для надежности
    const isChannel = isChannelChat ||
      activeConversation.is_channel === true ||
      (activeConversation.channel_owner_id != null && !activeConversation.is_group);

    if (isChannel) {
      return {
        info: {
          name:
            activeConversation.title ||
            t("chat.channelTitleFallback", { defaultValue: "Канал" }),
          colorClass:
            activeConversation.colorClass || "bg-blue-500 dark:bg-blue-600",
          iconName: activeConversation.iconName || "notifications",
          imageSrc:
            activeConversation.imageSrc ||
            activeConversation.channel_avatar_url ||
            getAgentAvatarUrl(currentAgent?.image_url, currentAgent?.avatar_url, "medium"),
          originalImageSrc:
            activeConversation.imageSrc ||
            activeConversation.channel_avatar_url ||
            getAgentAvatarUrl(currentAgent?.image_url, currentAgent?.avatar_url, "high"),
          ChatInfo:
            activeConversation.channel_description ||
            activeConversation.preview ||
            t("chat.channelReadOnly", { defaultValue: "Только чтение" }),
          model: null,
          temperature: null,
          maxTokens: null,
          isActive: true,
        },
      };
    }

    if (isGroupChat) {
      return {
        info: {
          name: activeConversation.title || t("chat.groupChat"),
          colorClass: "bg-purple-500",
          iconName: activeConversation.group_avatar || "group",
          imageSrc: getGroupChatAvatarUrl(activeConversation.group_avatar_url), // Используем загруженный аватар, если есть
          ChatInfo:
            groupAgentNames ||
            t("chat.groupChatWith", {
              count: activeConversation.group_agent_ids?.length || 0,
            }),
          model: null,
          temperature: null,
          maxTokens: null,
          isActive: true,
        },
      };
    }

    if (isGroupChat) {
      return {
        info: {
          name: activeConversation.title || t("chat.groupChat"),
          colorClass: "bg-purple-500",
          iconName: activeConversation.group_avatar || "group",
          imageSrc: getGroupChatAvatarUrl(activeConversation.group_avatar_url), // Используем загруженный аватар, если есть
          ChatInfo:
            groupAgentNames ||
            t("chat.groupChatWith", {
              count: activeConversation.group_agent_ids?.length || 0,
            }),
          model: null,
          temperature: null,
          maxTokens: null,
          isActive: true,
        },
      };
    }

    // КРИТИЧНО: Проверяем системный чат, но исключаем каналы (даже если у них is_system_chat: true)
    if (activeConversation.is_system_chat && !isChannelChat && !activeConversation.is_channel) {
      return {
        info: {
          name: activeConversation.title || t("chat.savedMessages"),
          colorClass: "bg-gray-500",
          iconName: "bookmark",
          imageSrc: savedMessagesImage,
          ChatInfo: t("chat.savedMessages"),
          model: null,
          temperature: null,
          maxTokens: null,
          isActive: true,
        },
      };
    }

    if (currentAgent) {
      const translatedAgent = translateAgent(currentAgent);
      return {
        info: {
          name: translatedAgent.name,
          colorClass: translatedAgent.color_class || "bg-purple-500",
          iconName: translatedAgent.icon_name || "psychology",
          imageSrc: getAgentAvatarUrl(translatedAgent.image_url, translatedAgent.avatar_url, "medium"),
          originalImageSrc: getAgentAvatarUrl(translatedAgent.image_url, translatedAgent.avatar_url, "high"),
          ChatInfo:
            translatedAgent.description || t("chat.startNewChat"),
          model: translatedAgent.model,
          temperature: translatedAgent.temperature,
          maxTokens: translatedAgent.max_tokens,
          isActive: translatedAgent.is_active,
        },
      };
    }

    return {
      info: {
        name: t("chat.aiAssistant"),
        colorClass: "bg-purple-500",
        iconName: "psychology",
        ChatInfo: t("chat.aiAssistant"),
        imageSrc: null
      }
    };
  }, [
    activeConversation,
    isChannelChat,
    isGroupChat,
    currentAgent,
    groupAgentNames,
    translateAgent,
    t,
  ]);

  const { name, colorClass, iconName, ChatInfo, imageSrc, originalImageSrc } = currentChat.info;

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
      // Иконки для групповых чатов
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
      // Иконка для системного чата
      bookmark: MdBookmark,
      fa_people_group: FaPeopleGroup,
      team_fill: RiTeamFill,
    };
    const IconComponent = iconMap[iconName] || MdSmartToy;
    return <IconComponent className="text-2xl" />;
  };

  const asideRef = useRef(null);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  const [isResizing, setIsResizing] = useState(false);

  // Сохранение ширины в localStorage и установка CSS переменной
  useEffect(() => {
    if (isModal) {
      if (typeof document !== "undefined") {
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      }
      return;
    }

    const el = asideRef.current;
    if (!el) return;

    el.style.width = `${rightPanelWidth}px`;

    if (typeof document !== "undefined") {
      document.documentElement.style.setProperty(
        "--right-panel-width",
        `${rightPanelWidth}px`
      );
    }

    try {
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "rightPanelWidth",
          String(Math.round(rightPanelWidth))
        );
      }
    } catch { }

    if (!isModal) {
      updateRightPanelWidth(rightPanelWidth);
    }
  }, [rightPanelWidth, isModal, updateRightPanelWidth]);

  useEffect(() => {
    if (isModal) {
      setRightPanelOpen(false);
      setDisplayWidth(0);
      return;
    }

    if (isClosing) {
      // Анимация закрытия: плавно уменьшаем ширину до 0
      setRightPanelOpen(false);
      setDisplayWidth(0);
      return;
    }

    setRightPanelOpen(true);
    // Запускаем анимацию: начинаем с 0, затем плавно увеличиваем до нужной ширины
    // Используем requestAnimationFrame для плавной анимации при первом появлении
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setDisplayWidth(rightPanelWidth);
      });
    });

    return () => {
      if (!isClosing) {
        setRightPanelOpen(false);
      }
    };
  }, [isModal, isClosing, setRightPanelOpen, rightPanelWidth]);

  // Обновляем displayWidth при изменении rightPanelWidth (например, при ресайзе)
  // Не обновляем во время закрытия
  // Во время ресайза обновляем мгновенно (без transition)
  useEffect(() => {
    if (!isModal && !isClosing && displayWidth > 0 && displayWidth !== rightPanelWidth) {
      // Если идет ресайз, обновляем мгновенно
      if (isResizing) {
        setDisplayWidth(rightPanelWidth);
      } else {
        // Если не идет ресайз, обновляем плавно
        setDisplayWidth(rightPanelWidth);
      }
    }
  }, [rightPanelWidth, isModal, isClosing, displayWidth, isResizing]);

  useEffect(() => {
    if (isModal || typeof window === "undefined") {
      return;
    }

    const handleMouseMove = (e) => {
      if (!isResizingRef.current) return;
      const deltaX = startXRef.current - e.clientX; // dragging left increases width
      const navIconsWidth = 80; // должен совпадать с NavigationIcons
      const availableWidth =
        (window.innerWidth || startWidthRef.current) -
        (sidebarWidth + navIconsWidth);
      const MAIN_MIN_WIDTH = 420;
      const MAX_PANEL_WIDTH = 450;
      const MIN_PANEL_WIDTH = 240;

      const maxAllowedByLayout = Math.max(
        MIN_PANEL_WIDTH,
        availableWidth - MAIN_MIN_WIDTH
      );

      const maxWidth = Math.min(MAX_PANEL_WIDTH, maxAllowedByLayout);

      const rawWidth = startWidthRef.current + deltaX;
      const clampedWidth = Math.min(
        maxWidth,
        Math.max(MIN_PANEL_WIDTH, rawWidth)
      );

      const roundedWidth = Math.round(clampedWidth);
      setRightPanelWidth(roundedWidth);
      updateRightPanelWidth(roundedWidth);
      // Обновляем displayWidth мгновенно во время ресайза (transition отключен через isResizing)
      setDisplayWidth(roundedWidth);
    };

    const handleMouseUp = () => {
      if (!isResizingRef.current) return;
      isResizingRef.current = false;
      setIsResizing(false);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isModal, sidebarWidth, updateRightPanelWidth]);

  const handleResizeMouseDown = (e) => {
    if (isModal) {
      return;
    }
    isResizingRef.current = true;
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = rightPanelWidth;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    e.preventDefault();
  };

  const panelContent = (
    <>
      {/* Header */}
      <div className="p-4 flex items-center justify-between border-b border-[var(--border-color)]">
        <h3 className="text-lg font-medium text-[var(--text-white)] select-none">
          {t("chat.aiPanel")}
        </h3>
        <button
          className="text-[var(--text-gray)] hover:bg-[var(--hover-bg)] rounded p-1 transition-colors"
          onClick={onClose}
        >
          <MdClose className="text-xl" />
        </button>
      </div>

      {/* Скроллируемый контейнер с Chat Info и Navigation */}
      <div className="flex-1 overflow-y-auto chat-scrollbar min-h-0">
        {/* Chat Info */}
        <div className="p-4 border-b border-[var(--border-color)]">
          <div className="flex flex-col items-center">
            {isGroupChat ? (
              // Отображение аватарки для группового чата
              (() => {
                // Проверяем, есть ли загруженный аватар
                const groupAvatarUrl = getGroupChatAvatarUrl(activeConversation?.group_avatar_url);

                if (groupAvatarUrl) {
                  // Отображаем загруженное изображение
                  return (
                    <img
                      src={groupAvatarUrl}
                      alt={name}
                      className="w-16 h-16 rounded-full object-cover shadow-md select-none mb-3"
                      onError={(e) => {
                        console.warn("Failed to load group chat avatar in AI Panel:", groupAvatarUrl);
                        e.target.style.display = "none";
                        const fallback = e.target.nextElementSibling;
                        if (fallback) {
                          fallback.style.display = "flex";
                        }
                      }}
                    />
                  );
                }

                // Иначе показываем иконку
                return (
                  <div className="relative w-16 h-16 rounded-full overflow-hidden shadow-md select-none mb-3">
                    <div
                      className="absolute inset-0 bg-center bg-cover"
                      style={{ backgroundImage: "url('/images/agents/Under_Icon_Groups.png')" }}
                      aria-hidden="true"
                    />
                    <div className="absolute inset-0 flex items-center justify-center text-white">
                      {getIconComponent(iconName)}
                    </div>
                  </div>
                );
              })()
            ) : isChannelChat ? (
              imageSrc ? (
                <img
                  src={imageSrc}
                  alt={name}
                  className="w-16 h-16 rounded-full object-cover shadow-md select-none mb-3"
                  onError={(e) => {
                    // Если изображение не загрузилось, скрываем его и показываем fallback
                    console.warn("Failed to load agent avatar in AI Panel:", imageSrc);
                    e.target.style.display = "none";
                    const fallback = e.target.nextElementSibling;
                    if (fallback) {
                      fallback.style.display = "flex";
                    }
                  }}
                />
              ) : (
                <div
                  className={`w-16 h-16 rounded-full ${colorClass || "bg-blue-500 dark:bg-blue-600"
                    } flex items-center justify-center text-white shadow-md select-none mb-3`}
                >
                  {getIconComponent(iconName)}
                </div>
              )
            ) : imageSrc ? (
              <img
                src={imageSrc}
                alt={name}
                className={`w-16 h-16 rounded-full object-cover shadow-md select-none mb-3 ${!activeConversation?.is_system_chat && !isGroupChat && currentAgent
                  ? "cursor-pointer hover:opacity-80 transition-opacity"
                  : ""
                  }`}
                onClick={() => {
                  // Открываем модальное окно только для чатов с агентами (не групп и не системных)
                  if (!activeConversation?.is_system_chat && !isGroupChat && currentAgent && imageSrc) {
                    setIsImageModalOpen(true);
                  }
                }}
                onError={(e) => {
                  // Если изображение не загрузилось, скрываем его и показываем fallback
                  console.warn("Failed to load agent avatar in AI Panel:", imageSrc);
                  e.target.style.display = "none";
                  const fallback = e.target.parentElement?.querySelector(".avatar-fallback");
                  if (fallback) {
                    fallback.style.display = "flex";
                  }
                }}
              />
            ) : (
              <div
                className={`w-16 h-16 rounded-full ${colorClass || "bg-purple-500 dark:bg-purple-600"
                  } flex items-center justify-center text-white shadow-md select-none mb-3`}
              >
                {getIconComponent(iconName)}
              </div>
            )}
            <h3 className="font-medium text-xl mb-1 text-[var(--text-white)]">
              {chatTitle}
            </h3>
            <ExpandableDescription text={ChatInfo} key={activeConversation?.id || ChatInfo} />
            {/* Описание для персонажей */}
            {agentCategory === "chats" && currentAgent && (
              <p className="text-[var(--text-gray)] text-xs text-center mt-2 select-none">
                {t("chat.characterInspired", { name: currentAgent.name })}
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="space-y-0">
          {/* Закрепленные сообщения */}
          {!isChannelChat && (
            <PinnedMessagesSection activeConversationId={activeConversation?.id} />
          )}

          {/* Информация */}
          <InformationSection
            activeConversationId={activeConversation?.id}
            isSystemChat={activeConversation?.is_system_chat}
          />

          {/* Настройки агента */}
          <AgentSettingsSection activeConversationId={activeConversation?.id} />

          {/* Экспорт чата */}
          {!isChannelChat && (
            <ExportChatSection activeConversationId={activeConversation?.id} />
          )}

          {/* Очистить чат */}
          {!isChannelChat && (
            <ClearChatSection activeConversationId={activeConversation?.id} />
          )}

          {/* Удалить агента / Отписаться */}
          {(!activeConversation?.is_system_chat || isChannelChat) && (
            <RemoveAgentSection
              activeConversationId={activeConversation?.id}
              onDeleteChat={onDeleteChat}
            />
          )}

          {/* Спрятать чат - показываем только для системного чата */}
          {activeConversation?.is_system_chat && (
            <HideChatSection activeConversationId={activeConversation?.id} />
          )}
        </div>
      </div>
    </>
  );

  const shouldShowImageModal =
    !activeConversation?.is_system_chat && !isGroupChat && currentAgent && imageSrc;

  const imageModal = shouldShowImageModal ? (
    <ImageModal
      isOpen={isImageModalOpen}
      image={{
        imageUrl: originalImageSrc || imageSrc,
        displayName: currentAgent.name,
      }}
      onClose={() => setIsImageModalOpen(false)}
    />
  ) : null;

  if (isModal) {
    return (
      <>
        <div
          className={`bg-[var(--bg-secondary)] flex flex-col border border-[var(--border-color)] relative rounded-2xl shadow-2xl overflow-hidden h-full ${isClosing ? 'ai-panel-modal-fade-out' : 'ai-panel-modal-fade-in'}`}
          style={{ maxHeight: "calc(100dvh - 96px)" }}
        >
          {panelContent}
        </div>
        {imageModal}
      </>
    );
  }

  return (
    <>
      <div
        className={`ai-panel-wrapper ${isClosing ? 'ai-panel-closing' : ''} relative`}
        style={{
          width: `${displayWidth}px`,
          minWidth: 0,
          transition: isResizing ? 'none' : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          overflow: 'hidden',
          flexShrink: 0
        }}
      >
        <div
          onMouseDown={handleResizeMouseDown}
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-[var(--border-color)] z-10"
          aria-hidden="true"
        />
        <aside
          ref={asideRef}
          className={`bg-[var(--bg-secondary)] flex flex-col border-l border-[var(--border-color)] relative h-full ${isClosing ? 'ai-panel-slide-out' : 'ai-panel-slide-in'}`}
          style={{
            width: `${rightPanelWidth}px`,
            minWidth: `${rightPanelWidth}px`,
            flexShrink: 0
          }}
        >
          {panelContent}
        </aside>
      </div>
      {imageModal}
    </>
  );
}
