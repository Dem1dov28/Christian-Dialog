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
                style={{ backgroundColor: 'transparent' }}
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
        <div className="px-3 py-2 bg-transparent border-transparent" style={{ backgroundColor: 'transparent', padding: '0.5rem 0.75rem' }}>
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
        <div className="px-3 py-2 bg-transparent border-transparent" style={{ backgroundColor: 'transparent', padding: '0.5rem 0.75rem' }}>
          <ReplyMessage
            message={replyToMessage}
            onClose={onCloseReply}
          />
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
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 chat-input-transparent chat-input-frosted">
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
          <div className="flex-1 relative max-w-[calc(100%-100px)]">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={onInputChange}
              onKeyPress={onKeyPress}
              placeholder={messagePlaceholder || t("chat.typeMessage", { defaultValue: "Введите сообщение..." })}
              disabled={isReadOnlyChannel || isLoading || isDialogueLoading}
              className="w-full px-3 py-1.5 sm:py-2 pr-10 sm:pr-12 bg-transparent border-transparent rounded-xl sm:rounded-2xl text-[var(--text-white)] placeholder-[var(--text-gray)] resize-none focus:outline-none focus:ring-0 focus:border-transparent transition-all min-h-[36px] sm:min-h-[40px] max-h-[200px] text-sm sm:text-base"
              rows={1}
            />
          </div>


          {/* Send/Cancel Button */}
          <button
            type="button"
            onClick={isLoading || isDialogueLoading ? onCancelGeneration : onSendMessage}
            disabled={(!inputValue.trim() && attachedFiles.length === 0) || isReadOnlyChannel}
            className="flex-shrink-0 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-[var(--accent)]/80 hover:bg-[var(--accent)] text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl chat-input-button-visible"
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

