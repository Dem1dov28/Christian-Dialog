/**
 * Компонент индикатора загрузки чата
 */
export default function ChatLoadingIndicator({ isChatLoading, t }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--accent)]"></div>
        <p className="text-[var(--text-gray)] text-sm">
          {isChatLoading ? t("common.loadingChat") : t("common.preparingChat")}
        </p>
      </div>
    </div>
  );
}


