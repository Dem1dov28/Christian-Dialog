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
  
  // Функция для определения, является ли агент AI-моделью
  const getPrimaryCategory = (agent) => {
    if (!agent) return null;
    
    // Используем категорию из базы данных, если она есть
    if (agent.category) {
      const categoryLower = agent.category.toLowerCase();
      
      // Если категория содержит запятые, извлекаем первую категорию
      if (categoryLower.includes(',')) {
        const firstCategory = categoryLower.split(',')[0].trim();
        if (['models', 'модели'].includes(firstCategory)) {
          return 'models';
        }
      }
      
      // Проверяем точное совпадение
      if (['models'].includes(categoryLower)) {
        return 'models';
      }
      
      // Проверяем, содержит ли категория ключевые слова
      if (categoryLower.includes('models') || categoryLower.includes('модели')) {
        return 'models';
      }
    }
    
    // Fallback: определяем категорию на основе имени или описания агента
    const name = agent.name.toLowerCase();
    const description = (agent.description || '').toLowerCase();
    
    if (name.includes('deepseek') || name.includes('assistant') || name.includes('ai') || 
        name.includes('gpt') || name.includes('claude') || name.includes('grok') || name.includes('gemini') ||
        description.includes('ai') || description.includes('модель') || description.includes('ассистент')) {
      return 'models';
    }
    
    return null;
  };
  
  // Проверяем, является ли текущий агент AI-моделью
  const isAIModelChat = currentAgent ? getPrimaryCategory(currentAgent) === 'models' : false;
  
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
        backgroundColor: 'transparent',
        background: 'transparent',
        isolation: 'isolate',
        pointerEvents: 'auto'
      }}
    >
      {content}
    </div>
  );
}


