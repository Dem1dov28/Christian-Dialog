import React from "react";
import PropTypes from "prop-types";
import Sidebar from "../sidebar/Sidebar.jsx";
import Chat from "../chat/Chat.jsx";

/**
 * Основной компонент Layout для структуры приложения
 * Управляет расположением Sidebar, Chat и Panels
 */
function MainLayout({
  // Sidebar props
  searchRef,
  onMenuClick,
  onChatSelect,
  onExplicitChatSwitch,
  onFolderChange,
  activeChatId,
  activeFolder,
  onOpenLibrary,
  onDeleteChat,
  onCreateNewChat,
  onOpenFolderManager,
  onPinToTop,
  onDeleteAgent,
  onUnsubscribeChannel,
  onHideChat,
  showProfile,
  profileScreenProps,
  // Chat props
  targetMessageId,
  onTargetMessageScrolled,
  onOpenChatSearch,
  isChatSearchModalOpen,
  onCloseChatSearchModal,
  isLeftPanelOpen,
  onMessageSent,
  isInlineLibraryOpen,
  onCloseInlineLibrary,
  onLibraryBackButton,
  isLibraryWithSidebar,
  showBackButton,
  onBack,
  // Layout state
  shouldRenderSidebar,
  sidebarShouldBeFullWidth,
  isMediumScreenChatFullWidth,
  isUltraCompact,
  isCompactChatOpen,
  isMediumScreen,
  activeChatId: activeChatIdForChat,
  onShowUpgradeModal,
  onSearchClose,
}) {
  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Рендерим Sidebar слева, когда библиотека открыта с sidebar в среднем режиме */}
      {isLibraryWithSidebar && shouldRenderSidebar ? (
        <Sidebar
          searchRef={searchRef}
          onSearchClose={onSearchClose}
          onMenuClick={onMenuClick}
          onChatSelect={onChatSelect}
          onExplicitChatSwitch={onExplicitChatSwitch}
          onFolderChange={onFolderChange}
          activeChatId={activeChatId}
          activeFolder={activeFolder}
          onOpenLibrary={onOpenLibrary}
          onDeleteChat={onDeleteChat}
          onCreateNewChat={onCreateNewChat}
          onOpenFolderManager={onOpenFolderManager}
          onPinToTop={onPinToTop}
          onDeleteAgent={onDeleteAgent}
          onUnsubscribeChannel={onUnsubscribeChannel}
          onHideChat={onHideChat}
          isFullWidth={false}
          showProfile={showProfile}
          profileScreenProps={profileScreenProps}
        />
      ) : null}

      {/* Рендерим Sidebar слева по умолчанию, ЕСЛИ не библиотека с sidebar в среднем режиме */}
      {shouldRenderSidebar && !isLibraryWithSidebar ? (
        <Sidebar
          searchRef={searchRef}
          onMenuClick={onMenuClick}
          onChatSelect={onChatSelect}
          onExplicitChatSwitch={onExplicitChatSwitch}
          onFolderChange={onFolderChange}
          activeChatId={activeChatId}
          activeFolder={activeFolder}
          onOpenLibrary={onOpenLibrary}
          onDeleteChat={onDeleteChat}
          onCreateNewChat={onCreateNewChat}
          onOpenFolderManager={onOpenFolderManager}
          onPinToTop={onPinToTop}
          onDeleteAgent={onDeleteAgent}
          onUnsubscribeChannel={onUnsubscribeChannel}
          onHideChat={onHideChat}
          isFullWidth={sidebarShouldBeFullWidth}
          showProfile={showProfile}
          profileScreenProps={profileScreenProps}
        />
      ) : null}

      {/* Chat */}
      {(!isUltraCompact || isCompactChatOpen || (isMediumScreen && !isUltraCompact && activeChatIdForChat)) ? (
            <div
              className={`flex flex-1 overflow-hidden ${
                isMediumScreenChatFullWidth ? "absolute inset-0 z-10" : ""
              }`}
              style={{
                ...(isMediumScreenChatFullWidth && {
                  left: 0,
                  right: 0,
                  top: 0,
                  bottom: 0,
                }),
              }}
            >
              <Chat
                activeChatId={activeChatIdForChat}
                targetMessageId={targetMessageId}
                onTargetMessageScrolled={onTargetMessageScrolled}
                onOpenChatSearch={onOpenChatSearch}
                isChatSearchModalOpen={isChatSearchModalOpen}
                onCloseChatSearchModal={onCloseChatSearchModal}
                isLeftPanelOpen={isLeftPanelOpen}
                onMessageSent={onMessageSent}
                onChatSelect={onChatSelect}
                isInlineLibraryOpen={isInlineLibraryOpen}
                onCloseInlineLibrary={onCloseInlineLibrary}
                onLibraryBackButton={onLibraryBackButton}
                isLibraryWithSidebar={isLibraryWithSidebar}
                onDeleteChat={onDeleteAgent}
                showBackButton={showBackButton}
                onBack={onBack}
                activeFolder={activeFolder}
                onShowUpgradeModal={onShowUpgradeModal}
                // УДАЛЕНО - selectedToolId (инструменты были удалены)
              />
            </div>
          ) : null}
    </div>
  );
}

MainLayout.propTypes = {
  // Sidebar props
  searchRef: PropTypes.object,
  onMenuClick: PropTypes.func.isRequired,
  onChatSelect: PropTypes.func.isRequired,
  onExplicitChatSwitch: PropTypes.func.isRequired,
  onFolderChange: PropTypes.func.isRequired,
  activeChatId: PropTypes.oneOfType([PropTypes.number, PropTypes.string, PropTypes.oneOf([null])]),
  activeFolder: PropTypes.string.isRequired,
  onOpenLibrary: PropTypes.func.isRequired,
  onDeleteChat: PropTypes.func.isRequired,
  onCreateNewChat: PropTypes.func.isRequired,
  onOpenFolderManager: PropTypes.func.isRequired,
  onPinToTop: PropTypes.func.isRequired,
  onDeleteAgent: PropTypes.func.isRequired,
  onUnsubscribeChannel: PropTypes.func.isRequired,
  onHideChat: PropTypes.func.isRequired,
  showProfile: PropTypes.bool.isRequired,
  profileScreenProps: PropTypes.object.isRequired,
  // Chat props
  targetMessageId: PropTypes.number,
  onTargetMessageScrolled: PropTypes.func.isRequired,
  onOpenChatSearch: PropTypes.func.isRequired,
  isChatSearchModalOpen: PropTypes.bool,
  onCloseChatSearchModal: PropTypes.func,
  isLeftPanelOpen: PropTypes.bool.isRequired,
  onMessageSent: PropTypes.func.isRequired,
  isInlineLibraryOpen: PropTypes.bool.isRequired,
  onCloseInlineLibrary: PropTypes.func.isRequired,
  onLibraryBackButton: PropTypes.func.isRequired,
  isLibraryWithSidebar: PropTypes.bool.isRequired,
  showBackButton: PropTypes.bool.isRequired,
  onBack: PropTypes.func,
  // Layout state
  shouldRenderSidebar: PropTypes.bool.isRequired,
  sidebarShouldBeFullWidth: PropTypes.bool.isRequired,
  isMediumScreenChatFullWidth: PropTypes.bool.isRequired,
  isUltraCompact: PropTypes.bool.isRequired,
  isCompactChatOpen: PropTypes.bool.isRequired,
  isMediumScreen: PropTypes.bool.isRequired,
  activeChatIdForChat: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  onSearchClose: PropTypes.func,
};

export default MainLayout;

