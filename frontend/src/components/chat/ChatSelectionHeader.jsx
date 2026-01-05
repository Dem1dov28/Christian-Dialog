import React from "react";
import PropTypes from "prop-types";

/**
 * Компонент заголовка в режиме выделения сообщений
 * Отображается когда выбраны сообщения для массовых действий
 */
function ChatSelectionHeader({
  selectedCount,
  onBulkCopy,
  onBulkDelete,
  onClearSelection,
  t,
}) {
  if (selectedCount === 0) {
    return null;
  }

  return (
    <header className="flex items-center justify-between p-3 bg-[var(--header-bg)] border-b border-[var(--border-color)] select-none">
      <div className="flex items-center gap-2">
        <button
          onClick={onBulkCopy}
          title={t("chat.copySelected", { defaultValue: "Копировать выбранные" })}
          className="group inline-flex items-center px-4 py-1.5 rounded-md bg-[var(--accent)] text-white tracking-wide shadow-sm transition-all duration-200 hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98]"
        >
          {t("chat.copy", { defaultValue: "КОПИРОВАТЬ" })}
        </button>
        <button
          onClick={onBulkDelete}
          title={t("chat.deleteSelected", { defaultValue: "Удалить выбранные" })}
          className="group inline-flex items-center px-4 py-1.5 rounded-md bg-[var(--accent)] text-white tracking-wide shadow-sm transition-all duration-200 hover:bg-[var(--accent-hover)] hover:shadow-md active:scale-[0.98]"
        >
          {t("chat.delete", { defaultValue: "УДАЛИТЬ" })}
        </button>
      </div>

      <button
        onClick={onClearSelection}
        title={t("chat.cancel", { defaultValue: "Отмена" })}
        className="px-3 py-1.5 rounded-md text-[var(--accent)] hover:bg-[var(--button-hover-bg)] transition-colors duration-200"
      >
        {t("chat.cancel", { defaultValue: "ОТМЕНА" })}
      </button>
    </header>
  );
}

ChatSelectionHeader.propTypes = {
  selectedCount: PropTypes.number.isRequired,
  onBulkCopy: PropTypes.func.isRequired,
  onBulkDelete: PropTypes.func.isRequired,
  onClearSelection: PropTypes.func.isRequired,
  t: PropTypes.func.isRequired,
};

export default ChatSelectionHeader;



