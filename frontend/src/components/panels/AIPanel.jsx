import React, { useEffect, useRef, useState, useMemo } from "react";
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
import { getIconComponent } from "../../utils/iconUtils";
import { getAgentLibraryCategory } from "../../utils/agentUtils";
import PinnedMessagesSection from "./PinnedMessagesSection";
import ExportChatSection from "./ExportChatSection";
import HideChatSection from "./HideChatSection";
import AgentSettingsSection from "./AgentSettingsSection";
import ImageModal from "../chat/ImageModal";
import { usePanelWidth } from "../../contexts/PanelWidthContext";

const SAVED_MESSAGES_IMAGE = "/images/agents/Saved_Messages.png";

const ExpandableDescription = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef = useRef(null);
  const { t } = useLanguage();

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
    window.addEventListener("resize", checkOverflow);
    return () => {
      window.removeEventListener("resize", checkOverflow);
      clearTimeout(timer);
    };
  }, [text]);

  return (
    <div className="flex flex-col items-center w-full px-2">
      <p
        ref={textRef}
        className="text-[var(--text-gray)] text-sm text-center transition-all duration-200"
        style={!isExpanded ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}}
      >
        {text}
      </p>
      {!isExpanded && isOverflowing && (
        <button
          onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
          className="text-blue-400 hover:text-blue-500 text-sm mt-0.5 hover:underline focus:outline-none cursor-pointer"
        >
          {t("common.more")}
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
  const { activeConversation, conversations } = useChats();
  const { getAgent, agents } = useAgents();
  const { t, translateAgent } = useLanguage();
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

  // Проверяем, является ли активный чат групповым или каналом
  const isGroupChat = activeConversation?.is_group ?? false;
  const isChannelChat = activeConversation?.is_channel ?? false;

  const currentAgentId = activeConversation?.agent_id ?? null;
  const currentAgent = currentAgentId ? getAgent(currentAgentId) : null;

  const groupAgentNames = useMemo(() => {
    if (!isGroupChat || !activeConversation?.group_agent_ids) return "";
    return activeConversation.group_agent_ids
      .map((agentId) => {
        const agent = agents?.find((a) => a.id === agentId) ?? conversations?.map((c) => c.agent).find((a) => a?.id === agentId);
        return agent ? translateAgent(agent).name : `Агент ${agentId}`;
      })
      .join(", ");
  }, [isGroupChat, activeConversation?.group_agent_ids, agents, conversations, translateAgent]);

  const chatTitle = useMemo(() => {
    if (!activeConversation) return t("chat.selectChat");
    if (activeConversation.is_system_chat) return activeConversation.title || t("chat.savedMessages");
    if (isChannelChat) return activeConversation.title || t("chat.channelTitleFallback");
    if (isGroupChat) return activeConversation.title || t("chat.groupChat");
    if (!currentAgent) return t("chat.selectAgent");
    if (activeConversation.title?.trim()) return activeConversation.title;
    const agentConversations = conversations?.filter((c) => c.agent_id === currentAgentId) ?? [];
    const translatedAgent = translateAgent(currentAgent);
    if (agentConversations.length <= 1) return t("chat.chatWith", { name: translatedAgent.name });
    const sorted = [...agentConversations].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const idx = sorted.findIndex((c) => c.id === activeConversation.id);
    return idx >= 0 ? `${translatedAgent.name} (${idx + 1})` : translatedAgent.name;
  }, [activeConversation, isGroupChat, isChannelChat, currentAgent, currentAgentId, conversations, translateAgent, t]);

  const currentChat = useMemo(() => {
    if (!activeConversation) return null;
    if (activeConversation.is_system_chat) {
      return {
        imageSrc: SAVED_MESSAGES_IMAGE,
        title: chatTitle,
        description: t("chat.savedMessages"),
        isCharacter: false,
      };
    }
    if (isChannelChat) {
      const channelAvatar = activeConversation.channel_avatar_url || (currentAgent && getAgentAvatarUrl(currentAgent.image_url, currentAgent.avatar_url));
      return {
        imageSrc: channelAvatar,
        title: chatTitle,
        description: activeConversation.channel_description || activeConversation.preview || t("chat.channelReadOnly", { defaultValue: "Только чтение" }),
        isCharacter: false,
      };
    }
    if (isGroupChat) {
      const groupAvatarUrl = getGroupChatAvatarUrl(activeConversation.group_avatar_url);
      return {
        imageSrc: groupAvatarUrl,
        title: chatTitle,
        description: groupAgentNames || t("chat.groupChatWith", { count: activeConversation.group_agent_ids?.length || 0 }),
        isCharacter: false,
      };
    }
    const agentAvatarUrl = getAgentAvatarUrl(currentAgent?.image_url, currentAgent?.avatar_url);
    const translatedAgent = currentAgent ? translateAgent(currentAgent) : null;
    const isCharacter = currentAgent ? getAgentLibraryCategory(currentAgent) === "characters" : false;
    return {
      imageSrc: agentAvatarUrl,
      iconName: currentAgent?.icon_name || "psychology",
      colorClass: currentAgent?.color_class || "bg-purple-500 dark:bg-purple-600",
      title: chatTitle,
      description: translatedAgent?.description || t("chat.startNewChat"),
      isCharacter,
      characterName: translatedAgent?.name,
    };
  }, [activeConversation, isGroupChat, isChannelChat, currentAgent, chatTitle, groupAgentNames, translateAgent, t]);

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

      {/* Скроллируемый контейнер с Navigation */}
      <div className="flex-1 overflow-y-auto chat-scrollbar min-h-0">
        {/* Navigation */}
        <div className="space-y-0">
          {/* Информация об агенте / чате */}
          {activeConversation && currentChat && (
            <div className="px-4 py-4 border-b border-[var(--border-color)]">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => currentChat.imageSrc && setIsImageModalOpen(true)}
                  className="focus:outline-none rounded-full overflow-hidden flex-shrink-0"
                >
                  {currentChat.imageSrc ? (
                    <img
                      src={currentChat.imageSrc}
                      alt={currentChat.title}
                      className="w-16 h-16 rounded-full object-cover shadow-md"
                    />
                  ) : (
                    <div
                      className={`w-16 h-16 rounded-full flex items-center justify-center text-white shadow-md ${currentChat.colorClass || "bg-purple-500 dark:bg-purple-600"}`}
                    >
                      {(() => {
                        const IconComponent = getIconComponent(currentChat.iconName || "psychology");
                        return <IconComponent className="text-2xl" style={{ transform: "scale(0.9)" }} />;
                      })()}
                    </div>
                  )}
                </button>
                <h4 className="font-medium text-base text-[var(--text-white)] text-center truncate w-full">{currentChat.title}</h4>
                {currentChat.description && (
                  <ExpandableDescription text={currentChat.description} />
                )}
                {currentChat.isCharacter && currentChat.characterName && (
                  <p className="text-xs text-[var(--text-gray)] text-center">
                    {t("chat.characterInspired", { name: currentChat.characterName })}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Закрепленные сообщения */}
          {!isChannelChat && (
            <PinnedMessagesSection activeConversationId={activeConversation?.id} />
          )}

          {/* Настройки агента */}
          <AgentSettingsSection activeConversationId={activeConversation?.id} />

          {/* Экспорт чата */}
          {!isChannelChat && (
            <ExportChatSection activeConversationId={activeConversation?.id} />
          )}

          {/* Спрятать чат - показываем только для системного чата */}
          {activeConversation?.is_system_chat && (
            <HideChatSection activeConversationId={activeConversation?.id} />
          )}
        </div>
      </div>

      {currentChat?.imageSrc && (
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          image={{ imageUrl: currentChat.imageSrc, displayName: currentChat.title }}
        />
      )}
    </>
  );

  if (isModal) {
    return (
      <>
        <div
          className={`bg-[var(--bg-secondary)] flex flex-col border border-[var(--border-color)] relative rounded-2xl shadow-2xl overflow-hidden h-full ${isClosing ? 'ai-panel-modal-fade-out' : 'ai-panel-modal-fade-in'}`}
          style={{ maxHeight: "calc(100dvh - 96px)" }}
        >
          {panelContent}
        </div>
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
    </>
  );
}
