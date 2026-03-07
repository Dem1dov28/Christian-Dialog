import React from "react";
import { MdClose } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";
import AgentSettingsSection from "../panels/AgentSettingsSection";

export default function AgentRulesModal({ isOpen, onClose, activeConversationId }) {
  const { t } = useLanguage();

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={t("chat.agentSettings")}
    >
      <div
        className="bg-[var(--bg-secondary)] rounded-2xl shadow-2xl w-full max-w-md mx-4 max-h-[85dvh] overflow-hidden flex flex-col border border-[var(--border-color)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] flex-shrink-0">
          <h3 className="text-lg font-medium text-[var(--text-white)]">
            {t("chat.settings")}
          </h3>
          <button
            onClick={onClose}
            className="p-2 text-[var(--text-gray)] hover:bg-[var(--hover-bg)] rounded-lg transition-colors"
            aria-label={t("common.close", { defaultValue: "Закрыть" })}
          >
            <MdClose className="text-xl" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0 p-4">
          <AgentSettingsSection
            activeConversationId={activeConversationId}
            embedded
          />
        </div>
      </div>
    </div>
  );
}
