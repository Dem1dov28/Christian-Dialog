import React from "react";
import { getActionIcon } from "../../utils/actionIcons";
import { formatTime } from "../../utils/formatters";
import { getCleanText } from "../../utils/formatters";

/**
 * Компонент для отображения закрепленного сообщения
 */
export default function PinnedMessageBar({
  currentPinnedMessage,
  pinnedMessagesArray,
  currentPinIndex,
  handlePinnedMessageClick,
  handleUnpin,
}) {
  if (!currentPinnedMessage) return null;

  return (
    <div className="border-b border-[var(--border-color)]">
      <div className="p-3 bg-[var(--bg-primary)] border-t border-[var(--border-color)] flex-shrink-0 min-w-0 max-w-full overflow-hidden">
        <div className="flex items-center space-x-3 min-w-0 max-w-full">
          <div className="text-[var(--accent)] flex-shrink-0">
            {React.createElement(getActionIcon("pin"), { className: "text-2xl" })}
          </div>
          <div
            className="border-l-2 border-[var(--accent)] pl-3 pr-3 py-1 flex-1 min-w-0 max-w-full rounded-[3px] overflow-hidden cursor-pointer transition-colors duration-200"
            onClick={handlePinnedMessageClick}
            title="Перейти к сообщению"
            style={{
              cursor: "pointer",
              backgroundColor: "var(--reply-bg-light)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--reply-hover-bg-light)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--reply-bg-light)";
            }}
            onMouseDown={(e) => {
              e.currentTarget.style.backgroundColor = "var(--reply-active-bg-light)";
            }}
            onMouseUp={(e) => {
              e.currentTarget.style.backgroundColor = "var(--reply-hover-bg-light)";
            }}
          >
            <p className="font-medium text-[var(--accent)] text-sm truncate">
              {currentPinnedMessage.is_from_user
                ? "Вы"
                : currentPinnedMessage.agent_name || "Агент"}{" "}
              • {formatTime(currentPinnedMessage.created_at)}
              {pinnedMessagesArray.length > 1 && (
                <span className="ml-2 text-[var(--accent)]/70">
                  {currentPinIndex + 1}/{pinnedMessagesArray.length}
                </span>
              )}
            </p>
            <p className="text-[var(--text-white)] text-sm truncate">
              {(() => {
                const cleanContent = getCleanText(currentPinnedMessage.content);
                return cleanContent.length > 100
                  ? cleanContent.substring(0, 100) + "..."
                  : cleanContent;
              })()}
            </p>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUnpin(currentPinnedMessage.id);
              }}
              className="text-[var(--text-gray)] hover:text-[var(--text-white)] p-1 rounded transition-colors duration-200"
              title="Открепить сообщение"
            >
              {React.createElement(getActionIcon("pin"), { className: "text-xl" })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



