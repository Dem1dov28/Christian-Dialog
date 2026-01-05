import { useCallback } from "react";

/**
 * Хук для управления встроенной библиотекой чатов
 */
export function useLibraryHandlers({
  isUltraCompact,
  isMediumScreen,
  setIsInlineLibraryOpen,
  setIsCompactChatOpen,
  setIsMediumScreenSidebarVisible,
  setIsLibraryWithSidebar,
}) {
  const openInlineLibrary = useCallback(() => {
    if (isUltraCompact) {
      setIsCompactChatOpen(true);
    }
    setIsInlineLibraryOpen(true);

    // Для среднего диапазона (550-750px): скрываем sidebar и сбрасываем состояние библиотеки с sidebar
    if (isMediumScreen && !isUltraCompact) {
      setIsMediumScreenSidebarVisible(false);
      setIsLibraryWithSidebar(false);
    }
  }, [
    isUltraCompact,
    isMediumScreen,
    setIsInlineLibraryOpen,
    setIsCompactChatOpen,
    setIsMediumScreenSidebarVisible,
    setIsLibraryWithSidebar,
  ]);

  const closeInlineLibrary = useCallback(() => {
    setIsInlineLibraryOpen(false);
    setIsLibraryWithSidebar(false);

    if (typeof window !== "undefined" && window.innerWidth < 750) {
      setIsCompactChatOpen(false);
    }
  }, [setIsInlineLibraryOpen, setIsLibraryWithSidebar, setIsCompactChatOpen]);

  const handleLibraryBackButton = useCallback(() => {
    if (isMediumScreen && !isUltraCompact) {
      // Для среднего диапазона: показываем sidebar вместе с библиотекой
      setIsLibraryWithSidebar(true);
    } else if (isUltraCompact) {
      // Для ультра компактного режима: закрываем библиотеку
      closeInlineLibrary();
    } else {
      // Для остальных случаев: закрываем библиотеку
      closeInlineLibrary();
    }
  }, [isMediumScreen, isUltraCompact, closeInlineLibrary, setIsLibraryWithSidebar]);

  return {
    openInlineLibrary,
    closeInlineLibrary,
    handleLibraryBackButton,
  };
}

