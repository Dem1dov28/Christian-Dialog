import { useCallback, useEffect } from "react";

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
  navigate,
  location,
}) {
  const openInlineLibrary = useCallback(() => {
    // Навигируем на /Library вместо изменения состояния
    if (navigate && location?.pathname !== '/Library') {
      navigate('/Library');
    }
    
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
    navigate,
    location,
  ]);

  const closeInlineLibrary = useCallback(() => {
    // Навигируем назад на главную если мы на /Library
    if (navigate && location?.pathname === '/Library') {
      navigate('/', { replace: true });
    }
    
    setIsInlineLibraryOpen(false);
    setIsLibraryWithSidebar(false);

    if (typeof window !== "undefined" && window.innerWidth < 750) {
      setIsCompactChatOpen(false);
    }
  }, [setIsInlineLibraryOpen, setIsLibraryWithSidebar, setIsCompactChatOpen, navigate, location]);

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

  // Синхронизация состояния библиотеки с URL
  useEffect(() => {
    if (location?.pathname === '/Library') {
      // Если URL /Library, открываем библиотеку
      setIsInlineLibraryOpen(true);
      if (isUltraCompact) {
        setIsCompactChatOpen(true);
      }
      if (isMediumScreen && !isUltraCompact) {
        setIsMediumScreenSidebarVisible(false);
        setIsLibraryWithSidebar(false);
      }
    } else {
      // Если URL не /Library, закрываем библиотеку
      setIsInlineLibraryOpen(false);
      setIsLibraryWithSidebar(false);
    }
  }, [location?.pathname, isUltraCompact, isMediumScreen, setIsInlineLibraryOpen, setIsCompactChatOpen, setIsMediumScreenSidebarVisible, setIsLibraryWithSidebar]);

  return {
    openInlineLibrary,
    closeInlineLibrary,
    handleLibraryBackButton,
  };
}

