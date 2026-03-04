import React, { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import {
  MdStar,
  MdNotifications,
  MdWork,
  MdCalculate,
  MdTranslate,
  MdWbSunny,
  MdPsychology,
  MdAutoAwesome,
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
import { BsPinFill } from "react-icons/bs";
import ChatActions from "./ChatActions";
import SystemChatActions from "./SystemChatActions";
import { useLanguage } from "../../contexts/LanguageContext";
import { useAgents } from "../../contexts/AgentsContext";

const ChatItem = ({
  title,
  time,
  preview,
  colorClass = "bg-[var(--accent)]",
  iconName = "chat_bubble",
  imageSrc,
  isSelected = false,
  unreadCount = 0,
  onClick = () => {},
  onDelete = null,
  id,
  agentId,
  conversationId,
  hasConversation = false,
  // Новые пропсы для групповых чатов
  isGroup = false,
  groupAvatar = null,
  // Пропс для системного чата
  isSystemChat = false,
  // Пропсы для каналов
  isChannel = false,
  canWriteChannel = false,
  // ChatActions callbacks
  onAddToCollection,
  onPinToTop,
  onDeleteAgent,
  onUnsubscribeChannel,
  onHideChat,
  onRenameChat, // Новый пропс для переименования чата
  // Пропсы для закрепления
  isPinned = false,
  // Пропсы для закрепления в папках
  folderId = null,
  onPinInFolder = null,
  onUnpinFromFolder = null,
  isPinnedInFolder = false,
  channelDescription = "",
}) => {
  const { t } = useLanguage();
  const { getAgent } = useAgents();
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [mousePosition, setMousePosition] = useState(null);
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
      bookmark: MdBookmark,
      broadcast: MdNotifications,
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
      fa_people_group: FaPeopleGroup,
      team_fill: RiTeamFill,
    };
    return iconMap[iconName] || MdStar; // По умолчанию звезда
  };

  const IconComponent = getIconComponent(iconName);
  const GroupIconComponent = getIconComponent(groupAvatar || "group");
  const handleRipple = useCallback((event) => {
    const element = event.currentTarget;
    const rect = element.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = `${size * 2}px`;
    ripple.style.height = `${size * 2}px`;
    const x = event.clientX - rect.left - size;
    const y = event.clientY - rect.top - size;
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;

    element.appendChild(ripple);

    const remove = () => {
      ripple.removeEventListener("animationend", remove);
      if (ripple.parentNode === element) {
        element.removeChild(ripple);
      }
    };
    ripple.addEventListener("animationend", remove);
  }, []);

  const handleClick = useCallback(
    (event) => {
      handleRipple(event);
      if (typeof onClick === "function") onClick(event);
    },
    [handleRipple, onClick]
  );

  // Remove old delete handler as it's now handled by ChatActions

  const handleRightClick = useCallback((event) => {
    event.preventDefault();
    event.stopPropagation();

    // Save mouse position
    setMousePosition({
      x: event.clientX,
      y: event.clientY,
    });

    setShowActions(true);
  }, []);

  const handleActionsExited = useCallback(() => {
    setShowActions(false);
  }, []);

  return (
    <div className="relative w-full">
      <div
        className={`has-ripple relative flex items-center w-full h-16 px-1.5 py-1.5 chat-item select-none ${
          isPressed ? "chat-item-pressed" : ""
        } ${isSelected ? "chat-item-selected" : ""}`}
        onClick={handleClick}
        onContextMenu={handleRightClick}
        onPointerDown={() => setIsPressed(true)}
        onPointerUp={() => setIsPressed(false)}
        onPointerLeave={() => setIsPressed(false)}
        onPointerCancel={() => setIsPressed(false)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex-shrink-0 mr-3">
          {isSystemChat ? (
            // Отображение для системного чата
            <img
              src={savedMessagesImage}
              alt={title}
              className="w-12 h-12 rounded-full object-cover shadow-md select-none"
            />
          ) : isChannel ? (
            imageSrc ? (
              <img
                src={imageSrc}
                alt={title}
                className="w-12 h-12 rounded-full object-cover shadow-md select-none"
              />
            ) : (
              <div
                className={`w-12 h-12 rounded-full ${
                  colorClass || "bg-[var(--accent)]"
                } flex items-center justify-center text-white shadow-md select-none`}
              >
                <MdNotifications style={{ fontSize: "26px" }} />
              </div>
            )
          ) : isGroup ? (
            // Отображение для групповых чатов
            imageSrc ? (
              // Если есть загруженный аватар, показываем его
              <img
                src={imageSrc}
                alt={title}
                className="w-12 h-12 rounded-full object-cover shadow-md select-none"
              />
            ) : (
              // Иначе показываем иконку
              <div className="relative w-12 h-12 rounded-full overflow-hidden select-none">
                <div
                  className="absolute inset-0 bg-center bg-cover shadow-md"
                  style={{ backgroundImage: "url('/images/agents/_low/Under_Icon_Groups.webp')" }}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  <GroupIconComponent
                    style={{ fontSize: "26px", transform: "scale(0.8)" }}
                  />
                </div>
              </div>
            )
          ) : imageSrc ? (
            <img
              src={imageSrc}
              alt={title}
              className="w-12 h-12 rounded-full object-cover shadow-md select-none"
            />
          ) : (
            <div
              className={`w-12 h-12 rounded-full ${
                colorClass || "bg-[var(--accent)]"
              } flex items-center justify-center text-white shadow-md select-none`}
            >
              <IconComponent
                style={{ fontSize: "26px", transform: "scale(0.8)" }}
              />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0 w-full">
          <div className="flex justify-between items-center mb-0.5 w-full">
            <div className="flex-1 min-w-0">
              <p className="truncate text-base font-semibold text-[var(--text-white)]">
                {title}
              </p>
            </div>
            <p
              className={`text-[12px] ${
                isSelected ? "text-[var(--text-white)]" : "text-[var(--text-gray)]"
              }`}
            >
              {time}
            </p>
          </div>
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center flex-1 min-w-0 w-full">
              <p
                className={`flex-1 min-w-0 text-[13px] truncate ${
                  isSelected ? "text-[var(--text-white)]" : "text-[var(--text-gray)]"
                }`}
              >
                {isChannel && channelDescription ? channelDescription : preview}
              </p>
              {(() => {
                const shouldShowPin = isPinned || isPinnedInFolder;
                if (shouldShowPin && !isPinned && isPinnedInFolder) {
                  console.log(`[ChatItem] Showing pin icon for chat ${id}, folderId=${folderId}, isPinnedInFolder=${isPinnedInFolder}`);
                }
                return shouldShowPin ? (
                  <BsPinFill
                    className={`ml-1 text-xs ${
                      isSelected
                        ? "text-[var(--text-white)]"
                        : folderId
                        ? "text-[var(--accent)]"
                        : "text-[var(--text-gray)]"
                    }`}
                    style={{ fontSize: "12px" }}
                    title={
                      folderId ? t("chat.pinnedInFolder") : t("chat.pinnedGlobally")
                    }
                  />
                ) : null;
              })()}
            </div>
            {unreadCount > 0 && (
              <span
                className="icon-box inline-flex items-center justify-center min-w-[20px] h-5 px-1 ml-2 flex-shrink-0 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: "var(--accent)", color: "#FFFFFF" }}
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ChatActions - рендерим через Portal для корректного позиционирования поверх чата */}
      {typeof window !== "undefined" && showActions && !isSystemChat && (() => {
        // Определяем, является ли это чатом модели
        const agent = agentId ? getAgent(agentId) : null;
        const isModelChat = agent && (() => {
          const category = (agent.category || "").toLowerCase();
          const synonyms = ["models", "модели", "ai модели", "ai models"];
          
          if (synonyms.some(syn => category === syn || category.includes(syn))) {
            return true;
          }
          
          const name = agent.name.toLowerCase();
          const modelNames = ["deepseek", "assistant", "ai", "gpt", "claude", "grok", "gemini"];
          return modelNames.some(modelName => name.includes(modelName));
        })();

        return createPortal(
          <ChatActions
            isOpen={showActions}
            onExited={handleActionsExited}
            chatId={id}
            agentId={agentId}
            conversationId={conversationId}
            mousePosition={mousePosition}
            onAddToCollection={onAddToCollection}
            onPinToTop={onPinToTop}
            onDeleteAgent={onDeleteAgent}
            onUnsubscribeChannel={onUnsubscribeChannel}
            onRenameChat={onRenameChat}
            isPinned={isPinned}
            // Пропсы для закрепления в папках
            folderId={folderId}
            onPinInFolder={onPinInFolder}
            onUnpinFromFolder={onUnpinFromFolder}
            isPinnedInFolder={isPinnedInFolder}
            isChannel={isChannel}
            isModelChat={isModelChat}
          />,
          document.body
        );
      })()}

      {/* SystemChatActions - для системного чата Saved Messages, рендерим через Portal */}
      {typeof window !== "undefined" && showActions && isSystemChat && createPortal(
        <SystemChatActions
          isOpen={showActions}
          onExited={handleActionsExited}
          chatId={id}
          conversationId={conversationId}
          mousePosition={mousePosition}
          onPinToTop={onPinToTop}
          onHideChat={onHideChat}
          isPinned={isPinned}
          // Пропсы для закрепления в папках
          folderId={folderId}
          onPinInFolder={onPinInFolder}
          onUnpinFromFolder={onUnpinFromFolder}
          isPinnedInFolder={isPinnedInFolder}
        />,
        document.body
      )}
    </div>
  );
};

export default ChatItem;
