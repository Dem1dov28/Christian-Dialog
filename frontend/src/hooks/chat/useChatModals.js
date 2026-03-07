import { useState, useCallback } from "react";

/**
 * Хук для управления модальными окнами в чате
 * Включает состояние и обработчики для различных модальных окон
 */
export function useChatModals() {
  // Состояние модальных окон
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAgentRulesModalOpen, setIsAgentRulesModalOpen] = useState(false);
  const [isClearChatModalOpen, setIsClearChatModalOpen] = useState(false);

  // Обработчики открытия модальных окон
  const openReportModal = useCallback(() => {
    setIsReportModalOpen(true);
  }, []);

  const closeReportModal = useCallback(() => {
    setIsReportModalOpen(false);
  }, []);

  const openClearChatModal = useCallback(() => {
    setIsClearChatModalOpen(true);
  }, []);

  const closeClearChatModal = useCallback(() => {
    setIsClearChatModalOpen(false);
  }, []);

  return {
    // State
    isReportModalOpen,
    setIsReportModalOpen,
    isAgentRulesModalOpen,
    setIsAgentRulesModalOpen,
    isClearChatModalOpen,
    setIsClearChatModalOpen,

    // Handlers
    openReportModal,
    closeReportModal,
    openClearChatModal,
    closeClearChatModal,
  };
}

