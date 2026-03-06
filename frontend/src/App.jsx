import React, { useCallback, useEffect, lazy, Suspense } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import DrawerMenu from "./components/menu/DrawerMenu.jsx";
import DeleteChatModal from "./components/chat/DeleteChatModal.jsx";
import ConnectionStatus from "./components/common/ConnectionStatus.jsx";
import { Toaster } from "./components/ui/toaster.jsx";
import { LazyGoogleOAuthProvider } from "./components/auth/LazyGoogleOAuthProvider.jsx";
import { SEO } from "./components/common/SEO";
import { getPersonSchema, getCollectionSchema } from "./utils/seoUtils";

// Lazy loaded page components for better initial load performance
const Login = lazy(() => import("./pages/Login.jsx"));
const Register = lazy(() => import("./pages/Register.jsx"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword.jsx"));
const ResetPassword = lazy(() => import("./pages/ResetPassword.jsx"));
const NotFound = lazy(() => import("./pages/NotFound.jsx"));
const SubscriptionSuccess = lazy(() => import("./pages/SubscriptionSuccess.jsx"));
const PaymentSuccess = lazy(() => import("./pages/PaymentSuccess.jsx"));
const PaymentFailed = lazy(() => import("./pages/PaymentFailed.jsx"));
const TelegramCallback = lazy(() => import("./pages/TelegramCallback.jsx"));

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import { LanguageProvider, useLanguage } from "./contexts/LanguageContext.jsx";
import { AuthProvider, useAuth } from "./contexts/AuthContext.jsx";
import { AgentsProvider, useAgents } from "./contexts/AgentsContext.jsx";
import { ChatsProvider, useChats } from "./contexts/ChatsContext.jsx";
import { FoldersProvider, useFolders } from "./contexts/FoldersContext.jsx";
import { NotificationProvider } from "./contexts/NotificationContext.jsx";
import {
  SidebarUpdateProvider,
} from "./contexts/SidebarUpdateContext.jsx";
import { ImageModalProvider } from "./contexts/ImageModalContext.jsx";
import { PanelWidthProvider } from "./contexts/PanelWidthContext.jsx";
import { ModalProvider } from "./contexts/ModalContext.jsx";
import MainLayout from "./components/layout/MainLayout.jsx";
import LoadingScreen from "./components/loading/LoadingScreen.jsx";
import { useGlobalLongPress } from "./hooks/common/useGlobalLongPress.js";
import { useAppState } from "./hooks/common/useAppState.js";
import { usePanelHandlers } from "./hooks/common/usePanelHandlers.js";
import { useLibraryHandlers } from "./hooks/common/useLibraryHandlers.js";
import { useChatHandlers } from "./hooks/chat/useChatHandlers.js";
import { useModalHandlers } from "./hooks/modal/useModalHandlers.js";
import { useFolderHandlers } from "./hooks/common/useFolderHandlers.js";
import { useModal } from "./contexts/ModalContext.jsx";
import apiClient from "./services/api";
import { useNotification } from "./contexts/NotificationContext.jsx";
import { initViewportHeight } from "./utils/viewportHeight.js";

// Lazy loaded components for better initial load performance
const PricingPage = lazy(() => import("./pages/PricingPage/PricingPage.jsx"));
const UpgradeModal = lazy(() => import("./components/modals/UpgradeModal.jsx"));
const FolderManager = lazy(() => import("./components/chat/FolderManager.jsx"));
const ReportModalNew = lazy(() => import("./components/modals/ReportModalNew.jsx"));
const SupportModalNew = lazy(() => import("./components/modals/SupportModalNew.jsx"));

// Компонент для основного приложения
function MainApp() {
  const navigate = useNavigate();
  const location = useLocation();

  // Используем кастомные хуки для управления состоянием
  const appState = useAppState();
  const [isInitialLoadComplete, setIsInitialLoadComplete] = React.useState(false);
  const {
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
    isFolderManagerOpen,
    setIsFolderManagerOpen,
    isDeleteChatModalOpen,
    setIsDeleteChatModalOpen,
    // УДАЛЕНО - переменные для UnsubscribeChannelModal (channels были удалены)
    modalData,
    setModalData,
    deleteChatData,
    setDeleteChatData,
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
    searchRef,
    rightPanelRef,
  } = appState;

  const {
    conversations,
    hasLoadedConversations,
    systemChat,
    activeConversation,
    messages,
    isLoading,
    error,
    pinnedChats,
    pinnedMessages,
    showUpgradeModal,
    upgradeModalReason,
    setShowUpgradeModal,
    checkMessageLimit,
    loadConversations,
    createChat,
    createGroupChat,
    getGroupChats,
    deleteGroupChat,
    sendMessage,
    sendGroupMessage,
    loadMessages,
    loadGroupMessages,
    continueGroupDialogue,
    selectConversation,
    deleteConversation,
    pinMessage,
    unpinMessage,
    deleteMessage,
    getConversation,
    channels,
    getConversationsByAgent,
    pinChat,
    unpinChat,
    isChatPinned,
    // Закрепление чатов в папках
    pinChatInFolder,
    unpinChatFromFolder,
    togglePinChatInFolder,
    getPinnedChatsInFolder,
    // Закрепление чатов в системных папках
    getPinnedChatsInSystemFolder,
    pinChatInSystemFolder,
    unpinChatFromSystemFolder,
    isChatPinnedInSystemFolder,
    togglePinChatInSystemFolder,
    // Функции для работы с закрепленными сообщениями
    loadPinnedMessages,
    pinMessageInChat,
    unpinMessageFromChat,
    scrollToMessage,
    unsubscribeFromChannel,
  } = useChats();
  const { getAgent, agents, isLoading: isAgentsLoading } = useAgents();
  const { user } = useAuth();
  const {
    folders,
    createFolder,
    updateFolder,
    deleteFolder,
    addRecommendedFolder,
    getRecommendedFolders,
    loadFolders,
    addChatToFolder,
    addAgentToFolder,
  } = useFolders();
  const { t } = useLanguage();
  const { isReportModalOpen, closeReportModal, isSupportModalOpen, closeSupportModal } = useModal();
  const { showSuccess, showError } = useNotification();

  // Используем хуки для обработчиков
  const panelHandlers = usePanelHandlers({
    isRightPanelVisible,
    setIsRightPanelVisible,
    setIsProfileVisible,
    rightPanelRef,
  });

  const libraryHandlers = useLibraryHandlers({
    isUltraCompact,
    isMediumScreen,
    setIsInlineLibraryOpen,
    setIsCompactChatOpen,
    setIsMediumScreenSidebarVisible,
    setIsLibraryWithSidebar,
    navigate,
    location,
  });

  const {
    toggleRightPanel,
    closeRightPanel,
    closeRightPanelWithAnimation,
    openProfile,
    closeProfile,
  } = panelHandlers;

  const {
    openInlineLibrary,
    closeInlineLibrary,
    handleLibraryBackButton,
  } = libraryHandlers;

  // Функция для открытия поиска по текущему чату
  const openChatSearch = useCallback(() => {
    if (searchRef.current) {
      searchRef.current.openSearch("messages");
    } else {
      // На мобильном при открытом чате Sidebar не смонтирован — показываем модалку поиска прямо в чате
      setIsChatSearchModalOpen(true);
    }
  }, [searchRef, setIsChatSearchModalOpen]);

  const closeChatSearchModal = useCallback(() => {
    setIsChatSearchModalOpen(false);
  }, [setIsChatSearchModalOpen]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), [setIsDrawerOpen]);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [setIsDrawerOpen]);

  // Функции для открытия/закрытия PricingPage с изменением URL
  const openPricingPage = useCallback(() => {
    if (navigate && location?.pathname !== '/Subscription') {
      navigate('/Subscription');
    }
    setIsPricingPageVisible(true);
  }, [navigate, location, setIsPricingPageVisible]);

  const isClosingPricingRef = React.useRef(false);
  const closePricingPage = useCallback(() => {
    isClosingPricingRef.current = true;
    setIsPricingPageVisible(false);
    if (navigate && location?.pathname === '/Subscription') {
      navigate('/', { replace: true });
    }
  }, [navigate, location, setIsPricingPageVisible]);

  // Используем хуки для обработчиков чатов
  const chatHandlers = useChatHandlers({
    activeChatId,
    setActiveChatId,
    setTargetMessageId,
    conversations,
    getAgent,
    createChat,
    selectConversation,
    deleteConversation,
    channels,
    isUltraCompact,
    isMediumScreen,
    setIsCompactChatOpen,
    setIsMediumScreenSidebarVisible,
    setIsInlineLibraryOpen,
    setIsLibraryWithSidebar,
    isRightPanelModal,
    setIsRightPanelVisible,
    systemChat,
    navigate,
    location,
  });

  const {
    handleChatSelect,
    handleExplicitChatSwitch,
    handleCreateNewChat,
    handleDeleteChat,
  } = chatHandlers;

  // Используем хуки для обработчиков модальных окон
  const modalHandlers = useModalHandlers({
    setIsDeleteChatModalOpen,
    // УДАЛЕНО - setIsUnsubscribeChannelModalOpen, setUnsubscribeChannelData (channels были удалены)
    setModalData,
    setDeleteChatData,
    setIsFolderManagerOpen,
    folders,
    addChatToFolder,
    addAgentToFolder,
    createFolder,
    loadFolders,
    deleteConversation,
    unsubscribeFromChannel,
    getAgent,
    conversations,
    t,
  });

  const {
    handlePinToTop: handlePinToTopBase,
    handleDeleteAgent,
    handleConfirmDeleteChat: handleConfirmDeleteChatBase,
    handleCloseDeleteModal,
    handleCreateFolderFromModal,
    handleOpenFolderManager,
    handleCloseFolderManager,
  } = modalHandlers;

  // Обертка для handlePinToTop с доступом к pinChat/unpinChat
  const handlePinToTop = useCallback(
    ({ chatId, agentId, conversationId }) => {
      handlePinToTopBase({ chatId, agentId, conversationId }, { pinChat, unpinChat, isChatPinned });
    },
    [handlePinToTopBase, pinChat, unpinChat, isChatPinned]
  );

  // Обертка для handleConfirmDeleteChat с доступом к handleDeleteChat
  const handleConfirmDeleteChat = useCallback(() => {
    handleConfirmDeleteChatBase(deleteChatData, handleDeleteChat);
  }, [handleConfirmDeleteChatBase, deleteChatData, handleDeleteChat]);

  // Обработчик отписки от канала
  const handleUnsubscribeChannel = useCallback(() => {
    if (activeConversation?.id && activeConversation?.is_channel) {
      unsubscribeFromChannel(activeConversation.id);
    }
  }, [activeConversation, unsubscribeFromChannel]);

  // Обработчик скрытия чата (заглушка)
  const handleHideChat = useCallback(() => {
    console.log("handleHideChat called - not implemented yet");
  }, []);

  const handleReportSubmit = async (reportData) => {
    try {
      await apiClient.post("/api/reports", reportData);
      showSuccess(t("report.success"));
    } catch (error) {
      console.error("Error submitting report:", error);
      showError(t("errors.reportSubmission"));
    }
  };

  const handleSupportSubmit = async (supportData) => {
    try {
      await apiClient.post("/api/support", supportData);
      showSuccess(t("support.requestSent"));
    } catch (error) {
      console.error("Error submitting support request:", error);
      showError(t("support.requestError"));
    }
  };

  // Используем хуки для обработчиков папок
  const folderHandlers = useFolderHandlers({
    createFolder,
    updateFolder,
    deleteFolder,
    addRecommendedFolder,
    loadFolders,
    setActiveFolder,
  });

  const {
    handleFolderCreate,
    handleFolderUpdate,
    handleFolderDelete,
    handleFolderAdd,
    handleFolderSelect,
    handleFolderChange,
  } = folderHandlers;


  // Функция для определения папки по ID агента
  const getFolderByChatId = useCallback((chatId) => {
    try {
      let agentId = chatId;

      // Если это conversationId, получаем agentId из разговора
      if (!chatId.toString().startsWith("agent-")) {
        const conversation = conversations.find((conv) => conv.id === chatId);
        if (conversation) {
          agentId = conversation.agent_id;
        }
      } else {
        // Если это agent-{id}, извлекаем ID агента
        agentId = parseInt(chatId.toString().replace("agent-", ""));
      }

      const agent = getAgent(agentId);
      console.log("Getting folder for agent:", agentId, "agent data:", agent);
      if (agent && agent.category) {
        console.log("Using agent category:", agent.category);
        return agent.category;
      }
    } catch (error) {
      console.error("Error getting agent for folder determination:", error);
    }

    // Fallback к статическому маппингу для старых агентов
    const chatFolders = {
      // Чаты
      fav: "chats",
      general: "chats",
      alerts: "chats",
      work: "chats",
      // Инструменты
      calculator: "tools",
      translator: "tools",
      weather: "tools",
      // Модели
      gpt4: "models",
      claude: "models",
      gemini: "models",
    };
    const fallbackFolder = chatFolders[chatId] || "chats";
    console.log("Using fallback folder:", fallbackFolder);
    return fallbackFolder;
  }, [conversations, getAgent]);

  const handleMessageSent = useCallback((chatId, message) => {
    // Принудительно обновляем sidebar для отображения нового последнего сообщения
    // Обновление теперь происходит автоматически в ChatsContext при отправке сообщения
  }, []);

  // Обновляем handleCreateNewChat для использования getFolderByChatId
  const handleCreateNewChatWithFolder = useCallback(
    async (agentId) => {
      const newChat = await handleCreateNewChat(agentId);
      if (newChat) {
        const folderId = getFolderByChatId(agentId);
        setActiveFolder(folderId);
      }
    },
    [handleCreateNewChat, getFolderByChatId, setActiveFolder]
  );


  // Эффект для отслеживания полной загрузки главной страницы
  React.useEffect(() => {
    // Проверяем, что все критические данные загружены
    const isAuthLoaded = !isLoading;
    const areAgentsLoaded = !isAgentsLoading && agents.length >= 0; // Может быть 0 агентов
    const areConversationsLoaded = !isLoading && conversations.length >= 0; // Может быть 0 чатов
    const areFoldersLoaded = folders.length >= 0; // Может быть 0 папок

    // Все основные данные загружены
    if (isAuthLoaded && areAgentsLoaded && areConversationsLoaded && areFoldersLoaded) {
      setIsInitialLoadComplete(true);
    }
  }, [isLoading, isAgentsLoading, agents.length, conversations.length, folders.length]);

  // Эффект для добавления класса фонового изображения темы только для авторизованных пользователей
  React.useEffect(() => {
    // Добавляем класс для фонового изображения темы
    document.body.classList.add('app-with-theme-bg');

    // Cleanup при размонтировании
    return () => {
      document.body.classList.remove('app-with-theme-bg');
    };
  }, []);

  // Initialize viewport height for mobile devices
  React.useEffect(() => {
    const cleanup = initViewportHeight();
    return cleanup;
  }, []);

  // Fallback для aigram:show-upgrade-modal (если компонент не получил onShowUpgradeModal)
  React.useEffect(() => {
    const handler = () => setShowUpgradeModal(true, "feature");
    window.addEventListener("aigram:show-upgrade-modal", handler);
    return () => window.removeEventListener("aigram:show-upgrade-modal", handler);
  }, [setShowUpgradeModal]);

  // Эффект для перенаправления на /Library при загрузке приложения
  // На мобильных: открываем библиотеку только если нет чатов (и обычных и групповых)
  // На десктопе: всегда открываем библиотеку
  React.useEffect(() => {
    // Ждём полной загрузки и загрузки чатов
    // Проверяем, что это первая загрузка (не возврат назад)
    const hasRedirected = sessionStorage.getItem('app_initial_redirect_done');

    if (isInitialLoadComplete && hasLoadedConversations && location.pathname === '/' && !hasRedirected) {
      sessionStorage.setItem('app_initial_redirect_done', 'true');

      const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;
      const hasChats = conversations && conversations.length > 0;
      const shouldOpenLibrary = !isMobile || !hasChats;

      if (shouldOpenLibrary) {
        navigate('/Library', { replace: true });
      }
    }
  }, [isInitialLoadComplete, hasLoadedConversations, location.pathname, conversations, navigate]);

  // Синхронизация URL с состоянием (обработка кнопки "назад" в браузере)
  // Используем ref для отслеживания предыдущего pathname
  const prevPathnameRef = React.useRef(location.pathname);

  React.useEffect(() => {
    const prevPathname = prevPathnameRef.current;
    const currentPathname = location.pathname;

    // Обновляем ref для следующего рендера
    prevPathnameRef.current = currentPathname;

    // При возврате на главную страницу (/), сбрасываем всё состояние как при нажатии кнопки "назад"
    // Исключение: переход с /Subscription — это просто закрытие overlay планов, не сбрасываем состояние
    if (currentPathname === '/' && prevPathname !== '/' && prevPathname !== '/Subscription') {
      // Сбрасываем активный чат
      if (activeChatId) {
        setActiveChatId(null);
      }
      // Закрываем библиотеку
      if (isInlineLibraryOpen) {
        setIsInlineLibraryOpen(false);
        setIsLibraryWithSidebar(false);
      }
      // Закрываем PricingPage
      if (isPricingPageVisible) {
        setIsPricingPageVisible(false);
      }
      // На средних экранах показываем sidebar
      if (isMediumScreen) {
        setIsMediumScreenSidebarVisible(true);
      }
      // На ультракомпактных закрываем чат
      if (isUltraCompact) {
        setIsCompactChatOpen(false);
      }
    }

    // Открываем PricingPage если URL /Subscription, но страница не видна
    // Не открываем, если пользователь только что закрыл панель (isClosingPricingRef)
    if (currentPathname === '/Subscription' && !isPricingPageVisible && !isClosingPricingRef.current) {
      setIsPricingPageVisible(true);
    }
    if (currentPathname !== '/Subscription') {
      isClosingPricingRef.current = false;
    }
  }, [location.pathname, activeChatId, setActiveChatId, isPricingPageVisible, setIsPricingPageVisible, isMediumScreen, isInlineLibraryOpen, setIsInlineLibraryOpen, isLibraryWithSidebar, setIsLibraryWithSidebar, setIsMediumScreenSidebarVisible, isUltraCompact, setIsCompactChatOpen]);

  // Показываем 3D лоадер до полной загрузки главной страницы
  if (!isInitialLoadComplete) {
    return <LoadingScreen isVisible={true} />;
  }

  // На главной странице без активного чата всегда показываем sidebar
  const isHomePageWithoutChat = location.pathname === '/' && !activeChatId && !isInlineLibraryOpen;

  const shouldRenderSidebar =
    isProfileVisible ||
    isHomePageWithoutChat ||
    (isUltraCompact && !isCompactChatOpen) ||
    (!isUltraCompact && !isMediumScreen) || // На больших экранах (>750px) всегда показываем
    (isMediumScreen && !isUltraCompact && (!activeChatId || isMediumScreenSidebarVisible || isLibraryWithSidebar)); // На средних (550-750px)
  const sidebarShouldBeFullWidth =
    isUltraCompact && (!isCompactChatOpen || isProfileVisible);

  // Определяем, должен ли Chat быть на всю ширину в среднем режиме
  // Chat на всю ширину, когда: есть активный чат ИЛИ открыта библиотека (без sidebar)
  const isMediumScreenChatFullWidth = isMediumScreen && !isUltraCompact && (activeChatId || isInlineLibraryOpen) && !isMediumScreenSidebarVisible && !isLibraryWithSidebar;

  return (
    <div className="flex h-full overflow-hidden w-full">
      <SEO
        title={activeConversation ? `${t("chat.chatWith", { name: activeConversation.title || activeConversation.agent_name })}` : t("library.title")}
        description={activeConversation?.agent_description || t("library.subtitle")}
        keywords={`${activeConversation?.agent_name || ""}, ${t("common.keywords")}`}
        schema={activeConversation
          ? getPersonSchema(activeConversation)
          : getCollectionSchema(agents)}
      />
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onProfileClick={openProfile}
        onOpenPricing={openPricingPage}
      />

      {/* Основной Layout компонент */}
      <MainLayout
        searchRef={searchRef}
        onMenuClick={openDrawer}
        onChatSelect={handleChatSelect}
        onExplicitChatSwitch={handleExplicitChatSwitch}
        onFolderChange={handleFolderChange}
        activeChatId={activeChatId}
        activeFolder={activeFolder}
        onOpenLibrary={openInlineLibrary}
        onDeleteChat={handleDeleteChat}
        onCreateNewChat={handleCreateNewChatWithFolder}
        onOpenFolderManager={handleOpenFolderManager}
        onPinToTop={handlePinToTop}
        onDeleteAgent={handleDeleteAgent}
        onUnsubscribeChannel={handleUnsubscribeChannel}
        onHideChat={handleHideChat}
        showProfile={isProfileVisible}
        profileScreenProps={{
          onClose: closeProfile,
          onOpenPricing: openPricingPage,
          onChatSelect: handleChatSelect,
        }}
        targetMessageId={targetMessageId}
        onTargetMessageScrolled={() => setTargetMessageId(null)}
        onToggleRightPanel={toggleRightPanel}
        onOpenChatSearch={openChatSearch}
        isChatSearchModalOpen={isChatSearchModalOpen}
        onCloseChatSearchModal={closeChatSearchModal}
        isRightPanelOpen={isRightPanelVisible}
        isLeftPanelOpen={isDrawerOpen}
        onMessageSent={handleMessageSent}
        isInlineLibraryOpen={isInlineLibraryOpen}
        onCloseInlineLibrary={closeInlineLibrary}
        onLibraryBackButton={handleLibraryBackButton}
        isLibraryWithSidebar={isLibraryWithSidebar}
        showBackButton={isUltraCompact || (isMediumScreen && !isUltraCompact && !isMediumScreenSidebarVisible)}
        onBack={
          isShowBackButton
            ? () => {
              if (isUltraCompact) {
                setIsCompactChatOpen(false);
              } else if (isMediumScreen && !isUltraCompact) {
                setIsMediumScreenSidebarVisible(true);
              }
            }
            : undefined
        }
        rightPanelRef={rightPanelRef}
        onCloseRightPanel={closeRightPanel}
        isRightPanelModal={isRightPanelModal}
        shouldRenderSidebar={shouldRenderSidebar}
        onSearchClose={() => setForceShowSidebarForSearch(false)}
        sidebarShouldBeFullWidth={sidebarShouldBeFullWidth}
        isMediumScreenChatFullWidth={isMediumScreenChatFullWidth}
        isUltraCompact={isUltraCompact}
        isCompactChatOpen={isCompactChatOpen}
        isMediumScreen={isMediumScreen}
        activeChatIdForChat={activeChatId}
        onShowUpgradeModal={(reason) => setShowUpgradeModal(true, reason || "feature")}
      />

      {/* Modals - wrapped in Suspense for lazy loading */}
      <Suspense fallback={null}>
        <ReportModalNew
          isOpen={isReportModalOpen}
          onClose={closeReportModal}
          onSubmit={handleReportSubmit}
        />
      </Suspense>
      <Suspense fallback={null}>
        <SupportModalNew
          isOpen={isSupportModalOpen}
          onClose={closeSupportModal}
          onSubmit={handleSupportSubmit}
        />
      </Suspense>

      <DeleteChatModal
        isOpen={isDeleteChatModalOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDeleteChat}
        chatName={(() => {
          // Для групповых чатов
          if (!deleteChatData.agentId) {
            const conversation = conversations.find(
              (conv) => conv.id === deleteChatData.conversationId
            );
            return conversation?.title || "Групповой чат";
          }

          // Для обычных чатов с агентом
          const agent = getAgent(deleteChatData.agentId);
          if (!agent) {
            return "Удалённый аккаунт";
          }

          // Находим все разговоры с этим агентом
          const agentConversations = conversations.filter(
            (conv) => conv.agent_id === deleteChatData.agentId && !conv.is_group
          );

          // Если чатов с агентом один или меньше, возвращаем просто имя
          if (agentConversations.length <= 1) {
            return agent.name;
          }

          // Сортируем по времени создания (по возрастанию)
          const sortedConversations = agentConversations.sort(
            (a, b) => new Date(a.created_at) - new Date(b.created_at)
          );

          // Находим индекс текущего разговора
          const conversationIndex = sortedConversations.findIndex(
            (conv) => conv.id === deleteChatData.conversationId
          );

          // Если индекс не найден, возвращаем просто имя
          if (conversationIndex === -1) {
            return agent.name;
          }

          // Возвращаем имя с номером
          return `${agent.name} (${conversationIndex + 1})`;
        })()}
        agentIcon={
          deleteChatData.agentId
            ? getAgent(deleteChatData.agentId)?.icon_name
            : conversations.find(
              (conv) => conv.id === deleteChatData.conversationId
            )?.group_avatar || "group"
        }
        agentColor={
          deleteChatData.agentId
            ? (() => {
              const colorClass = getAgent(deleteChatData.agentId)?.color_class || "purple-500";
              // Убираем префиксы bg- и dark:bg- для модального окна
              return colorClass
                .replace(/^bg-/, "")
                .replace(/dark:bg-/, "")
                .split(" ")[0] || "purple-500";
            })()
            : "purple-500"
        }
        agentImage={
          deleteChatData.agentId
            ? getAgent(deleteChatData.agentId)?.image_url || getAgent(deleteChatData.agentId)?.avatar_url
            : null
        }
      />

      {/* УДАЛЕНО - UnsubscribeChannelModal (channels были удалены) */}

      <Suspense fallback={null}>
        <FolderManager
          isOpen={isFolderManagerOpen}
          onClose={handleCloseFolderManager}
          onFolderCreate={handleFolderCreate}
          onFolderUpdate={handleFolderUpdate}
          onFolderDelete={handleFolderDelete}
          onFolderAdd={handleFolderAdd}
          onFolderSelect={handleFolderSelect}
          onChatSelect={handleChatSelect}
          folders={folders}
          recommendedFolders={getRecommendedFolders()}
          conversations={conversations}
          agents={agents}
        />
      </Suspense>

      {/* Pricing Page - lazy loaded */}
      <Suspense fallback={null}>
        <PricingPage
          isVisible={isPricingPageVisible}
          onClose={closePricingPage}
        />
      </Suspense>

      {/* Upgrade Modal - lazy loaded */}
      <Suspense fallback={null}>
        <UpgradeModal
          isOpen={showUpgradeModal}
          reason={upgradeModalReason}
          onClose={() => setShowUpgradeModal(false)}
          onOpenPricing={openPricingPage}
        />
      </Suspense>

      {/* Toast уведомления */}
      <Toaster />
    </div>
  );
}

// Компонент для защищенных маршрутов
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen isVisible={true} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

// Компонент для публичных маршрутов (только для неавторизованных)
function PublicRoute({ children, allowAuthenticated = false }) {
  const { isAuthenticated, isInitializing } = useAuth();
  const { conversations, hasLoadedConversations } = useChats();
  const location = useLocation();
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 768;

  // Ждём загрузки аутентификации
  if (isInitializing) {
    return <LoadingScreen isVisible={true} />;
  }

  // Для авторизованных на мобильных: ждём загрузки чатов перед редиректом
  if (isAuthenticated && !allowAuthenticated && isMobile && !hasLoadedConversations) {
    return <LoadingScreen isVisible={true} />;
  }

  if (isAuthenticated && !allowAuthenticated) {
    // На мобильных устройствах: открываем библиотеку только если нет чатов
    // На десктопе: всегда открываем библиотеку
    const hasChats = conversations && conversations.length > 0;
    const shouldOpenLibrary = !isMobile || !hasChats;

    return <Navigate to={shouldOpenLibrary ? "/Library" : "/"} replace />;
  }

  return children;
}

// Компонент для глобальной обработки long press
function GlobalLongPressHandler() {
  useGlobalLongPress();
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <AgentsProvider>
            <SidebarUpdateProvider>
              <PanelWidthProvider>
                <ModalProvider>
                  <FoldersProvider>
                    <ChatsProvider>
                      <NotificationProvider>
                        <ImageModalProvider>
                          {/* Preloader для заранее загрузки 3D ресурсов */}
                          <LoadingScreen.Preloader />

                          <Router
                            future={{
                              v7_startTransition: true,
                              v7_relativeSplatPath: true,
                            }}
                          >
                            <GlobalLongPressHandler />
                            <ConnectionStatus />
                            <div className="flex w-full overflow-x-hidden overflow-y-auto" style={{ height: '100%', WebkitOverflowScrolling: 'touch' }}>
                              <Suspense fallback={<LoadingScreen isVisible={true} />}>
                                {googleClientId ? (
                                  <LazyGoogleOAuthProvider clientId={googleClientId}>
                                    <Routes>
                                      {/* Публичные маршруты */}
                                      <Route
                                        path="/login"
                                        element={
                                          <PublicRoute>
                                            <Login />
                                          </PublicRoute>
                                        }
                                      />
                                      <Route
                                        path="/register"
                                        element={
                                          <PublicRoute>
                                            <Register />
                                          </PublicRoute>
                                        }
                                      />
                                      <Route
                                        path="/forgot-password"
                                        element={
                                          <PublicRoute allowAuthenticated={true}>
                                            <ForgotPassword />
                                          </PublicRoute>
                                        }
                                      />
                                      <Route
                                        path="/reset-password"
                                        element={
                                          <PublicRoute>
                                            <ResetPassword />
                                          </PublicRoute>
                                        }
                                      />
                                      <Route
                                        path="/auth/telegram-callback"
                                        element={<TelegramCallback />}
                                      />
                                      <Route
                                        path="/subscription-success"
                                        element={
                                          <ProtectedRoute>
                                            <SubscriptionSuccess />
                                          </ProtectedRoute>
                                        }
                                      />
                                      <Route
                                        path="/successful-payment"
                                        element={
                                          <ProtectedRoute>
                                            <PaymentSuccess />
                                          </ProtectedRoute>
                                        }
                                      />
                                      <Route
                                        path="/failed-payment"
                                        element={
                                          <ProtectedRoute>
                                            <PaymentFailed />
                                          </ProtectedRoute>
                                        }
                                      />

                                      {/* Защищенные маршруты */}
                                      <Route
                                        path="/"
                                        element={
                                          <ProtectedRoute>
                                            <MainApp />
                                          </ProtectedRoute>
                                        }
                                      />
                                      <Route
                                        path="/Library"
                                        element={
                                          <ProtectedRoute>
                                            <MainApp />
                                          </ProtectedRoute>
                                        }
                                      />
                                      <Route
                                        path="/chat"
                                        element={
                                          <ProtectedRoute>
                                            <MainApp />
                                          </ProtectedRoute>
                                        }
                                      />
                                      <Route
                                        path="/Subscription"
                                        element={
                                          <ProtectedRoute>
                                            <MainApp />
                                          </ProtectedRoute>
                                        }
                                      />

                                      {/* 404 маршрут */}
                                      <Route path="*" element={<NotFound />} />
                                    </Routes>
                                  </LazyGoogleOAuthProvider>
                                ) : (
                                  <Routes>
                                    <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
                                    <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
                                    <Route path="/forgot-password" element={<PublicRoute allowAuthenticated={true}><ForgotPassword /></PublicRoute>} />
                                    <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
                                    <Route path="/auth/telegram-callback" element={<TelegramCallback />} />
                                    <Route path="/subscription-success" element={<ProtectedRoute><SubscriptionSuccess /></ProtectedRoute>} />
                                    <Route path="/successful-payment" element={<ProtectedRoute><PaymentSuccess /></ProtectedRoute>} />
                                    <Route path="/failed-payment" element={<ProtectedRoute><PaymentFailed /></ProtectedRoute>} />
                                    <Route path="/" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
                                    <Route path="/Library" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
                                    <Route path="/chat" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
                                    <Route path="/Subscription" element={<ProtectedRoute><MainApp /></ProtectedRoute>} />
                                    <Route path="*" element={<NotFound />} />
                                  </Routes>
                                )}
                              </Suspense>

                              {/* Toast уведомления */}
                              <Toaster />
                            </div>
                          </Router>
                        </ImageModalProvider>
                      </NotificationProvider>
                    </ChatsProvider>
                  </FoldersProvider>
                </ModalProvider>
              </PanelWidthProvider>
            </SidebarUpdateProvider>
          </AgentsProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
