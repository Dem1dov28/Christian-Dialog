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
  const [isChatSearchModalOpen, setIsChatSearchModalOpen] = useState(false);

  // Refs
  const searchRef = useRef(null);
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
    isChatSearchModalOpen,
    setIsChatSearchModalOpen,

    // Refs
    searchRef,
  };
}

