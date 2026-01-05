import React from "react";
import { MdFlashOn, MdRefresh, MdContentCopy } from "react-icons/md";

export default function QuickActionsSection({ activeConversationId }) {
  const handleQuickAction = (action) => {
    console.log(
      `Quick action: ${action} for conversation ${activeConversationId}`
    );
    // Здесь можно добавить логику для быстрых действий
  };

  return (
    <div className="border-b border-tg-border">
      <div className="p-4">
        <h4 className="text-sm font-medium text-[var(--text-gray)] mb-3">
          Быстрые действия
        </h4>
        <div className="space-y-2">
          <button
            onClick={() => handleQuickAction("regenerate")}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-tg-bg text-left transition-colors"
          >
            <MdRefresh className="text-lg text-[var(--text-gray)]" />
            <span className="text-sm">Перегенерировать ответ</span>
          </button>

          <button
            onClick={() => handleQuickAction("copy")}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-tg-bg text-left transition-colors"
          >
            <MdContentCopy className="text-lg text-[var(--text-gray)]" />
            <span className="text-sm">Копировать чат</span>
          </button>

          <button
            onClick={() => handleQuickAction("summarize")}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-tg-bg text-left transition-colors"
          >
            <MdFlashOn className="text-lg text-[var(--text-gray)]" />
            <span className="text-sm">Суммировать чат</span>
          </button>
        </div>
      </div>
    </div>
  );
}
