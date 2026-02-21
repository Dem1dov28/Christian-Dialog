/**
 * Компонент приветственного сообщения (когда чат не выбран)
 */
export default function ChatWelcomeMessage({ t }) {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <h2
          className="text-2xl font-medium text-[var(--text-white)] mb-2"
          style={{ fontFamily: "'Montserrat', 'Roboto', sans-serif" }}
        >
          {t("chat.selectChat")}
        </h2>
        <p
          className="text-[var(--text-gray)]"
          style={{ fontFamily: "'Montserrat', 'Roboto', sans-serif" }}
        >
          {t("chat.startNewConversation")}
        </p>
      </div>
    </div>
  );
}


