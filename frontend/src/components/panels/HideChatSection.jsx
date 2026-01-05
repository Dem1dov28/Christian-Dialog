import React, { useState } from "react";
import {
  MdVisibilityOff,
  MdVisibility,
  MdExpandMore,
  MdExpandLess,
} from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useLanguage } from "../../contexts/LanguageContext";

export default function HideChatSection({ activeConversationId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isSystemChatHidden, toggleSystemChatVisibility } = useChats();
  const { t } = useLanguage();

  const handleToggleChatVisibility = () => {
    toggleSystemChatVisibility();
  };

  if (!activeConversationId) return null;

  return (
    <div className="border-b border-[var(--border-color)]">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          {isSystemChatHidden ? (
            <MdVisibility className="text-[var(--text-gray)] text-lg" />
          ) : (
            <MdVisibilityOff className="text-[var(--text-gray)] text-lg" />
          )}
          <span className="font-medium text-[var(--text-white)] select-none">
            {isSystemChatHidden ? t("chat.showChat") : t("chat.hideChat")}
          </span>
        </div>
        {isExpanded ? (
          <MdExpandLess className="text-[var(--text-gray)]" />
        ) : (
          <MdExpandMore className="text-[var(--text-gray)]" />
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-4">
          {/* Информация о скрытии */}
          <div className="bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-color)]/50">
            <h4 className="text-sm font-medium text-[var(--text-white)] mb-2">
              {t("chat.whatWillHappen")}
            </h4>
            <div className="space-y-1 text-xs text-[var(--text-gray)]">
              <div>• {t("chat.chatWillDisappear")}</div>
              <div>• {t("chat.allMessagesSaved")}</div>
              <div>• {t("chat.savedMessagesRemains")}</div>
            </div>
          </div>

          {/* Как восстановить */}
          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
            <h4 className="text-sm font-medium text-purple-500 mb-2">
              {t("chat.howToRestore")}
            </h4>
            <div className="space-y-2 text-xs text-[var(--text-white)]-secondary">
              <div>
                <div className="font-medium text-[var(--text-white)] mb-1">{t("chat.method1")}</div>
                <div>• {t("chat.goToMenu")}</div>
                <div>• {t("chat.selectSavedMessages")}</div>
              </div>
              <div>
                <div className="font-medium text-[var(--text-white)] mb-1">{t("chat.method2")}</div>
                <div>• {t("chat.openProfile")}</div>
                <div>• {t("chat.findSavedMessages")}</div>
              </div>
            </div>
          </div>

          <button
            onClick={handleToggleChatVisibility}
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg transition-colors duration-200 flex items-center justify-center space-x-2"
          >
            {isSystemChatHidden ? (
              <MdVisibility className="text-lg" />
            ) : (
              <MdVisibilityOff className="text-lg" />
            )}
            <span>{isSystemChatHidden ? t("chat.showChat") : t("chat.hideChat")}</span>
          </button>
        </div>
      )}
    </div>
  );
}
