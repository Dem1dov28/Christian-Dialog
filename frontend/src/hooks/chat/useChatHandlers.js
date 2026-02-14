import { useCallback } from "react";
import apiClient from "../../services/api";

/**
 * Хук для управления обработчиками чатов
 */
export function useChatHandlers({
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
}) {
  const openCompactChatView = useCallback(() => {
    if (isUltraCompact) {
      setIsCompactChatOpen(true);
    } else if (isMediumScreen && !isUltraCompact) {
      // Для диапазона 550-750px: скрываем sidebar при открытии чата
      setIsMediumScreenSidebarVisible(false);
    }
  }, [isUltraCompact, isMediumScreen, setIsCompactChatOpen, setIsMediumScreenSidebarVisible]);

  const handleChatSelect = useCallback(
    async (chatId, messageId = null) => {
      try {
        // Если chatId равен null, сбрасываем активный чат
        if (chatId === null || chatId === undefined) {
          setActiveChatId(null);
          // Также сбрасываем активный разговор в ChatsContext
          // Используем selectConversation с несуществующим ID, чтобы сбросить состояние
          // Или можно создать отдельную функцию для сброса
          return;
        }

        // Убеждаемся, что chatId - строка
        const chatIdStr = String(chatId);

        // Проверяем, не открыт ли уже этот чат
        const isChatAlreadyOpen = String(activeChatId) === chatIdStr && !messageId;

        // Если чат уже открыт и мы в мобильном режиме (<750px), открываем его визуально, но не перерендериваем
        if (isChatAlreadyOpen && isMediumScreen) {
          console.log(`Чат ${chatIdStr} уже открыт, но открываем его визуально для мобильного режима (<750px)`);
          openCompactChatView();
          return;
        }

        // Если чат уже открыт и нет messageId, пропускаем перерендер
        if (isChatAlreadyOpen) {
          console.log(`Чат ${chatIdStr} уже открыт, пропускаем перерендер`);
          return;
        }

        // Сохраняем ID целевого сообщения для последующего скролла
        if (messageId) {
          setTargetMessageId(messageId);
        }

        // Закрываем встроенную библиотеку при выборе чата
        setIsInlineLibraryOpen(false);
        setIsLibraryWithSidebar(false);


        if (isRightPanelModal) {
          setIsRightPanelVisible(false);
        }

        console.log("handleChatSelect called with:", chatIdStr, "messageId:", messageId);

        // Проверяем, является ли это agent-{id} или conversationId
        if (chatIdStr.startsWith("agent-")) {
          // Это агент без разговора, создаем новый чат
          const agentId = parseInt(chatIdStr.replace("agent-", ""));
          console.log("Creating new chat for agent:", agentId);
          const newChat = await createChat(agentId, true);
          setActiveChatId(newChat.id);
          openCompactChatView();
        } else {
          // Сначала проверяем, есть ли разговор с таким ID (включая групповые чаты)
          const conversation = conversations.find((conv) => String(conv.id) === chatIdStr);

          // Также проверяем системный чат
          const isSystemChat = systemChat && String(systemChat.id) === chatIdStr;

          if (conversation || isSystemChat) {
            const chatToOpen = conversation || systemChat;
            console.log("Switching to conversation:", chatIdStr, "type:", isSystemChat ? "system" : (chatToOpen.is_group ? "group" : "single"));
            setActiveChatId(chatIdStr);
            await selectConversation(chatIdStr);
            openCompactChatView();
          } else {
            // Если это число и есть агент с таким ID, создаем новый чат
            const numericId = parseInt(chatIdStr);
            if (!isNaN(numericId) && getAgent(numericId)) {
              // Если это число и есть агент с таким ID, создаем новый чат
              console.log("Found agent with ID:", numericId, "but checking if this might be a group chat ID");

              // Проверяем, не является ли это ID группового чата, который еще не загружен
              try {
                const groupChat = await apiClient.getGroupChat(numericId);
                if (groupChat) {
                  console.log("Found group chat on server:", numericId);
                  setActiveChatId(numericId);
                  await selectConversation(numericId);
                  openCompactChatView();
                  return;
                }
              } catch (error) {
                console.log("Not a group chat, creating regular chat for agent:", numericId);
              }

              // Дополнительная проверка: если ID очень большой, скорее всего это групповой чат
              if (numericId > 1000) {
                console.log("Large ID detected, likely a group chat, setting as active:", numericId);
                setActiveChatId(numericId);
                await selectConversation(numericId);
                openCompactChatView();
                return;
              }

              const newChat = await createChat(numericId, true);
              setActiveChatId(newChat.id);
              openCompactChatView();
            } else {
              // Проверяем, является ли это каналом
              const channel = channels?.find((ch) => String(ch.id) === chatIdStr);
              if (channel) {
                console.log("Found channel:", chatIdStr);
                setActiveChatId(chatIdStr);
                await selectConversation(chatIdStr);
                openCompactChatView();
              } else {
                // Если разговор не найден и это не агент и не канал, возможно это ID группового чата
                console.log("Conversation not found locally, trying to load from server:", chatIdStr);
                setActiveChatId(chatIdStr);
                await selectConversation(chatIdStr);
                openCompactChatView();
              }
            }
          }
        }
      } catch (error) {
        console.error("Failed to select chat:", error);
        setTargetMessageId(null);
        // Если чат не найден, сбрасываем activeChatId
        if (error.message && error.message.includes("not found")) {
          setActiveChatId(null);
        }
      }
    },
    [
      activeChatId,
      conversations,
      getAgent,
      createChat,
      selectConversation,
      channels,
      isMediumScreen,
      isRightPanelModal,
      openCompactChatView,
      setActiveChatId,
      setTargetMessageId,
      setIsInlineLibraryOpen,
      setIsLibraryWithSidebar,
      setIsRightPanelVisible,
      isUltraCompact,
      setIsCompactChatOpen,
      setIsMediumScreenSidebarVisible,
      systemChat,
    ]
  );

  const handleExplicitChatSwitch = useCallback(
    async (chatId) => {
      try {
        // Проверяем, не открыт ли уже этот чат
        if (activeChatId === chatId) {
          console.log(`Чат ${chatId} уже активен, пропускаем переключение`);
          return;
        }

        console.log("Explicitly switching to chat:", chatId);


        setActiveChatId(chatId);
        await selectConversation(chatId);
      } catch (error) {
        console.error("Failed to switch chat:", error);
      }
    },
    [activeChatId, selectConversation, setActiveChatId]
  );

  const handleCreateNewChat = useCallback(
    async (agentId) => {
      try {
        console.log("Creating new chat for agent:", agentId);


        const newChat = await createChat(agentId, true);
        setActiveChatId(newChat.id);
      } catch (error) {
        console.error("Failed to create new chat:", error);
      }
    },
    [createChat, setActiveChatId]
  );

  const handleDeleteChat = useCallback(
    async (chatId) => {
      try {
        console.log("Deleting chat:", chatId);


        // Убеждаемся, что chatId - строка
        const chatIdStr = String(chatId);

        // Проверяем, является ли это conversationId или agent-{id}
        if (chatIdStr.startsWith("agent-")) {
          console.log("Cannot delete agent without conversation");
          return;
        }

        const conversation = conversations.find((conv) => String(conv.id) === chatIdStr);

        if (conversation) {
          console.log("Found conversation to delete:", conversation);
        } else {
          console.log("Conversation not in local state, deleting by ID:", chatIdStr);
        }

        // Если удаляемый чат был активным, очищаем активный чат ПЕРЕД удалением,
        // чтобы избежать попыток повторного выбора удаленного чата через useChatLifecycle
        if (String(activeChatId) === chatIdStr) {
          console.log("Clearing active chat before deletion");
          setActiveChatId(null);
        }

        await deleteConversation(chatIdStr);

        console.log("Chat deletion completed successfully");
      } catch (error) {
        console.error("Failed to delete chat:", error);
      }
    },
    [activeChatId, conversations, deleteConversation, setActiveChatId]
  );

  return {
    handleChatSelect,
    handleExplicitChatSwitch,
    handleCreateNewChat,
    handleDeleteChat,
  };
}

