import React from "react";
import PropTypes from "prop-types";
import LeftMessage from "./LeftMessage";
import RightMessage from "./RightMessage";

/**
 * Компонент для отображения списка сообщений в чате
 * Обрабатывает рендеринг сообщений, выделение, контекстное меню и touch-события
 */
const ChatMessagesList = ({
  windowedMessages,
  selectedMessagesSet,
  highlightedMessageId,
  activeMessageId,
  messageRefs,
  theme,
  selectionActive,
  isSelecting,
  onMessageClick,
  onMessageContextMenu,
  onMessageTouchStart,
  onMessageTouchMove,
  onMessageTouchEnd,
  onMessageTouchCancel,
  openMenuAtEventWithChecks,
  // Пропсы для рендеринга сообщений
  handleMessageMouseDown,
  handleMessageMouseEnter,
  handleMessageMouseUp,
  handleContentMouseDown,
  handleOriginalChatClick,
}) => {
  // Функция для рендеринга отдельного сообщения
  const renderMessage = (message) => {
    const {
      type,
      text,
      time,
      id,
      agentName,
      agentId,
      originalChatName,
      originalAgentName,
      original_message_id,
      original_chat_id,
      state,
      is_thinking,
      estimated_duration,
      reply,
      file_attachments,
    } = message;

    const commonProps = {
      text,
      time,
      messageId: id,
      messageState: state,
      fileAttachments: file_attachments || [],
      isSelected: selectedMessagesSet.has(id),
      onSelectMouseDown: (e) => handleMessageMouseDown(e, id),
      onSelectMouseEnter: (e) => handleMessageMouseEnter(e, id),
      onSelectMouseUp: handleMessageMouseUp,
      selectionActive,
      onSelectContentMouseDown: (e) => handleContentMouseDown(e, id),
      onOriginalChatClick: (chatName, agentName) =>
        handleOriginalChatClick(
          chatName,
          agentName,
          original_message_id,
          original_chat_id
        ),
      onContextMenu: (e) => {
        if (selectionActive) {
          e.preventDefault();
          return;
        }
        const selection = window.getSelection();
        if (selection && selection.toString().trim().length > 0) {
          return;
        }
        if (e.button === 2) {
          e.preventDefault();
          openMenuAtEventWithChecks(e, id);
        }
      },
    };

    switch (type) {
      case "left":
        return (
          <LeftMessage
            key={id}
            {...commonProps}
            agentName={agentName}
            agentId={agentId}
            originalChatName={originalChatName}
            originalAgentName={originalAgentName}
            isThinking={is_thinking}
            estimatedDuration={estimated_duration}
          />
        );
      case "right":
        return (
          <RightMessage
            key={id}
            {...commonProps}
            originalChatName={originalChatName}
            originalAgentName={originalAgentName}
            reply={reply}
          />
        );
      case "day-separator":
        return (
          <div key={id} className="flex justify-center my-4">
            <span className="bg-[var(--accent)] text-sm text-white rounded-full px-3 py-1 select-none">
              {text}
            </span>
          </div>
        );
      default:
        return null;
    }
  };
  return (
    <section className="-mx-3 sm:-mx-6 flex flex-col justify-end flex-1" aria-label="Messages history list">
      <div className="chat-messages-container">
        <ol
          className="w-full flex flex-col-reverse list-none p-0 m-0"
          role="listbox"
          aria-multiselectable={true}
          aria-label="Messages"
        >
          {windowedMessages
            .slice()
            .reverse()
            .map((message) => {
              const isSelected = selectedMessagesSet.has(message.id);
              const isActive = activeMessageId === message.id;
              const isHighlighted = String(highlightedMessageId) === String(message.id);

              let bgColor = "transparent";
              if (isSelected) {
                bgColor = theme === "light"
                  ? "rgba(96, 165, 250, 0.6)" // blue-400 с прозрачностью
                  : "rgba(59, 130, 246, 0.4)"; // blue-500 с прозрачностью
              } else if (isActive) {
                bgColor = "rgba(0, 0, 0, 0.18)";
              } else if (isHighlighted) {
                bgColor = "rgba(0, 0, 0, 0.3)";
              }

              return (
                <li
                  key={`row-${message.id}`}
                  role="option"
                  aria-selected={isSelected}
                  tabIndex={0}
                  data-message-id={message.id}
                  ref={(el) => {
                    if (el) {
                      messageRefs.current[message.id] = el;
                    } else {
                      delete messageRefs.current[message.id];
                    }
                  }}
                  className="w-full list-none p-0 m-0"
                  onMouseDown={(e) => handleMessageMouseDown(e, message.id)}
                  onMouseEnter={(e) => handleMessageMouseEnter(e, message.id)}
                  onMouseUp={handleMessageMouseUp}
                  onClick={(e) => onMessageClick(e, message.id)}
                  onContextMenu={(e) => {
                    if (isSelecting || selectionActive) return;
                    // Не открываем меню, если пользователь выделяет текст
                    const selection = window.getSelection();
                    if (selection && selection.toString().trim().length > 0) {
                      return;
                    }
                    e.preventDefault();
                    openMenuAtEventWithChecks(e, message.id);
                  }}
                  onTouchStart={(e) => onMessageTouchStart(e, message.id)}
                  onTouchMove={(e) => onMessageTouchMove(e, message.id)}
                  onTouchEnd={(e) => onMessageTouchEnd(e, message.id)}
                  onTouchCancel={(e) => onMessageTouchCancel(e, message.id)}
                  style={{
                    touchAction: "manipulation",
                    backgroundColor: bgColor,
                    // Убираем transition для предотвращения постоянных изменений
                    transition: "none",
                    // Блокируем выделение текста во всем контейнере, когда активен режим выделения
                    userSelect: selectionActive ? 'none' : 'auto',
                    WebkitUserSelect: selectionActive ? 'none' : 'auto',
                  }}
                >
                  <div className="px-3 sm:px-6">{renderMessage(message)}</div>
                </li>
              );
            })}
        </ol>
      </div>
    </section>
  );
};

ChatMessagesList.propTypes = {
  windowedMessages: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedMessagesSet: PropTypes.instanceOf(Set).isRequired,
  highlightedMessageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  activeMessageId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  messageRefs: PropTypes.shape({
    current: PropTypes.object,
  }).isRequired,
  theme: PropTypes.oneOf(["light", "dark"]).isRequired,
  selectionActive: PropTypes.bool.isRequired,
  isSelecting: PropTypes.bool.isRequired,
  onMessageClick: PropTypes.func.isRequired,
  onMessageContextMenu: PropTypes.func,
  onMessageTouchStart: PropTypes.func.isRequired,
  onMessageTouchMove: PropTypes.func.isRequired,
  onMessageTouchEnd: PropTypes.func.isRequired,
  onMessageTouchCancel: PropTypes.func.isRequired,
  openMenuAtEventWithChecks: PropTypes.func.isRequired,
  handleMessageMouseDown: PropTypes.func.isRequired,
  handleMessageMouseEnter: PropTypes.func.isRequired,
  handleMessageMouseUp: PropTypes.func.isRequired,
  handleContentMouseDown: PropTypes.func.isRequired,
  handleOriginalChatClick: PropTypes.func.isRequired,
};

export default ChatMessagesList;

