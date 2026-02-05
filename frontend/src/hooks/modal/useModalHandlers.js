import { useCallback } from "react";
import { toast } from "../common/use-toast";

/**
 * Хук для управления модальными окнами приложения
 */
export function useModalHandlers({
  setIsDeleteChatModalOpen,
  setModalData,
  setDeleteChatData,
  setIsFolderManagerOpen,
  folders,
  addChatToFolder,
  addAgentToFolder,
  createFolder,
  loadFolders,
  deleteConversation,
  getAgent,
  conversations,
  t,
}) {
  const handlePinToTop = useCallback(
    ({ chatId, agentId, conversationId }, { pinChat, unpinChat, isChatPinned }) => {
      console.log("Pin to Top:", { chatId, agentId, conversationId });

      const targetConversationId = conversationId || chatId;

      if (isChatPinned(targetConversationId)) {
        unpinChat(targetConversationId);
        console.log("Chat unpinned:", targetConversationId);
      } else {
        pinChat(targetConversationId);
        console.log("Chat pinned:", targetConversationId);
      }
    },
    []
  );

  const handleDeleteAgent = useCallback(
    ({ chatId, agentId, conversationId }) => {
      console.log("Delete Agent:", { chatId, agentId, conversationId });
      setDeleteChatData({ chatId, agentId, conversationId });
      setIsDeleteChatModalOpen(true);
    },
    [setDeleteChatData, setIsDeleteChatModalOpen]
  );

  const handleConfirmDeleteChat = useCallback(
    (deleteChatData, handleDeleteChat) => {
      if (deleteChatData.conversationId) {
        handleDeleteChat(deleteChatData.conversationId);
      }
      setIsDeleteChatModalOpen(false);
      setDeleteChatData({});
    },
    [setIsDeleteChatModalOpen, setDeleteChatData]
  );

  const handleCloseDeleteModal = useCallback(() => {
    setIsDeleteChatModalOpen(false);
    setDeleteChatData({});
  }, [setIsDeleteChatModalOpen, setDeleteChatData]);

  const handleCreateFolderFromModal = useCallback(
    async (folderData = {}) => {
      try {
        const normalizedData = {
          name: folderData.name?.trim(),
          icon: folderData.icon || "folder",
          chat_ids: folderData.chat_ids || [],
          agent_ids: folderData.agent_ids || [],
        };

        if (!normalizedData.name) {
          throw new Error(t("chat.folderNameRequired"));
        }

        const createdFolder = await createFolder(normalizedData);
        await loadFolders();

        toast({
          title: t("chat.folderCreateSuccessTitle"),
          description: t("chat.folderCreateSuccessDescription"),
        });

        return createdFolder;
      } catch (error) {
        console.error("Failed to create folder from modal:", error);
        toast({
          title: t("chat.folderCreateErrorTitle"),
          description: t("chat.folderCreateErrorDescription"),
          variant: "destructive",
        });
        throw error;
      }
    },
    [createFolder, loadFolders, t]
  );

  const handleOpenFolderManager = useCallback(() => {
    setIsFolderManagerOpen(true);
  }, [setIsFolderManagerOpen]);

  const handleCloseFolderManager = useCallback(() => {
    setIsFolderManagerOpen(false);
  }, [setIsFolderManagerOpen]);

  return {
    handlePinToTop,
    handleDeleteAgent,
    handleConfirmDeleteChat,
    handleCloseDeleteModal,
    handleCreateFolderFromModal,
    handleOpenFolderManager,
    handleCloseFolderManager,
  };
}

