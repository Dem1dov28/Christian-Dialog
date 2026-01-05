import React, { useState } from "react";
import {
  MdInfo,
  MdExpandMore,
  MdExpandLess,
  MdRefresh,
} from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useLanguage } from "../../contexts/LanguageContext";

export default function InformationSection({
  activeConversationId,
  isSystemChat = false,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { activeConversation, messages } = useChats();
  const { t, language } = useLanguage();

  // Вычисляем количество сообщений
  const getMessageCount = () => {
    if (!messages) {
      return 0;
    }
    return messages.length;
  };

  const formatDate = (dateString) => {
    if (!dateString) {
      return t("common.notFound");
    }
    const date = new Date(dateString);
    const locale = language === "ru" ? "ru-RU" : "en-US";
    return date.toLocaleDateString(locale, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return `0 ${t("chat.bytes")}`;
    const k = 1024;
    const sizes = [
      t("chat.bytes"),
      t("chat.kb"),
      t("chat.mb"),
      t("chat.gb"),
    ];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Здесь можно добавить логику обновления данных
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const messageCount = getMessageCount();
  const isChannelChat = activeConversation?.is_channel ?? false;
  const channelOwnerName = isChannelChat
    ? activeConversation?.owner?.username ||
      activeConversation?.owner?.full_name ||
      (activeConversation?.channel_owner_id
        ? `ID ${activeConversation.channel_owner_id}`
        : t("common.notFound"))
    : "";
  const channelAccessLabel = isChannelChat
    ? activeConversation?.is_listed === false
      ? t("chat.channelPrivate")
      : t("chat.channelPublic")
    : "";
  const channelPublishingLabel = isChannelChat
    ? activeConversation?.can_write
      ? t("chat.channelCanPublish")
      : t("chat.channelReadOnly")
    : "";
  const channelDescription = isChannelChat
    ? activeConversation?.channel_description ||
      activeConversation?.preview ||
      t("chat.channelNoDescription")
    : "";

  if (!activeConversationId || !activeConversation) return null;

  return (
    <div className="border-b border-[var(--border-color)]">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <MdInfo className="text-[var(--accent)] text-lg" />
          <span className="font-medium text-[var(--text-white)] select-none">{t("chat.information")}</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRefresh();
            }}
            className="text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors duration-200"
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[var(--accent)]"></div>
            ) : (
              <MdRefresh className="text-lg" />
            )}
          </button>
          {isExpanded ? (
            <MdExpandLess className="text-[var(--text-gray)]" />
          ) : (
            <MdExpandMore className="text-[var(--text-gray)]" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-4">
          {/* Основная информация */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--text-white)]">
              {t("chat.mainInformation")}
            </h4>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-color)]/50">
                <div className="text-xs text-[var(--text-gray)] mb-1">
                  {t("chat.creationDate")}
                </div>
                <div className="text-sm text-[var(--text-white)]">
                  {formatDate(activeConversation.created_at)}
                </div>
              </div>

              <div className="bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-color)]/50">
                <div className="text-xs text-[var(--text-gray)] mb-1">
                  {t("chat.lastUpdate")}
                </div>
                <div className="text-sm text-[var(--text-white)]">
                  {formatDate(activeConversation.updated_at)}
                </div>
              </div>
            </div>
          </div>

          {/* Техническая информация */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[var(--text-white)]">
              {t("chat.technicalInformation")}
            </h4>

            <div className="rounded-lg p-3 border border-[var(--border-color)]/50 space-y-2" style={{ backgroundColor: 'var(--panel-info-bg)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-gray)]">
                  {t("chat.conversationId")}
                </span>
                <span className="text-xs text-[var(--text-white)] font-mono">
                  {activeConversation.id}
                </span>
              </div>

              {!isSystemChat && !activeConversation?.is_group && !isChannelChat && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-gray)]">
                    {t("chat.agentId")}
                  </span>
                  <span className="text-xs text-[var(--text-white)] font-mono">
                    {activeConversation.agent_id}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-gray)]">
                  {t("chat.dataSize")}
                </span>
                <span className="text-xs text-[var(--text-white)]">
                  {formatFileSize(JSON.stringify(messages).length)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-gray)]">
                  {t("chat.messagesCount")}
                </span>
                <span className="text-xs text-[var(--text-white)]">
                  {messageCount}
                </span>
              </div>
            </div>
          </div>

          {/* Информация о канале */}
          {isChannelChat && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-[var(--text-white)]">
                {t("chat.channelInformation")}
              </h4>
              <div
                className="rounded-lg p-3 border border-[var(--border-color)]/50 space-y-2"
                style={{ backgroundColor: "var(--panel-info-bg)" }}
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-[var(--text-gray)]">
                    {t("chat.channelOwner")}
                  </span>
                  <span
                    className="text-xs text-[var(--text-white)] text-right truncate max-w-[180px]"
                    title={channelOwnerName}
                  >
                    {channelOwnerName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-[var(--text-gray)]">
                    {t("chat.channelAccess")}
                  </span>
                  <span className="text-xs text-[var(--text-white)] text-right">
                    {channelAccessLabel}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-[var(--text-gray)]">
                    {t("chat.channelPublishing")}
                  </span>
                  <span className="text-xs text-[var(--text-white)] text-right">
                    {channelPublishingLabel}
                  </span>
                </div>
                <div className="pt-2 border-t border-[var(--border-color)]/40">
                  <div className="text-xs text-[var(--text-gray)] mb-1">
                    {t("chat.channelDescription")}
                  </div>
                  <p className="text-xs text-[var(--text-white)] whitespace-pre-line">
                    {channelDescription}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
