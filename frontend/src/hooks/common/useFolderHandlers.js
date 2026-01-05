import { useCallback } from "react";

/**
 * Хук для управления обработчиками папок
 */
export function useFolderHandlers({
  createFolder,
  updateFolder,
  deleteFolder,
  addRecommendedFolder,
  loadFolders,
  setActiveFolder,
}) {
  const handleFolderCreate = useCallback(
    async (folderData) => {
      try {
        const newFolder = await createFolder(folderData);
        console.log("Folder created:", newFolder);
        await loadFolders();
      } catch (error) {
        console.error("Failed to create folder:", error);
      }
    },
    [createFolder, loadFolders]
  );

  const handleFolderUpdate = useCallback(
    async (folderData) => {
      try {
        const { id, ...updateData } = folderData;
        if (!id) {
          throw new Error("Folder ID is required for update");
        }
        const updatedFolder = await updateFolder(id, updateData);
        console.log("Folder updated:", updatedFolder);
        await loadFolders();
      } catch (error) {
        console.error("Failed to update folder:", error);
        throw error;
      }
    },
    [updateFolder, loadFolders]
  );

  const handleFolderDelete = useCallback(
    async (folderId) => {
      try {
        await deleteFolder(folderId);
        console.log("Folder deleted:", folderId);
      } catch (error) {
        console.error("Failed to delete folder:", error);
      }
    },
    [deleteFolder]
  );

  const handleFolderAdd = useCallback(
    async (folderId) => {
      try {
        await addRecommendedFolder(folderId);
        console.log("Recommended folder added:", folderId);
      } catch (error) {
        console.error("Failed to add recommended folder:", error);
      }
    },
    [addRecommendedFolder]
  );

  const handleFolderSelect = useCallback(
    (folderId) => {
      if (folderId) {
        setActiveFolder(folderId);
        console.log("Switching to folder:", folderId);
      }
    },
    [setActiveFolder]
  );

  const handleFolderChange = useCallback(
    (folderId) => {
      setActiveFolder(folderId);
    },
    [setActiveFolder]
  );

  return {
    handleFolderCreate,
    handleFolderUpdate,
    handleFolderDelete,
    handleFolderAdd,
    handleFolderSelect,
    handleFolderChange,
  };
}

