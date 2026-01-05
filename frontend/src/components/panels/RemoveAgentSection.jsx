import React, { useState } from 'react';
import { MdDeleteForever } from 'react-icons/md';
import { useChats } from '../../contexts/ChatsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useNotification } from '../../contexts/NotificationContext';

export default function RemoveAgentSection({ activeConversationId, onDeleteChat }) {
  const { activeConversation } = useChats();
  const { t } = useLanguage();
  const handleOpenModal = () => {
    if (!activeConversationId || !onDeleteChat) return;
    
    // Получаем данные для удаления
    const conversationId = activeConversationId;
    const agentId = activeConversation?.agent_id;
    const chatId = activeConversation?.id;
    
    // Вызываем функцию из пропсов для открытия модального окна
    onDeleteChat({ chatId, agentId, conversationId });
  };

  if (!activeConversationId) return null;

  // Определяем текст кнопки в зависимости от типа чата
  const isGroupChat = activeConversation?.is_group ?? false;
  const buttonText = isGroupChat ? t("chat.deleteGroupChat") : t("chat.deleteChat");

  return (
    <div className="border-b border-[var(--border-color)]">
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors duration-200"
        onClick={handleOpenModal}
      >
        <div className="flex items-center space-x-2">
          <MdDeleteForever className="text-red-500 text-lg" />
          <span className="font-medium text-[var(--text-white)] select-none">{buttonText}</span>
        </div>
      </div>
    </div>
  );
}
