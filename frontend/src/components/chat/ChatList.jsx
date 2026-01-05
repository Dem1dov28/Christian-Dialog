import React, { useRef } from "react";
import ChatItem from "./ChatItem";

const ChatList = ({
  items = [],
  onChatSelect,
  activeChatId,
  onDeleteChat,
  // ChatActions callbacks
  onAddToCollection,
  onPinToTop,
  onDeleteAgent,
  onUnsubscribeChannel,
  onHideChat,
  // Пропсы для закрепления
  pinnedChats = [],
  // Пропсы для закрепления в папках
  folderId = null,
  pinnedChatsInFolder = [],
  onPinInFolder = null,
  onUnpinFromFolder = null,
}) => {
  const containerRef = useRef(null);

  const handleChatClick = (chatId) => {
    // Всегда вызываем onChatSelect, чтобы App.jsx мог обработать мобильный режим
    // Логика предотвращения перерендеринга находится в App.jsx
    if (onChatSelect) {
      onChatSelect(chatId);
    }
  };

  const deduplicateById = (list) => {
    const seen = new Set();
    return list.filter((item) => {
      const key = String(item.id);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  };

  // Сортируем чаты: закрепленные сверху, остальные по времени
  const sortedItems = React.useMemo(() => {
    // Если есть folderId, используем закрепление в папке
    if (folderId && pinnedChatsInFolder.length >= 0) {
      // Нормализуем типы: преобразуем все ID в строки для надежного сравнения
      const normalizedPinnedChats = pinnedChatsInFolder.map(id => String(id));
      
      const pinnedInFolder = items.filter((item) => {
        const itemIdStr = String(item.id);
        return normalizedPinnedChats.includes(itemIdStr);
      });
      const unpinnedInFolder = items.filter((item) => {
        const itemIdStr = String(item.id);
        return !normalizedPinnedChats.includes(itemIdStr);
      });

      // Сортируем закрепленные в папке чаты по порядку закрепления (последний закрепленный сверху)
      const sortedPinnedInFolder = pinnedInFolder.sort((a, b) => {
        const aIdStr = String(a.id);
        const bIdStr = String(b.id);
        const indexA = normalizedPinnedChats.indexOf(aIdStr);
        const indexB = normalizedPinnedChats.indexOf(bIdStr);
        return indexA - indexB; // Меньший индекс (раньше закрепленный) идет выше
      });

      // Сортируем незакрепленные в папке чаты по времени последнего обновления
      const sortedUnpinnedInFolder = unpinnedInFolder.sort((a, b) => {
        const timeA = new Date(a.updated_at || a.created_at || 0);
        const timeB = new Date(b.updated_at || b.created_at || 0);
        return timeB - timeA;
      });

      return deduplicateById([...sortedPinnedInFolder, ...sortedUnpinnedInFolder]);
    }

    // Иначе используем глобальное закрепление (для обратной совместимости)
    const pinned = items.filter((item) =>
      pinnedChats.includes(item.id.toString())
    );
    const unpinned = items.filter(
      (item) => !pinnedChats.includes(item.id.toString())
    );

    // Сортируем закрепленные чаты по порядку закрепления (последний закрепленный сверху)
    const sortedPinned = pinned.sort((a, b) => {
      const indexA = pinnedChats.indexOf(a.id.toString());
      const indexB = pinnedChats.indexOf(b.id.toString());
      return indexA - indexB; // Меньший индекс (раньше закрепленный) идет выше
    });

    // Сортируем незакрепленные чаты по времени последнего обновления
    const sortedUnpinned = unpinned.sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at || 0);
      const timeB = new Date(b.updated_at || b.created_at || 0);
      return timeB - timeA;
    });

    return deduplicateById([...sortedPinned, ...sortedUnpinned]);
  }, [items, pinnedChats, folderId, pinnedChatsInFolder]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto overflow-x-hidden select-none chat-scrollbar"
    >
      {sortedItems.map((item) => {
        // Нормализуем сравнение ID для правильной подсветки (поддержка строк и чисел)
        const itemId = String(item.id);
        const normalizedActiveChatId = activeChatId ? String(activeChatId) : null;
        const isSelected = normalizedActiveChatId === itemId;
        
        return (
        <ChatItem
          key={item.id}
          id={item.id}
          title={item.title}
          time={item.time}
          preview={item.preview}
          colorClass={item.colorClass}
          iconName={item.iconName}
          imageSrc={item.imageSrc}
          isSelected={isSelected}
          unreadCount={item.unreadCount || 0}
          onClick={() => handleChatClick(item.id)}
          onDelete={onDeleteChat}
          hasConversation={item.hasConversation}
          agentId={item.agentId}
          conversationId={item.conversationId}
          // Новые пропсы для групповых чатов
          isGroup={item.isGroup || false}
          groupAvatar={item.groupAvatar || null}
          // Пропс для системного чата
          isSystemChat={item.isSystemChat || false}
          onAddToCollection={onAddToCollection}
          onPinToTop={onPinToTop}
          onDeleteAgent={onDeleteAgent}
          onUnsubscribeChannel={onUnsubscribeChannel}
          onHideChat={onHideChat}
          isPinned={
            folderId
              ? pinnedChatsInFolder.map(id => String(id)).includes(String(item.id))
              : pinnedChats.includes(item.id.toString())
          }
          // Пропсы для закрепления в папках
          folderId={folderId}
          onPinInFolder={onPinInFolder}
          onUnpinFromFolder={onUnpinFromFolder}
          isPinnedInFolder={
            folderId ? pinnedChatsInFolder.map(id => String(id)).includes(String(item.id)) : false
          }
          isChannel={item.is_channel || false}
          canWriteChannel={item.can_write || false}
          channelDescription={
            item.channel_description ||
            item.channelDescription ||
            ""
          }
        />
        );
      })}
    </div>
  );
};

export default ChatList;
