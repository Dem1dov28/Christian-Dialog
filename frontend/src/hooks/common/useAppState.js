import { useState, useEffect, useRef } from "react";
import { useMaxWidth } from "./use-mobile.jsx";

/**
 * Хук для управления основным состоянием приложения
 * Включает состояние UI элементов, модальных окон, панелей
 */
export function useAppState() {
  // Основные состояния UI
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeChatId, setActiveChatId] = useState(null);
  const [activeFolder, setActiveFolder] = useState("chats");
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);
  const [isRightPanelModal, setIsRightPanelModal] = useState(false);
  const [isProfileVisible, setIsProfileVisible] = useState(false);
  const [isInlineLibraryOpen, setIsInlineLibraryOpen] = useState(false);
  const [isPricingPageVisible, setIsPricingPageVisible] = useState(false);
  const [targetMessageId, setTargetMessageId] = useState(null);
  const [isCompactChatOpen, setIsCompactChatOpen] = useState(false);

  // Состояния модальных окон
  const [isFolderManagerOpen, setIsFolderManagerOpen] = useState(false);
  const [isDeleteChatModalOpen, setIsDeleteChatModalOpen] = useState(false);
  const [modalData, setModalData] = useState({});
  const [deleteChatData, setDeleteChatData] = useState({});

  // Адаптивные состояния
  const isUltraCompact = useMaxWidth(550);
  const isShowBackButton = useMaxWidth(750);
  const isMediumScreen = useMaxWidth(750);
  const [isMediumScreenSidebarVisible, setIsMediumScreenSidebarVisible] = useState(false);
  const [isLibraryWithSidebar, setIsLibraryWithSidebar] = useState(false);
  const [forceShowSidebarForSearch, setForceShowSidebarForSearch] = useState(false);

  // Refs
  const searchRef = useRef(null);
  const rightPanelRef = useRef(null);
  const prevActiveFolderRef = useRef(activeFolder);

  // Эффекты для управления адаптивным поведением
  useEffect(() => {
    if (!isUltraCompact) {
      setIsCompactChatOpen(false);
    }
  }, [isUltraCompact]);

  useEffect(() => {
    if (!isMediumScreen || isUltraCompact) {
      setIsMediumScreenSidebarVisible(false);
      setIsLibraryWithSidebar(false);
    }
  }, [isMediumScreen, isUltraCompact]);

  // Эффект для определения модального режима правой панели
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const updateIsModal = () => {
      const shouldBeModal = window.innerWidth < 1220;

      setIsRightPanelModal((prevIsModal) => {
        if (prevIsModal !== shouldBeModal) {
          setIsRightPanelVisible(false);
        }
        return shouldBeModal;
      });
    };

    const mediaQuery = window.matchMedia("(max-width: 1219px)");
    updateIsModal();

    mediaQuery.addEventListener("change", updateIsModal);
    window.addEventListener("resize", updateIsModal);

    return () => {
      mediaQuery.removeEventListener("change", updateIsModal);
      window.removeEventListener("resize", updateIsModal);
    };
  }, []);

  useEffect(() => {
    if (isRightPanelModal) {
      setIsRightPanelVisible(false);
    }
  }, [isRightPanelModal]);

  // Закрываем библиотеку при переключении между вкладками
  useEffect(() => {
    // Проверяем, изменилась ли активная папка (не первая инициализация)
    if (prevActiveFolderRef.current !== activeFolder && prevActiveFolderRef.current !== null) {
      // Закрываем библиотеку при переключении вкладок
      setIsInlineLibraryOpen(false);
      setIsLibraryWithSidebar(false);
    }
    // Обновляем предыдущее значение активной папки
    prevActiveFolderRef.current = activeFolder;
  }, [activeFolder]);

  return {
    // Основные состояния
    isDrawerOpen,
    setIsDrawerOpen,
    activeChatId,
    setActiveChatId,
    activeFolder,
    setActiveFolder,
    isRightPanelVisible,
    setIsRightPanelVisible,
    isRightPanelModal,
    isProfileVisible,
    setIsProfileVisible,
    isInlineLibraryOpen,
    setIsInlineLibraryOpen,
    isPricingPageVisible,
    setIsPricingPageVisible,

    targetMessageId,
    setTargetMessageId,
    isCompactChatOpen,
    setIsCompactChatOpen,

    // Модальные окна
    isFolderManagerOpen,
    setIsFolderManagerOpen,
    isDeleteChatModalOpen,
    setIsDeleteChatModalOpen,
    modalData,
    setModalData,
    deleteChatData,
    setDeleteChatData,

    // Адаптивные состояния
    isUltraCompact,
    isShowBackButton,
    isMediumScreen,
    isMediumScreenSidebarVisible,
    setIsMediumScreenSidebarVisible,
    isLibraryWithSidebar,
    setIsLibraryWithSidebar,
    forceShowSidebarForSearch,
    setForceShowSidebarForSearch,

    // Refs
    searchRef,
    rightPanelRef,
  };
}

