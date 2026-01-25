import React, { useCallback, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import DrawerMenu from "./components/menu/DrawerMenu.jsx";
import CollectionModal from "./components/chat/CollectionModal.jsx";
import DeleteChatModal from "./components/chat/DeleteChatModal.jsx";
import PricingPage from "./pages/PricingPage/PricingPage.jsx";
import UpgradeModal from "./components/modals/UpgradeModal.jsx";
import ConnectionStatus from "./components/common/ConnectionStatus.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import Index from "./pages/Index.jsx";
import NotFound from "./pages/NotFound.jsx";
import { Toaster } from "./components/ui/toaster.jsx";
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
import FolderManager from "./components/chat/FolderManager.jsx";
import MainLayout from "./components/layout/MainLayout.jsx";
import { useGlobalLongPress } from "./hooks/common/useGlobalLongPress.js";
import { useAppState } from "./hooks/common/useAppState.js";
import { usePanelHandlers } from "./hooks/common/usePanelHandlers.js";
import { useLibraryHandlers } from "./hooks/common/useLibraryHandlers.js";
import { useChatHandlers } from "./hooks/chat/useChatHandlers.js";
import { useModalHandlers } from "./hooks/modal/useModalHandlers.js";
import { useFolderHandlers } from "./hooks/common/useFolderHandlers.js";

// Компонент для основного приложения
function MainApp() {
  // Используем кастомные хуки для управления состоянием
  const appState = useAppState();
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
    isAISettingsVisible,
    setIsAISettingsVisible,
    targetMessageId,
    setTargetMessageId,
    isCompactChatOpen,
    setIsCompactChatOpen,
    isCollectionModalOpen,
    setIsCollectionModalOpen,
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
    searchRef,
    rightPanelRef,
  } = appState;

  const {
    conversations,
    activeConversation,
    messages,
    isLoading,
    error,
    pinnedChats,
    pinnedMessages,
    showUpgradeModal,
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
    systemChat,
    toggleSystemChatVisibility,
    unsubscribeFromChannel,
  } = useChats();
  const { getAgent, agents } = useAgents();
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

  // Используем хуки для обработчиков
  const panelHandlers = usePanelHandlers({
    isRightPanelVisible,
    setIsRightPanelVisible,
    setIsProfileVisible,
    setIsAISettingsVisible,
    rightPanelRef,
  });

  const libraryHandlers = useLibraryHandlers({
    isUltraCompact,
    isMediumScreen,
    setIsInlineLibraryOpen,
    setIsCompactChatOpen,
    setIsMediumScreenSidebarVisible,
    setIsLibraryWithSidebar,
  });

  const {
    toggleRightPanel,
    closeRightPanel,
    closeRightPanelWithAnimation,
    openProfile,
    closeProfile,
    openAISettings,
    closeAISettings,
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
    }
  }, [searchRef]);

  const openDrawer = useCallback(() => setIsDrawerOpen(true), [setIsDrawerOpen]);
  const closeDrawer = useCallback(() => setIsDrawerOpen(false), [setIsDrawerOpen]);

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
    setIsAISettingsVisible,
    isRightPanelModal,
    setIsRightPanelVisible,
    systemChat,
  });

  const {
    handleChatSelect,
    handleExplicitChatSwitch,
    handleCreateNewChat,
    handleDeleteChat,
  } = chatHandlers;

  // Используем хуки для обработчиков модальных окон
  const modalHandlers = useModalHandlers({
    setIsCollectionModalOpen,
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
    handleAddToCollection,
    handlePinToTop: handlePinToTopBase,
    handleDeleteAgent,
    handleConfirmDeleteChat: handleConfirmDeleteChatBase,
    handleCloseDeleteModal,
    handleCollectionAdd,
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

  const handleHideChat = async ({ chatId, conversationId }) => {
    try {
      await toggleSystemChatVisibility();
      console.log("System chat hidden");
    } catch (error) {
      console.error("Failed to hide system chat:", error);
    }
  };

  const shouldRenderSidebar =
    isProfileVisible || 
    (isUltraCompact && !isCompactChatOpen) ||
    (!isUltraCompact && !isMediumScreen) || // На больших экранах (>750px) всегда показываем
    (isMediumScreen && !isUltraCompact && (!activeChatId || isMediumScreenSidebarVisible || isLibraryWithSidebar)); // На средних (550-750px)
  const sidebarShouldBeFullWidth =
    isUltraCompact && (!isCompactChatOpen || isProfileVisible);

  // Определяем, должен ли Chat быть на всю ширину в среднем режиме
  // Chat на всю ширину, когда: есть активный чат ИЛИ открыта библиотека (без sidebar)
  const isMediumScreenChatFullWidth = isMediumScreen && !isUltraCompact && (activeChatId || isInlineLibraryOpen) && !isMediumScreenSidebarVisible && !isLibraryWithSidebar;

  return (
    <div className="flex h-screen overflow-hidden w-full">
      <DrawerMenu
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        onProfileClick={openProfile}
        onAISettingsClick={openAISettings}
        onSavedMessagesClick={async () => {
          if (systemChat) {
            console.log("Opening Saved Messages from DrawerMenu:", systemChat);
            await selectConversation(systemChat.id);
            handleChatSelect(systemChat.id);
          } else {
            console.log("System chat not available");
          }
        }}
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
        onAddToCollection={handleAddToCollection}
        onPinToTop={handlePinToTop}
        onDeleteAgent={handleDeleteAgent}
        onUnsubscribeChannel={handleUnsubscribeChannel}
        onHideChat={handleHideChat}
        showProfile={isProfileVisible}
        profileScreenProps={{
          onClose: closeProfile,
          onOpenPricing: () => setIsPricingPageVisible(true),
          onChatSelect: handleChatSelect,
        }}
        targetMessageId={targetMessageId}
        onTargetMessageScrolled={() => setTargetMessageId(null)}
        onToggleRightPanel={toggleRightPanel}
        onOpenChatSearch={openChatSearch}
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
        isAISettingsVisible={isAISettingsVisible}
        onCloseAISettings={closeAISettings}
        shouldRenderSidebar={shouldRenderSidebar}
        sidebarShouldBeFullWidth={sidebarShouldBeFullWidth}
        isMediumScreenChatFullWidth={isMediumScreenChatFullWidth}
        isUltraCompact={isUltraCompact}
        isCompactChatOpen={isCompactChatOpen}
        isMediumScreen={isMediumScreen}
        activeChatIdForChat={activeChatId}
        onShowUpgradeModal={() => setShowUpgradeModal(true)}
      />

      {/* Modals */}
      <CollectionModal
        isOpen={isCollectionModalOpen}
        onClose={() => setIsCollectionModalOpen(false)}
        onAddToCollection={handleCollectionAdd}
        agentId={modalData?.agentId}
        conversationId={modalData?.conversationId}
        chatId={modalData?.chatId}
        folders={folders}
        onCreateFolder={handleCreateFolderFromModal}
      />

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

      {/* Pricing Page */}
      <PricingPage
        isVisible={isPricingPageVisible}
        onClose={() => setIsPricingPageVisible(false)}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={(tier) => {
          setShowUpgradeModal(false);
          setIsPricingPageVisible(true);
        }}
        currentTier={user?.subscription_tier || "free"}
      />

      {/* Toast уведомления */}
      <Toaster />
    </div>
  );
}

// Компонент для защищенных маршрутов
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

// Компонент для публичных маршрутов (только для неавторизованных)
function PublicRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const { t } = useLanguage();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return !isAuthenticated ? children : <Navigate to="/" replace />;
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
            <FoldersProvider>
              <ChatsProvider>
                <NotificationProvider>
<ImageModalProvider>
                <Router
                  future={{
                    v7_startTransition: true,
                    v7_relativeSplatPath: true,
                  }}
                >
                  <GlobalLongPressHandler />
                  <ConnectionStatus />
                  <div className="flex h-screen overflow-hidden items-center justify-center">
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
                          <PublicRoute>
                            <ForgotPassword />
                          </PublicRoute>
                        }
                      />
                      <Route
                        path="/welcome"
                        element={
                          <PublicRoute>
                            <Index />
                          </PublicRoute>
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


                      {/* 404 маршрут */}
                      <Route path="*" element={<NotFound />} />
                    </Routes>

                    {/* Toast уведомления */}
                    <Toaster />
                  </div>
                </Router>
                  </ImageModalProvider>
                </NotificationProvider>
              </ChatsProvider>
            </FoldersProvider>
            </PanelWidthProvider>
          </SidebarUpdateProvider>
        </AgentsProvider>
      </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
