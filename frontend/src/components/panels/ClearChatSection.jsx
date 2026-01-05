import React, { useState } from "react";
import { MdDeleteSweep } from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useAgents } from "../../contexts/AgentsContext";
import { useNotification } from "../../contexts/NotificationContext";
import { useLanguage } from "../../contexts/LanguageContext";
import ClearChatModal from "../chat/ClearChatModal";

export default function ClearChatSection({ activeConversationId }) {
  const [isClearing, setIsClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const { activeConversation, messages, clearConversationMessages, conversations } =
    useChats();
  const { getAgent } = useAgents();
  const { showSuccess, showError } = useNotification();
  const { t, translateAgent } = useLanguage();

  const currentAgent = activeConversation?.agent_id
    ? getAgent(activeConversation.agent_id)
    : null;

  const handleClearChat = async () => {
    if (!activeConversationId) {
      showError(t("chat.noChatToClear"));
      return;
    }

    if (!activeConversation) {
      showError(t("chat.noChatToClear"));
      return;
    }

    setIsClearing(true);

    try {
      await clearConversationMessages(activeConversationId);
      showSuccess(t("chat.historyCleared"));
      setShowClearModal(false);
    } catch (error) {
      console.error("Clear chat error:", error);
      showError(t("chat.clearHistoryError") + ": " + error.message);
    } finally {
      setIsClearing(false);
    }
  };

  const handleOpenModal = () => {
    setShowClearModal(true);
  };

  const handleCloseModal = () => {
    setShowClearModal(false);
  };

  if (!activeConversationId || !messages || messages.length === 0) return null;

  // Определяем название чата для модалки (с учётом локализации и нумерации)
  const chatName = (() => {
    if (!activeConversation) {
      return t("common.chat");
    }

    if (activeConversation.is_system_chat) {
      return activeConversation.title || t("chat.savedMessages");
    }

    if (activeConversation.is_group) {
      return activeConversation.title || t("chat.groupChat");
    }

    const translatedAgent = currentAgent ? translateAgent(currentAgent) : null;
    const baseName = translatedAgent?.name || currentAgent?.name || t("common.chat");
    const agentId = activeConversation.agent_id;

    if (!agentId || !Array.isArray(conversations)) {
      return baseName;
    }

    const agentConversations = conversations.filter(
      (conv) => conv.agent_id === agentId && !conv.is_group
    );

    if (agentConversations.length <= 1) {
      return baseName;
    }

    const sorted = agentConversations
      .slice()
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    const idx = sorted.findIndex((conv) => conv.id === activeConversation.id);

    if (idx === -1) {
      return baseName;
    }

    return `${baseName} (${idx + 1})`;
  })();

  // Определяем иконку и цвет для модалки
  const agentIcon = activeConversation?.is_system_chat
    ? null
    : activeConversation?.is_group
    ? activeConversation.group_avatar || "group"
    : currentAgent?.icon_name || null;

  const agentColor = activeConversation?.is_system_chat
    ? "gray-500"
    : activeConversation?.is_group
    ? "purple-500"
    : (() => {
        const cc = currentAgent?.color_class || "purple-500";
        return cc.replace(/^bg-/, "").replace(/dark:bg-/, "").split(" ")[0] || "purple-500";
      })();

  return (
    <>
      <div className="border-b border-[var(--border-color)]">
        <div
          className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors duration-200"
          onClick={handleOpenModal}
        >
          <div className="flex items-center space-x-2">
            <MdDeleteSweep className="text-orange-500 text-lg" />
            <span className="font-medium text-[var(--text-white)] select-none">{t("chat.clearChat")}</span>
            <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full select-none">
              {messages.length}
            </span>
          </div>
        </div>
      </div>

      {/* Модальное окно подтверждения очистки */}
      <ClearChatModal
        isOpen={showClearModal}
        onClose={handleCloseModal}
        onConfirm={handleClearChat}
        chatName={chatName}
        agentIcon={agentIcon}
        agentColor={agentColor}
        agentImage={currentAgent?.image_url || currentAgent?.avatar_url || null}
      />
    </>
  );
}
