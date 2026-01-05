import React, { useState } from "react";
import {
  MdDownload,
  MdExpandMore,
  MdExpandLess,
  MdFileDownload,
  MdContentCopy,
} from "react-icons/md";
import { useChats } from "../../contexts/ChatsContext";
import { useAgents } from "../../contexts/AgentsContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { formatTime } from "../../utils/formatters";

export default function ExportChatSection({ activeConversationId }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState("txt");
  const { activeConversation, messages } = useChats();
  const { getAgent } = useAgents();
  const { t } = useLanguage();

  const currentAgent = activeConversation?.agent_id
    ? getAgent(activeConversation.agent_id)
    : null;

  const exportFormats = [
    { value: "txt", label: `(.txt) ${t("common.textFile")}`, icon: "" },
    { value: "md", label: "(.md) Markdown", icon: "" },
    { value: "json", label: "(.json) JSON", icon: "" },
    { value: "html", label: "(.html) HTML", icon: "🌐" },
  ];

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("ru-RU", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };


  /**
   * Декодирует HTML entities и удаляет reply-блоки, сохраняя HTML-теги как текст
   * Это позволяет экспортировать текст с тегами (например, &lt;div&gt;test&lt;/div&gt; → <div>test</div>) как обычный текст
   * 
   * ВАЖНО: Работаем ТОЛЬКО со строкой через regex, НЕ используем DOM для удаления тегов.
   */
  const getCleanText = (content) => {
    if (!content || typeof content !== "string") return "";

    // Шаг 1: Удаляем reply-блоки через regex (работаем со строкой, не интерпретируем HTML)
    let cleaned = content
      .replace(
        /<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi,
        ""
      )
      .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, "")
      .replace(/<div[^>]*class="[^"]*reply-block[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "")
      .replace(/<div[^>]*data-reply-to-id="[^"]*"[^>]*>[\s\S]*?<\/div>/gi, "");
    
    // Удаляем оставшиеся закрывающие теги в начале
    cleaned = cleaned.trim().replace(/^<\/div>\s*/i, "");
    cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*/i, "");
    cleaned = cleaned.trim().replace(/^<\/div>\s*<\/div>\s*<\/div>\s*/i, "");
    
    // Шаг 2: Декодируем HTML entities ТОЛЬКО через regex (НЕ используем DOM для удаления тегов)
    // Важно: порядок имеет значение - сначала &amp;, чтобы не конфликтовало
    const decoded = cleaned
      .replace(/&amp;/g, "&")    // Декодируем &amp; в & (сначала!)
      .replace(/&lt;/g, "<")      // Декодируем &lt; в <
      .replace(/&gt;/g, ">")      // Декодируем &gt; в >
      .replace(/&quot;/g, '"')    // Декодируем &quot; в "
      .replace(/&#039;/g, "'")    // Декодируем &#039; в '
      .replace(/&#x27;/g, "'");   // Декодируем &#x27; в '
    
    return decoded.trim();
  };

  /**
   * Экранирует HTML-символы для безопасной вставки в HTML
   * Используется только в HTML-экспорте, чтобы показать теги как текст
   */
  const escapeHtml = (text) => {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  };

  const generateExportContent = () => {
    if (!messages || messages.length === 0) return "";

    const chatTitle = currentAgent
      ? `${currentAgent.name} - ${formatDate(activeConversation.created_at)}`
      : t("common.chat");

    switch (exportFormat) {
      case "md":
        return generateMarkdownContent(chatTitle);
      case "json":
        return generateJSONContent();
      case "html":
        return generateHTMLContent(chatTitle);
      default:
        return generateTextContent(chatTitle);
    }
  };

  const generateTextContent = (title) => {
    let content = `${title}\n`;
    content += `${"=".repeat(title.length)}\n\n`;

    messages.forEach((message, index) => {
      const sender = message.is_from_user
        ? t("common.user")
        : currentAgent?.name || t("common.agent");
      const time = formatTime(message.created_at);
      const cleanContent = getCleanText(message.content);

      content += `[${time}] ${sender}:\n`;
      content += `${cleanContent}\n\n`;
    });

    return content;
  };

  const generateMarkdownContent = (title) => {
    let content = `# ${title}\n\n`;
    content += `**${t("export.createdAt")}:** ${formatDate(
      activeConversation.created_at
    )}\n`;
    content += `**${t("common.agent")}:** ${currentAgent?.name || t("common.unknown")}\n`;
    content += `**${t("common.messageCount")}:** ${messages.length}\n\n`;
    content += `---\n\n`;

    messages.forEach((message, index) => {
      const sender = message.is_from_user
        ? t("common.user")
        : currentAgent?.name || t("common.agent");
      const time = formatTime(message.created_at);
      const cleanContent = getCleanText(message.content);

      content += `## ${sender} - ${time}\n\n`;
      content += `${cleanContent}\n\n`;
    });

    return content;
  };

  const generateJSONContent = () => {
    const exportData = {
      conversation: {
        id: activeConversation.id,
        created_at: activeConversation.created_at,
        updated_at: activeConversation.updated_at,
        agent: currentAgent
          ? {
              id: currentAgent.id,
              name: currentAgent.name,
              description: currentAgent.description,
            }
          : null,
      },
      messages: messages.map((message) => ({
        id: message.id,
        content: getCleanText(message.content),
        is_from_user: message.is_from_user,
        created_at: message.created_at,
      })),
      export_info: {
        exported_at: new Date().toISOString(),
        total_messages: messages.length,
        format: "json",
      },
    };

    return JSON.stringify(exportData, null, 2);
  };

  const generateHTMLContent = (title) => {
    let content = `<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
        .message { margin-bottom: 15px; padding: 10px; border-radius: 8px; }
        .user { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .agent { background: #f3e5f5; border-left: 4px solid #9c27b0; }
        .time { font-size: 0.8em; color: #666; margin-bottom: 5px; }
        .sender { font-weight: bold; margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <p><strong>${t("export.createdAt")}:</strong> ${formatDate(
              activeConversation.created_at
            )}</p>
            <p><strong>${t("common.agent")}:</strong> ${currentAgent?.name || t("common.unknown")}</p>
            <p><strong>${t("common.messageCount")}:</strong> ${messages.length}</p>
        </div>`;

    messages.forEach((message) => {
      const sender = message.is_from_user
        ? t("common.user")
        : currentAgent?.name || t("common.agent");
      const time = formatTime(message.created_at);
      const messageClass = message.is_from_user ? "user" : "agent";
      const cleanContent = getCleanText(message.content);

      // Для HTML-экспорта экранируем HTML-символы, чтобы теги отображались как текст
      const safeContent = escapeHtml(cleanContent).replace(/\n/g, "<br>");
      
      content += `
        <div class="message ${messageClass}">
            <div class="time">${time}</div>
            <div class="sender">${sender}</div>
            <div>${safeContent}</div>
        </div>`;
    });

    content += `
    </div>
</body>
</html>`;

    return content;
  };

  const handleExport = async () => {
    if (!messages || messages.length === 0) return;

    setIsExporting(true);

    try {
      const content = generateExportContent();
      const blob = new Blob([content], {
        type:
          exportFormat === "json"
            ? "application/json"
            : exportFormat === "html"
            ? "text/html"
            : "text/plain",
      });

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;

      const timestamp = new Date()
        .toISOString()
        .slice(0, 19)
        .replace(/:/g, "-");
      const agentName = currentAgent?.name || "chat";
      link.download = `${agentName}_${timestamp}.${exportFormat}`;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    if (!messages || messages.length === 0) return;

    try {
      const content = generateExportContent();
      await navigator.clipboard.writeText(content);
      // Здесь можно добавить уведомление об успешном копировании
    } catch (error) {
      console.error("Copy error:", error);
    }
  };

  if (!activeConversationId || !messages || messages.length === 0) return null;

  return (
    <div className="border-b border-[var(--border-color)]">
      <div
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-[var(--hover-bg)] transition-colors duration-200"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <MdDownload className="text-[var(--accent)] text-lg" />
          <span className="font-medium text-[var(--text-white)] select-none">{t("chat.exportChat")}</span>
          <span className="bg-[var(--accent)] text-white text-xs px-2 py-1 rounded-full select-none">
            {messages.length}
          </span>
        </div>
        {isExpanded ? (
          <MdExpandLess className="text-[var(--text-gray)]" />
          ) : (
          <MdExpandMore className="text-[var(--text-gray)]" />
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 space-y-4">
          {/* Выбор формата */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
              {t("export.format")}
            </label>
            <div className="grid grid-cols-2 gap-2">
              {exportFormats.map((format) => (
                <button
                  key={format.value}
                  onClick={() => setExportFormat(format.value)}
                  className={`p-3 rounded-lg border transition-colors duration-200 text-left w-full overflow-hidden ${
                    exportFormat === format.value
                      ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent)]"
                      : "border-[var(--border-color)] bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] text-[var(--text-white)]"
                  }`}
                >
                  <div className="flex items-center space-x-2 min-w-0">
                    <span className="text-lg flex-shrink-0">{format.icon}</span>
                    <span className="text-sm truncate">{format.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Предварительный просмотр */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
              {t("export.preview")}
            </label>
            <div className="bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-color)]/50 max-h-32 overflow-y-auto">
              <pre className="text-xs text-[var(--text-white)] whitespace-pre-wrap">
                {generateExportContent().substring(0, 200)}
                {generateExportContent().length > 200 && "..."}
              </pre>
            </div>
          </div>

          {/* Кнопки действий */}
          <div className="flex space-x-2">
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex-1 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white px-4 py-2 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              {isExporting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <MdFileDownload className="text-lg" />
              )}
              <span>{t("export.download")}</span>
            </button>

            <button
              onClick={handleCopyToClipboard}
              className="bg-[var(--bg-secondary)] hover:bg-[var(--hover-bg)] text-[var(--text-white)] px-4 py-2 rounded-lg border border-[var(--border-color)] transition-colors duration-200 flex items-center justify-center"
            >
              <MdContentCopy className="text-lg" />
            </button>
          </div>

          {/* Информация о файле */}
          <div className="bg-[var(--bg-secondary)]/50 rounded-lg p-3 border border-[var(--border-color)]/50">
            <div className="text-xs text-[var(--text-gray)] space-y-1">
              <div>
                {t("export.size")}: ~{Math.round(generateExportContent().length / 1024)} KB
              </div>
              <div>{t("export.messages")}: {messages.length}</div>
              <div>
                {t("export.format")}:{" "}
                {exportFormats.find((f) => f.value === exportFormat)?.label}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
