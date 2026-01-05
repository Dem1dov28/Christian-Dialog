import React, { useState, useMemo, useCallback } from "react";
import { MdMenu } from "react-icons/md";
import SidebarItem from "../sidebar/SidebarItem";
import FolderContextMenu from "./FolderContextMenu";
import { useLanguage } from "../../contexts/LanguageContext";

const NavigationIcons = ({ 
  items = [], 
  folders = [], 
  activeId, 
  onMenuClick, 
  onFolderChange, 
  onSettingsClick, 
  onReorderItems,
  // Новые пропсы для обработчиков действий
  onFolderHide,
  onFolderDelete,
  onFolderEdit,
  onMarkAsRead,
  // Данные для работы с папками
  allFolders = [],
  conversations = [],
  agents = [],
}) => {
  const { t } = useLanguage();
  const initialActiveId = useMemo(() => {
    // Поддерживаем как строковые, так и числовые ID (для пользовательских папок)
    if (activeId !== null && activeId !== undefined) return activeId;
    const preselected = items.find((it) => it.active);
    return preselected?.id || items[0]?.id || null;
  }, [activeId, items]);

  const [currentId, setCurrentId] = useState(initialActiveId);
  const [draggedItem, setDraggedItem] = useState(null);
  const [dragOverItem, setDragOverItem] = useState(null);
  const [contextMenu, setContextMenu] = useState({
    isOpen: false,
    folderId: null,
    mousePosition: null,
  });

  // Синхронизируем локальное состояние с переданным activeId
  // Поддерживаем как строковые, так и числовые ID (для пользовательских папок)
  React.useEffect(() => {
    // Сравниваем с учетом типа данных
    const isEqual = currentId === activeId || String(currentId) === String(activeId);
    if (activeId !== null && activeId !== undefined && !isEqual) {
      setCurrentId(activeId);
    }
  }, [activeId, currentId]);

  // Обработчики drag & drop
  const handleDragStart = useCallback((e, item) => {
    console.log('Drag start:', item);
    setDraggedItem(item);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', e.target.outerHTML);
    e.target.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e) => {
    e.target.style.opacity = '';
    setDraggedItem(null);
    setDragOverItem(null);
  }, []);

  const handleDragOver = useCallback((e, item) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(item);
  }, []);

  const handleDragLeave = useCallback((e) => {
    // Проверяем, что мы действительно покидаем элемент
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverItem(null);
    }
  }, []);

  const handleDrop = useCallback((e, targetItem) => {
    e.preventDefault();
    console.log('Drop event:', { draggedItem, targetItem, onReorderItems });
    
    // Проверяем, что перетаскиваемые элементы существуют
    if (draggedItem && targetItem && 
        draggedItem.id !== targetItem.id && 
        onReorderItems) {
      
      // Находим индексы в общем массиве items
      const draggedIndex = items.findIndex(item => item && item.id === draggedItem.id);
      const targetIndex = items.findIndex(item => item && item.id === targetItem.id);
      
      console.log('Reordering:', { draggedIndex, targetIndex });
      
      if (draggedIndex !== -1 && targetIndex !== -1) {
        onReorderItems(draggedIndex, targetIndex);
      }
    }
    
    setDraggedItem(null);
    setDragOverItem(null);
  }, [draggedItem, items, onReorderItems]);

  // Обработчик контекстного меню
  const handleContextMenu = useCallback((event, folderId) => {
    event.preventDefault();
    event.stopPropagation();

    setContextMenu({
      isOpen: true,
      folderId,
      mousePosition: {
        x: event.clientX,
        y: event.clientY,
      },
    });
  }, []);

  // Закрытие контекстного меню
  const handleMenuExited = useCallback(() => {
    setContextMenu({
      isOpen: false,
      folderId: null,
      mousePosition: null,
    });
  }, []);

  // Определение системных папок
  const systemFolderIds = useMemo(() => ["characters", "agents", "models", "channels"], []);
  const isSystemFolder = useCallback((folderId) => {
    return systemFolderIds.includes(String(folderId));
  }, [systemFolderIds]);

  // Функция для получения типа системной папки по ID
  const getSystemFolderTypeById = useCallback((folderId) => {
    if (systemFolderIds.includes(String(folderId))) {
      return String(folderId);
    }
    return null;
  }, [systemFolderIds]);

  // Обработчик скрытия системной папки
  const handleHideFolder = useCallback((folderId) => {
    if (typeof onFolderHide === "function") {
      onFolderHide(folderId);
    }
  }, [onFolderHide]);

  // Обработчик удаления пользовательской папки
  const handleDeleteFolder = useCallback((folderId) => {
    if (typeof onFolderDelete === "function") {
      onFolderDelete(folderId);
    }
  }, [onFolderDelete]);

  // Обработчик редактирования папки (только для пользовательских папок)
  const handleConfigureFolder = useCallback((folderId) => {
    // Редактирование доступно только для пользовательских папок (числовые ID)
    if (isSystemFolder(folderId)) {
      console.warn("Cannot edit system folder:", folderId);
      return;
    }
    if (typeof onFolderEdit === "function") {
      onFolderEdit(folderId);
    }
  }, [onFolderEdit, isSystemFolder]);

  // Обработчик пометки всех чатов в папке как прочитанных
  const handleMarkAsRead = useCallback((folderId) => {
    if (typeof onMarkAsRead === "function") {
      onMarkAsRead(folderId);
    }
  }, [onMarkAsRead]);

  return (
    <div className="w-[80px] bg-[var(--bg-primary)] flex flex-col items-center py-4 space-y-4 border-r border-[var(--border-color)] select-none">
      <button 
        className="p-2 rounded-lg text-[var(--text-gray)] hover:bg-[var(--hover-bg)] transition-colors"
        onClick={onMenuClick}
      >
        <MdMenu className="text-3xl" />
      </button>

      <nav className="flex flex-col items-center space-y-2 flex-grow w-full overflow-y-auto overflow-x-hidden chat-scrollbar">
        {items.map((item) => {
          const { id, label, icon: IconComponent, unread, unreadCount, active, accent, disabled, draggable = true } = item;
          // Сравниваем ID с учетом типа данных (для поддержки как строковых, так и числовых ID)
          const isActive = currentId === id || String(currentId) === String(id);
          const isDragging = draggedItem?.id === id || (draggedItem?.id && String(draggedItem.id) === String(id));
          const isDragOver = dragOverItem?.id === id || (dragOverItem?.id && String(dragOverItem.id) === String(id));
          
          return (
            <div
              key={id}
              draggable={draggable && !disabled}
              onDragStart={(e) => handleDragStart(e, item)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => handleDragOver(e, item)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, item)}
              className={`transition-all duration-200 ${
                isDragging ? 'opacity-50 scale-95 cursor-move' : ''
              } ${
                isDragOver ? 'scale-105 ring-2 ring-purple-400' : ''
              } ${
                draggable && !disabled ? 'cursor-move' : ''
              }`}
              style={{
                cursor: draggable && !disabled ? 'move' : 'default'
              }}
            >
              <SidebarItem
                id={id}
                label={label}
                icon={IconComponent}
                active={isActive}
                disabled={!!disabled}
                unreadCount={typeof unreadCount === "number" ? unreadCount : unread}
                accent={!!accent}
                isDragging={isDragging}
                isDragOver={isDragOver}
                onClick={() => {
                  if (!disabled) {
                    setCurrentId(id);
                    if (onFolderChange) {
                      onFolderChange(id);
                    }
                  }
                }}
                onContextMenu={(event, itemId) => handleContextMenu(event, itemId)}
              />
            </div>
          );
        })}
      </nav>

      {contextMenu.isOpen && (
        <FolderContextMenu
          isOpen={contextMenu.isOpen}
          closeOnOutside={true}
          mousePosition={contextMenu.mousePosition}
          folderId={contextMenu.folderId}
          isSystemFolder={isSystemFolder(contextMenu.folderId)}
          onConfigureFolder={handleConfigureFolder}
          onDeleteFolder={handleDeleteFolder}
          onHideFolder={handleHideFolder}
          onMarkAsRead={handleMarkAsRead}
          onExited={handleMenuExited}
        />
      )}
    </div>
  );
};

export default NavigationIcons;