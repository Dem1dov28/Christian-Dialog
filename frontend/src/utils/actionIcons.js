/**
 * Централизованная система иконок для действий
 * Использует Material Design Icons для единообразия и минималистичного стиля
 */
import {
  // Основные действия
  MdDelete,
  MdEdit,
  MdAdd,
  MdClose,
  MdSend,
  MdAttachFile,
  MdSearch,
  MdMoreVert,
  MdMenu,
  MdArrowBack,
  MdStop,
  MdPlayArrow,
  
  // Действия с сообщениями и чатами
  MdReply,
  MdContentCopy,
  MdPushPin,
  MdBookmark,
  MdBookmarkBorder,
  
  // Действия с папками и коллекциями
  MdFolder,
  MdFolderOpen,
  MdCreateNewFolder,
  
  // Настройки и видимость
  MdSettings,
  MdVisibility,
  MdVisibilityOff,
  MdCheck,
  MdCancel,
  MdTune,
  
  // Дополнительные действия
  MdMenuBook,
  MdRefresh,
  MdCheckCircle,
  MdFilterList,
  MdArrowDropDown,
  MdArrowDownward,
} from "react-icons/md";

/**
 * Централизованная карта иконок для действий
 * Все иконки используют Material Design для единообразия
 */
export const ActionIcons = {
  // Основные действия
  delete: MdDelete,
  edit: MdEdit,
  add: MdAdd,
  close: MdClose,
  send: MdSend,
  attach: MdAttachFile,
  search: MdSearch,
  more: MdMoreVert,
  menu: MdMenu,
  back: MdArrowBack,
  stop: MdStop,
  play: MdPlayArrow,
  
  // Действия с сообщениями
  reply: MdReply,
  copy: MdContentCopy,
  pin: MdPushPin,
  bookmark: MdBookmark,
  bookmarkBorder: MdBookmarkBorder,
  save: MdBookmark, // Сохранение использует ту же иконку что и bookmark
  
  // Действия с папками
  folder: MdFolder,
  folderOpen: MdFolderOpen,
  folderAdd: MdAdd, // Используем MdAdd для добавления в папку
  folderCreate: MdCreateNewFolder,
  addToFolder: MdAdd, // Используем MdAdd для добавления в папку
  
  // Настройки
  settings: MdSettings,
  configure: MdSettings,
  tune: MdTune,
  
  // Видимость
  hide: MdVisibilityOff,
  show: MdVisibility,
  
  // Подтверждение и отмена
  check: MdCheck,
  cancel: MdCancel,
  confirm: MdCheck,
  
  // Дополнительные
  menuBook: MdMenuBook,
  refresh: MdRefresh,
  checkCircle: MdCheckCircle,
  filter: MdFilterList,
  arrowDown: MdArrowDropDown,
  arrowDownward: MdArrowDownward,
};

/**
 * Получить компонент иконки по ключу действия
 * @param {string} actionKey - Ключ действия (например, 'delete', 'edit', 'add')
 * @returns {React.Component} - React компонент иконки
 */
export function getActionIcon(actionKey) {
  return ActionIcons[actionKey] || MdMoreVert; // По умолчанию "еще"
}

/**
 * Экспорт всех иконок для прямого использования
 */
export default ActionIcons;

