import ChatInput from "./ChatInput";
import { useAgents } from "../../contexts/AgentsContext";

/**
 * Компонент секции ввода сообщения (включая формы журналов и кнопку подписки)
 */
export default function ChatInputSection({
  isChatSelected,
  isInlineLibraryOpen,
  isChannelChat,
  // УДАЛЕНО - props для удаленных инструментов и каналов
  isLoading,
  activeConversation,
  currentAgentId: currentAgentIdProp,
  showSuccess,
  showError,
  t,
  inputValue,
  replyToMessage,
  attachedFiles,
  uploadProgress,
  isDragging,
  isDialogueLoading,
  textareaRef,
  fileInputRef,
  handleInputChange,
  handleKeyPress,
  handleFileSelect,
  handleRemoveFile,
  handlePaste,
  handleDrop,
  handleDragOver,
  handleDragEnter,
  handleDragLeave,
  handleSendMessage,
  handleCancelGeneration,
  setReplyToMessage,
  isReadOnlyChannel,
  messagePlaceholder,
}) {
  const { getAgent } = useAgents();
  
  // Получаем текущего агента и модель
  // Используем переданный currentAgentIdProp, если он есть, иначе из activeConversation
  const agentIdToUse = currentAgentIdProp || activeConversation?.agent_id;
  const currentAgent = agentIdToUse ? getAgent(agentIdToUse) : null;
  // Используем модель из чата, если она установлена, иначе модель агента
  const currentModel = activeConversation?.selected_model || currentAgent?.model || null;
  
  // В проекте удалены model-агенты; этот флаг всегда false
  const isAIModelChat = false;
  
  if (!isChatSelected || isInlineLibraryOpen) {
    return null;
  }

  // УДАЛЕНО - все проверки для удаленных инструментов

  const content = (
    <ChatInput
      inputValue={inputValue}
      replyToMessage={replyToMessage}
      attachedFiles={attachedFiles}
      uploadProgress={uploadProgress}
      isDragging={isDragging}
      isLoading={isLoading}
      isDialogueLoading={isDialogueLoading}
      textareaRef={textareaRef}
      fileInputRef={fileInputRef}
      onInputChange={handleInputChange}
      onKeyPress={handleKeyPress}
      onFileSelect={handleFileSelect}
      onRemoveFile={handleRemoveFile}
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onSendMessage={handleSendMessage}
      onCancelGeneration={handleCancelGeneration}
      onCloseReply={() => setReplyToMessage(null)}
      isChannelChat={isChannelChat}
      isReadOnlyChannel={isReadOnlyChannel}
      messagePlaceholder={messagePlaceholder}
      activeConversation={activeConversation}
      currentAgentId={currentAgentIdProp || activeConversation?.agent_id}
      currentModel={currentModel}
      onModelChange={(newModel) => {
        // Обновление модели будет обработано через API в ModelSelectPanel
        // Здесь можно добавить дополнительную логику обновления UI
        // Например, обновление кэша агентов
      }}
      t={t}
      isAIModelChat={isAIModelChat}
    />
  );

  // Скрываем форму ввода для всех каналов
  if (isChannelChat) {
    return null;
  }

  return (
    <div
      className="chat-input-transparent"
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '0 clamp(8px, 3vw, 80px)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        backgroundColor: 'transparent',
        background: 'transparent',
        pointerEvents: 'auto',
      }}
    >
      {content}
    </div>
  );
}


