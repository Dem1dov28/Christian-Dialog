import React from "react";
import PropTypes from "prop-types";
import { MdArrowBack, MdSearch, MdMoreVert, MdPlayArrow, MdGroup, MdNotifications } from "react-icons/md";
import { getAgentAvatarUrl, getGroupChatAvatarUrl } from "../../utils/agentAvatarUtils";

/**
 * Компонент заголовка чата
 * Отображает информацию о чате, аватар, кнопки действий
 */
function ChatHeader({
  // Chat info
  activeConversation,
  chatTitle,
  currentAgent,
  isGroupChat,
  isChannelChat,
  channelAvatar,
  channelColorClass,
  groupAgentNames,
  systemChat,
  IconComponent,
  getIconComponent,
  translateAgent,
  // UI state
  showBackButton,
  isShowBackButton,
  isDialogueLoading,
  isLoading,
  // Handlers
  onBack,
  onHeaderClick,
  onSearchClick,
  onMoreClick,
  onPlayClick,
  // Translations
  t,
}) {
  if (!activeConversation) {
    return null;
  }

  const isSystemChat = activeConversation.is_system_chat || (systemChat && activeConversation?.id === systemChat.id);

  return (
    <header
      className="flex items-center justify-between p-3 bg-[var(--header-bg)] border-b border-[var(--border-color)] cursor-pointer"
      onClick={onHeaderClick}
    >
      <div className="flex items-center min-w-0 flex-1">
        {showBackButton && isShowBackButton && typeof onBack === "function" && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onBack();
            }}
            className="mr-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            aria-label={t("common.back") || "Back"}
          >
            <MdArrowBack className="text-xl" />
          </button>
        )}

        {/* Аватар чата */}
        {isSystemChat ? (
          <img
            src={savedMessagesImage}
            alt="Saved Messages"
            className="w-10 h-10 rounded-full object-cover shadow-md mr-4 select-none flex-shrink-0"
          />
        ) : isGroupChat ? (
          (() => {
            // Проверяем, есть ли загруженный аватар
            const groupAvatarUrl = getGroupChatAvatarUrl(activeConversation.group_avatar_url);
            
            if (groupAvatarUrl) {
              // Отображаем загруженное изображение
              return (
                <img
                  src={groupAvatarUrl}
                  alt={chatTitle}
                  className="w-10 h-10 rounded-full object-cover shadow-md mr-4 select-none flex-shrink-0"
                  onError={(e) => {
                    console.warn("Failed to load group chat avatar:", groupAvatarUrl);
                    e.target.style.display = "none";
                  }}
                />
              );
            }
            
            // Иначе показываем иконку
            return (
              <div className="relative w-10 h-10 rounded-full overflow-hidden shadow-md mr-4 select-none flex-shrink-0">
                <div
                  className="absolute inset-0 bg-center bg-cover"
                  style={{ backgroundImage: "url('/images/agents/_low/Under_Icon_Groups.webp')" }}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 flex items-center justify-center text-white">
                  {activeConversation.group_avatar ? (
                    (() => {
                      const GroupIconComponent = getIconComponent(activeConversation.group_avatar);
                      return (
                        <GroupIconComponent className="text-xl" style={{ transform: "scale(0.8)" }} />
                      );
                    })()
                  ) : (
                    <MdGroup className="text-xl" style={{ transform: "scale(0.8)" }} />
                  )}
                </div>
              </div>
            );
          })()
        ) : isChannelChat ? (
          channelAvatar ? (
            <img
              src={channelAvatar}
              alt={chatTitle}
              className="w-10 h-10 rounded-full object-cover shadow-md mr-4 select-none flex-shrink-0"
            />
          ) : (
            <div
              className={`w-10 h-10 rounded-full ${
                channelColorClass || "bg-blue-500 dark:bg-blue-600"
              } flex items-center justify-center text-white shadow-md mr-4 select-none flex-shrink-0`}
            >
              {IconComponent ? (
                <IconComponent className="text-xl" style={{ transform: "scale(0.9)" }} />
              ) : (
                <MdNotifications className="text-xl" style={{ transform: "scale(0.9)" }} />
              )}
            </div>
          )
        ) : (() => {
          const agentAvatarUrl = getAgentAvatarUrl(currentAgent?.image_url, currentAgent?.avatar_url, "low");
          return agentAvatarUrl ? (
            <img
              key={agentAvatarUrl}
              src={agentAvatarUrl}
              alt={currentAgent ? translateAgent(currentAgent).name : "Agent"}
              className="w-10 h-10 rounded-full object-cover shadow-md mr-4 select-none flex-shrink-0"
              onError={(e) => {
                // Если изображение не загрузилось, скрываем его
                console.warn("Failed to load agent avatar:", agentAvatarUrl);
                e.target.style.display = "none";
              }}
            />
          ) : null;
        })() || (
          <div
            className={`w-10 h-10 rounded-full ${
              isChannelChat
                ? channelColorClass || "bg-blue-500 dark:bg-blue-600"
                : currentAgent?.color_class || "bg-purple-500 dark:bg-purple-600"
            } flex items-center justify-center text-white shadow-md mr-4 select-none flex-shrink-0`}
          >
            <IconComponent className="text-xl" style={{ transform: "scale(0.8)" }} />
          </div>
        )}

        {/* Информация о чате */}
        <div className="min-w-0 flex-1">
          <h2 className="font-medium text-base truncate text-[var(--text-white)] select-none">
            {chatTitle}
          </h2>
          <p className="text-sm text-[var(--text-gray)] truncate select-none">
            {isChannelChat
              ? activeConversation.channel_description ||
                activeConversation.preview ||
                t("chat.channelReadOnly", { defaultValue: "Только чтение" })
              : activeConversation.is_system_chat
              ? t("chat.savedMessages")
              : isGroupChat
              ? groupAgentNames ||
                t("chat.groupChatWith", { count: activeConversation.group_agent_ids?.length || 0 })
              : currentAgent
              ? translateAgent(currentAgent).description || t("chat.startNewChat")
              : t("chat.startNewChat")}
          </p>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex items-center space-x-2 text-[var(--text-gray)] flex-shrink-0">
        {isGroupChat && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onPlayClick?.(e);
            }}
            disabled={isDialogueLoading || isLoading}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--button-hover-bg)] transition-colors duration-200 pointer-events-auto group disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              isDialogueLoading
                ? "Генерация диалога..."
                : isLoading
                ? "Отправка сообщения..."
                : "Запустить диалог между агентами"
            }
          >
            {isDialogueLoading ? (
              <div className="loader"></div>
            ) : (
              <MdPlayArrow className="text-xl group-hover:text-[var(--accent)] transition-colors duration-200" />
            )}
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSearchClick?.(e);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--button-hover-bg)] transition-colors duration-200 pointer-events-auto group"
        >
          <MdSearch className="text-xl group-hover:text-[var(--accent)] transition-colors duration-200" />
        </button>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onMoreClick?.(e);
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-[var(--button-hover-bg)] transition-colors duration-200 pointer-events-auto group"
        >
          <MdMoreVert className="text-xl group-hover:text-[var(--accent)] transition-colors duration-200" />
        </button>
      </div>
    </header>
  );
}

ChatHeader.propTypes = {
  activeConversation: PropTypes.object,
  chatTitle: PropTypes.string.isRequired,
  currentAgent: PropTypes.object,
  isGroupChat: PropTypes.bool.isRequired,
  isChannelChat: PropTypes.bool.isRequired,
  channelAvatar: PropTypes.string,
  channelColorClass: PropTypes.string,
  groupAgentNames: PropTypes.string,
  systemChat: PropTypes.object,
  IconComponent: PropTypes.elementType,
  getIconComponent: PropTypes.func.isRequired,
  translateAgent: PropTypes.func.isRequired,
  showBackButton: PropTypes.bool.isRequired,
  isShowBackButton: PropTypes.bool.isRequired,
  isDialogueLoading: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  onBack: PropTypes.func,
  onHeaderClick: PropTypes.func.isRequired,
  onSearchClick: PropTypes.func.isRequired,
  onMoreClick: PropTypes.func.isRequired,
  onPlayClick: PropTypes.func,
  t: PropTypes.func.isRequired,
};

export default ChatHeader;



