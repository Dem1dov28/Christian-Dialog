import React from "react";
import PropTypes from "prop-types";
import Sidebar from "../sidebar/Sidebar.jsx";
import Chat from "../chat/Chat.jsx";
import RightPanel from "../panels/RightPanel.jsx";
import AISettingsPanel from "../panels/AISettingsPanel.jsx";

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
  onAddToCollection,
  onPinToTop,
  onDeleteAgent,
  onUnsubscribeChannel,
  onHideChat,
  showProfile,
  profileScreenProps,
  // Chat props
  targetMessageId,
  onTargetMessageScrolled,
  onToggleRightPanel,
  onOpenChatSearch,
  isRightPanelOpen,
  isLeftPanelOpen,
  onMessageSent,
  isInlineLibraryOpen,
  onCloseInlineLibrary,
  onLibraryBackButton,
  isLibraryWithSidebar,
  showBackButton,
  onBack,
  // Panel props
  rightPanelRef,
  onCloseRightPanel,
  isRightPanelModal,
  // AI Settings
  isAISettingsVisible,
  onCloseAISettings,
  // Layout state
  shouldRenderSidebar,
  sidebarShouldBeFullWidth,
  isMediumScreenChatFullWidth,
  isUltraCompact,
  isCompactChatOpen,
  isMediumScreen,
  activeChatId: activeChatIdForChat,
}) {
  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* Рендерим Sidebar слева, когда библиотека открыта с sidebar в среднем режиме */}
      {isLibraryWithSidebar && shouldRenderSidebar ? (
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
          onAddToCollection={onAddToCollection}
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
          onAddToCollection={onAddToCollection}
          onPinToTop={onPinToTop}
          onDeleteAgent={onDeleteAgent}
          onUnsubscribeChannel={onUnsubscribeChannel}
          onHideChat={onHideChat}
          isFullWidth={sidebarShouldBeFullWidth}
          showProfile={showProfile}
          profileScreenProps={profileScreenProps}
        />
      ) : null}

      {/* AI Settings Panel или Chat */}
      {isAISettingsVisible ? (
        <AISettingsPanel onClose={onCloseAISettings} />
      ) : (
        <>
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
                onToggleRightPanel={onToggleRightPanel}
                onOpenChatSearch={onOpenChatSearch}
                isRightPanelOpen={isRightPanelOpen}
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
                // УДАЛЕНО - selectedToolId (инструменты были удалены)
              />
              {isRightPanelOpen && activeChatIdForChat && !isInlineLibraryOpen && (
                <RightPanel
                  ref={rightPanelRef}
                  onClose={onCloseRightPanel}
                  activeChatId={activeChatIdForChat}
                  onDeleteChat={onDeleteAgent}
                  isModal={isRightPanelModal}
                />
              )}
            </div>
          ) : null}
        </>
      )}
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
  onAddToCollection: PropTypes.func.isRequired,
  onPinToTop: PropTypes.func.isRequired,
  onDeleteAgent: PropTypes.func.isRequired,
  onUnsubscribeChannel: PropTypes.func.isRequired,
  onHideChat: PropTypes.func.isRequired,
  showProfile: PropTypes.bool.isRequired,
  profileScreenProps: PropTypes.object.isRequired,
  // Chat props
  targetMessageId: PropTypes.number,
  onTargetMessageScrolled: PropTypes.func.isRequired,
  onToggleRightPanel: PropTypes.func.isRequired,
  onOpenChatSearch: PropTypes.func.isRequired,
  isRightPanelOpen: PropTypes.bool.isRequired,
  isLeftPanelOpen: PropTypes.bool.isRequired,
  onMessageSent: PropTypes.func.isRequired,
  isInlineLibraryOpen: PropTypes.bool.isRequired,
  onCloseInlineLibrary: PropTypes.func.isRequired,
  onLibraryBackButton: PropTypes.func.isRequired,
  isLibraryWithSidebar: PropTypes.bool.isRequired,
  showBackButton: PropTypes.bool.isRequired,
  onBack: PropTypes.func,
  // Panel props
  rightPanelRef: PropTypes.object.isRequired,
  onCloseRightPanel: PropTypes.func.isRequired,
  isRightPanelModal: PropTypes.bool.isRequired,
  // AI Settings
  isAISettingsVisible: PropTypes.bool.isRequired,
  onCloseAISettings: PropTypes.func.isRequired,
  // Layout state
  shouldRenderSidebar: PropTypes.bool.isRequired,
  sidebarShouldBeFullWidth: PropTypes.bool.isRequired,
  isMediumScreenChatFullWidth: PropTypes.bool.isRequired,
  isUltraCompact: PropTypes.bool.isRequired,
  isCompactChatOpen: PropTypes.bool.isRequired,
  isMediumScreen: PropTypes.bool.isRequired,
  activeChatIdForChat: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
};

export default MainLayout;

