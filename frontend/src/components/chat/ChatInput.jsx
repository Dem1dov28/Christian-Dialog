  import React, { useState } from "react";
import PropTypes from "prop-types";
import { getActionIcon } from "../../utils/actionIcons";
import ReplyMessage from "./ReplyMessage";
import { MdSend, MdAttachFile, MdStop, MdSettings } from "react-icons/md";

/**
 * Компонент поля ввода сообщений в чате
 * Включает textarea, кнопки, превью файлов, reply блок
 */
function ChatInput({
  // Input state
  inputValue,
  replyToMessage,
  attachedFiles,
  uploadProgress,
  isDragging,
  isLoading,
  isDialogueLoading,
  // Refs
  textareaRef,
  fileInputRef,
  // Handlers
  onInputChange,
  onKeyPress,
  onFileSelect,
  onRemoveFile,
  onPaste,
  onDrop,
  onDragOver,
  onDragEnter,
  onDragLeave,
  onSendMessage,
  onCancelGeneration,
  onCloseReply,
  // UI state
  isChannelChat,
  isReadOnlyChannel,
  messagePlaceholder,
  // Model selection
  activeConversation,
  currentAgentId,
  currentModel,
  onModelChange,
  // Translations
  t,
  // AI model check
  isAIModelChat,
}) {
  return (
    <div className="chat-input-transparent" style={{ padding: 0, margin: 0 }}>
      {/* File Preview - показываем когда есть прикрепленные файлы */}
      {!isChannelChat && attachedFiles.length > 0 && (
        <div className="px-2 sm:px-3 pt-2 pb-1 bg-transparent border-transparent" style={{ backgroundColor: 'transparent', padding: '0.5rem 0.75rem 0.25rem' }}>
          <div className="flex flex-wrap gap-2">
            {attachedFiles.map((fileObj) => (
              <div
                key={fileObj.id}
                className="flex items-center gap-2 px-3 py-2 bg-transparent rounded-lg border-transparent"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.15)',
                  backdropFilter: 'blur(12px) saturate(180%)',
                  WebkitBackdropFilter: 'blur(12px) saturate(180%)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  boxShadow: '0 2px 15px rgba(0, 0, 0, 0.15)',
                  width: '200px',
                  maxWidth: '200px',
                  minWidth: '200px'
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-white)] truncate">{fileObj.name}</p>
                  <p className="text-xs text-[var(--text-gray)]">
                    {(fileObj.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <button
                  onClick={() => onRemoveFile(fileObj.id)}
                  className="text-[var(--text-gray)] hover:text-[var(--text-white)] transition-colors"
                  aria-label={t("chat.removeFile", { defaultValue: "Удалить файл" })}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-transparent border-transparent" style={{ backgroundColor: 'transparent', padding: '0.5rem 0.75rem' }}>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-transparent rounded-full h-2 overflow-hidden" style={{ backgroundColor: 'transparent' }}>
              <div
                className="bg-[var(--accent)] h-full transition-all duration-300"
                style={{ width: `${uploadProgress.percentage}%` }}
              />
            </div>
            <span className="text-xs text-[var(--text-gray)] truncate max-w-[200px]">
              {uploadProgress.fileName}
            </span>
          </div>
        </div>
      )}

      {/* Reply Message Block */}
      {replyToMessage && (
        <div
          className="chat-input-transparent border-transparent"
          style={{
            backgroundColor: 'transparent',
            background: 'transparent',
            padding: 0,
            border: 'none',
            margin: 0,
            marginBottom: '8px',
            width: '100%'
          }}
        >
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 pt-2 sm:pt-2.5 pb-1 sm:pb-1.5 chat-input-transparent chat-input-frosted mx-auto w-full" style={{ maxWidth: '720px' }}>
            {/* Reply Icon */}
            <div className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-[var(--text-gray)]">
              {React.createElement(getActionIcon("reply"), { className: "w-4 h-4 sm:w-5 sm:h-5 transform -scale-x-100" })}
            </div>

            {/* Reply Content */}
            <div className="flex-1 relative max-w-[calc(100%-100px)]">
              <div
                className="w-full px-3 py-1.5 sm:py-2 bg-transparent border-transparent rounded-xl sm:rounded-2xl text-[var(--text-white)] resize-none focus:outline-none focus:ring-0 focus:border-transparent transition-all min-h-[36px] sm:min-h-[40px] text-sm sm:text-base cursor-pointer"
                style={{
                  backgroundColor: "var(--reply-bg-light)",
                  whiteSpace: "pre-wrap"
                }}
                title={t("chat.goToMessage")}
              >
                <p className="font-medium text-[var(--accent)] text-xs sm:text-sm truncate select-none mb-1">
                  {replyToMessage.author_name || t("chat.replyToMessage")}
                </p>
                <p className="text-[var(--text-white)] text-xs sm:text-sm select-none truncate whitespace-nowrap overflow-hidden">
                  {(() => {
                    const getCleanText = (content) => {
                      if (!content || typeof content !== "string") return "";
                      let cleaned = content
                        .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
                        .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
                        .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
                        .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
                      cleaned = cleaned.trim().replace(/^<\/div>\s*/i, "");
                      cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*/i, "");
                      cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*<\/div>\s*/i, "");
                      const decoded = cleaned
                        .replace(/&amp;/g, "&")
                        .replace(/&lt;/g, "<")
                        .replace(/&gt;/g, ">")
                        .replace(/&quot;/g, '"')
                        .replace(/&#039;/g, "'")
                        .replace(/&#x27;/g, "'");
                      return decoded.trim();
                    };
                    const cleanContent = getCleanText(replyToMessage.content);
                    const maxLength = window.innerWidth < 640 ? 40 : 80;
                    return cleanContent.length <= maxLength ? cleanContent : cleanContent.substring(0, maxLength) + "...";
                  })()}
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              onClick={onCloseReply}
              className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-[var(--text-gray)] hover:text-[var(--text-white)] hover:bg-[var(--bg-secondary)]/30 transition-colors chat-input-button-visible"
              title={t("chat.cancelReply")}
            >
              {React.createElement(getActionIcon("close"), { className: "w-4 h-4 sm:w-5 sm:h-5" })}
            </button>
          </div>
        </div>
      )}

      {/* Message Input Form */}
      <div
        className="chat-input-transparent border-transparent"
        style={{
          backgroundColor: 'transparent',
          background: 'transparent',
          padding: 0,
          border: 'none',
          margin: 0,
          width: '100%'
        }}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragEnter={onDragEnter}
        onDragLeave={onDragLeave}
        onPaste={onPaste}
      >
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 chat-input-transparent chat-input-frosted mx-auto w-full" style={{ maxWidth: '720px' }}>
          {/* File Attachment Button */}
          {!isChannelChat && !isReadOnlyChannel && (
            <button
              type="button"
              onClick={() => fileInputRef?.current?.click()}
              className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full text-[var(--text-gray)] hover:text-[var(--text-white)] hover:bg-[var(--bg-secondary)]/30 transition-colors chat-input-button-visible"
              aria-label={t("chat.attachFile", { defaultValue: "Прикрепить файл" })}
            >
              <MdAttachFile className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          )}


          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFileSelect}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.txt"
          />

          {/* Textarea */}
          <div className="flex-1 flex items-center min-w-0 max-w-[calc(100%-100px)]">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={onInputChange}
              onKeyPress={onKeyPress}
              placeholder={messagePlaceholder || t("chat.typeMessage", { defaultValue: "Введите сообщение..." })}
              disabled={isReadOnlyChannel || isLoading || isDialogueLoading}
              className="w-full py-2 bg-transparent border-transparent rounded-xl sm:rounded-2xl text-[var(--text-white)] placeholder-[var(--text-gray)] resize-none focus:outline-none focus:ring-0 focus:border-transparent transition-all min-h-[36px] sm:min-h-[40px] max-h-[200px] text-sm sm:text-base textarea-scrollbar leading-6"
              rows={1}
              style={{
                scrollbarWidth: 'thin',
                scrollbarColor: 'rgba(255, 255, 255, 0.1) transparent',
              }}
            />
          </div>


          {/* Send/Cancel Button */}
          <button
            type="button"
            onClick={isLoading || isDialogueLoading ? onCancelGeneration : onSendMessage}
            disabled={(!inputValue.trim() && attachedFiles.length === 0) || isReadOnlyChannel}
            className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-black/20 hover:shadow-xl hover:shadow-[var(--accent)]/30 ring-2 ring-white/25 chat-input-button-visible"
            aria-label={isLoading || isDialogueLoading ? t("chat.cancel", { defaultValue: "Отменить" }) : t("chat.send", { defaultValue: "Отправить" })}
          >
            {isLoading || isDialogueLoading ? (
              <MdStop className="w-4 h-4 sm:w-5 sm:h-5" />
            ) : (
              <MdSend className="w-4 h-4 sm:w-5 sm:h-5" />
            )}
          </button>
        </div>
      </div>

    </div>
  );
}

ChatInput.propTypes = {
  // Input state
  inputValue: PropTypes.string.isRequired,
  replyToMessage: PropTypes.object,
  attachedFiles: PropTypes.array.isRequired,
  uploadProgress: PropTypes.object,
  isDragging: PropTypes.bool.isRequired,
  isLoading: PropTypes.bool.isRequired,
  isDialogueLoading: PropTypes.bool.isRequired,
  // Refs
  textareaRef: PropTypes.object.isRequired,
  fileInputRef: PropTypes.object.isRequired,
  // Handlers
  onInputChange: PropTypes.func.isRequired,
  onKeyPress: PropTypes.func.isRequired,
  onFileSelect: PropTypes.func.isRequired,
  onRemoveFile: PropTypes.func.isRequired,
  onPaste: PropTypes.func.isRequired,
  onDrop: PropTypes.func.isRequired,
  onDragOver: PropTypes.func.isRequired,
  onDragEnter: PropTypes.func.isRequired,
  onDragLeave: PropTypes.func.isRequired,
  onSendMessage: PropTypes.func.isRequired,
  onCancelGeneration: PropTypes.func,
  onCloseReply: PropTypes.func,
  // UI state
  isChannelChat: PropTypes.bool.isRequired,
  isReadOnlyChannel: PropTypes.bool.isRequired,
  messagePlaceholder: PropTypes.string,
  // Model selection
  activeConversation: PropTypes.object,
  currentAgentId: PropTypes.number,
  currentModel: PropTypes.string,
  onModelChange: PropTypes.func,
  // Translations
  t: PropTypes.func.isRequired,
  // AI model check
  isAIModelChat: PropTypes.bool,
};

export default ChatInput;

