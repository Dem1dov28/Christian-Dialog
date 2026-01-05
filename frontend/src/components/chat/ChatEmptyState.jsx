/**
 * Компонент пустого состояния чата
 */
export default function ChatEmptyState({ emptyStatePrompt, language }) {
  return (
    <div className="flex h-full items-center justify-center px-4 py-6">
      <div className="text-center text-balance max-w-md">
        <p
          className="text-lg sm:text-xl font-semibold text-[var(--text-white)] leading-relaxed"
          style={{ fontFamily: "'Montserrat', 'Comfortaa', 'Roboto', sans-serif" }}
        >
          {emptyStatePrompt ||
            (language === "ru"
              ? "Начните новый диалог — чат ждёт ваше сообщение."
              : "Start a new dialogue—the chat is waiting for your message.")}
        </p>
      </div>
    </div>
  );
}


