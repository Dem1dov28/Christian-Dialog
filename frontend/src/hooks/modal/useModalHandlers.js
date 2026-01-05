import { useCallback } from "react";
import { toast } from "../common/use-toast";

/**
 * Хук для управления модальными окнами приложения
 */
export function useModalHandlers({
  setIsCollectionModalOpen,
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
  const handleAddToCollection = useCallback(
    ({ chatId, agentId, conversationId }) => {
      console.log("Add to Collection:", { chatId, agentId, conversationId });
      setModalData({ chatId, agentId, conversationId });
      setIsCollectionModalOpen(true);
    },
    [setModalData, setIsCollectionModalOpen]
  );

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

  const handleCollectionAdd = useCallback(
    async ({ folderId, agentId, conversationId, chatId }) => {
      if (!folderId) {
        return;
      }

      try {
        const targetFolder = folders.find((folder) => folder?.id === folderId);
        if (!targetFolder) {
          toast({
            title: t("chat.folderNotFoundTitle"),
            description: t("chat.folderNotFoundDescription"),
            variant: "destructive",
          });
          return;
        }

        const normalizedConversationId = (() => {
          if (conversationId) {
            return conversationId;
          }

          if (chatId && !String(chatId).startsWith("agent-")) {
            const numericId = parseInt(chatId, 10);
            return Number.isNaN(numericId) ? null : numericId;
          }

          return null;
        })();

        const alreadyHasChat =
          normalizedConversationId != null &&
          Array.isArray(targetFolder.chat_ids) &&
          targetFolder.chat_ids.includes(normalizedConversationId);

        const alreadyHasAgent =
          normalizedConversationId == null &&
          agentId != null &&
          Array.isArray(targetFolder.agent_ids) &&
          targetFolder.agent_ids.includes(agentId);

        if (alreadyHasChat || alreadyHasAgent) {
          toast({
            title: t("chat.folderAlreadyContainsTitle"),
            description: t("chat.folderAlreadyContainsDescription"),
          });
          setIsCollectionModalOpen(false);
          return;
        }

        if (normalizedConversationId != null) {
          await addChatToFolder(folderId, normalizedConversationId);
        } else if (agentId != null) {
          await addAgentToFolder(folderId, agentId);
        } else {
          toast({
            title: t("chat.folderDetectionErrorTitle"),
            description: t("chat.folderDetectionErrorDescription"),
            variant: "destructive",
          });
          return;
        }

        await loadFolders();

        toast({
          title: t("chat.folderAddSuccessTitle"),
          description: t("chat.folderAddSuccessDescription"),
        });
      } catch (error) {
        console.error("Failed to add chat to folder:", error);
        toast({
          title: t("chat.folderAddErrorTitle"),
          description: t("chat.folderAddErrorDescription"),
          variant: "destructive",
        });
      } finally {
        setIsCollectionModalOpen(false);
      }
    },
    [
      folders,
      addChatToFolder,
      addAgentToFolder,
      loadFolders,
      t,
      setIsCollectionModalOpen,
    ]
  );

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
    handleAddToCollection,
    handlePinToTop,
    handleDeleteAgent,
    handleConfirmDeleteChat,
    handleCloseDeleteModal,
    handleCollectionAdd,
    handleCreateFolderFromModal,
    handleOpenFolderManager,
    handleCloseFolderManager,
  };
}

