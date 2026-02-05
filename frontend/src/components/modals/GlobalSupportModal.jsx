import React, { useState, useMemo } from "react";
import { MdClose, MdSend, MdSupportAgent, MdEmail, MdSubject } from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";
import { useModal } from "../../contexts/ModalContext";
import { useNotification } from "../../contexts/NotificationContext";
import apiClient from "../../services/api";

export default function GlobalSupportModal() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { t } = useLanguage();
  const { isSupportModalOpen, closeSupportModal } = useModal();
  const { showSuccess, showError } = useNotification();

  const SUPPORT_CATEGORIES = useMemo(() => [
    {
      id: "technical_issue",
      label: t("support.categories.technical.label", "Техническая проблема"),
      icon: MdSupportAgent,
      description: t("support.categories.technical.description", "Проблемы с работой приложения, ошибки, баги"),
    },
    {
      id: "account_issue",
      label: t("support.categories.account.label", "Проблемы с аккаунтом"),
      icon: MdEmail,
      description: t("support.categories.account.description", "Вход, регистрация, восстановление доступа"),
    },
    {
      id: "feature_request",
      label: t("support.categories.feature.label", "Предложение функции"),
      icon: MdSubject,
      description: t("support.categories.feature.description", "Идеи по улучшению приложения"),
    },
    {
      id: "billing",
      label: t("support.categories.billing.label", "Оплата и подписка"),
      icon: MdSubject,
      description: t("support.categories.billing.description", "Вопросы по оплате, подписке, тарифам"),
    },
    {
      id: "other",
      label: t("support.categories.other.label", "Другое"),
      icon: MdSubject,
      description: t("support.categories.other.description", "Любые другие вопросы"),
    },
  ], [t]);

  const [selectedCategory, setSelectedCategory] = useState("");

  if (!isSupportModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim() || !selectedCategory) return;

    setIsSubmitting(true);
    try {
      // Отправляем запрос в поддержку через API
      await apiClient.post("/api/support", {
        subject: subject.trim(),
        message: message.trim(),
        category: selectedCategory,
      });

      // Показываем уведомление об успехе
      showSuccess(t("support.requestSent", "Запрос отправлен в службу поддержки"));

      // Очищаем форму и закрываем модалку
      setSubject("");
      setMessage("");
      setSelectedCategory("");
      closeSupportModal();
    } catch (error) {
      console.error("Error submitting support request:", error);
      showError(t("support.requestError", "Не удалось отправить запрос"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setSubject("");
    setMessage("");
    setSelectedCategory("");
    closeSupportModal();
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100] p-4"
      style={{
        paddingTop: '120px',
        paddingBottom: '20px',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-160px)] overflow-y-auto"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.1)",
        }}
      >
        {/* Header */}
        <div
          className="relative px-6 py-5 border-b"
          style={{
            borderColor: "var(--border-color)",
            background: "linear-gradient(to bottom, var(--bg-primary), var(--bg-secondary))",
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg"
                style={{
                  boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)",
                }}
              >
                <MdSupportAgent className="text-white text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-white)" }}>
                  {t("support.title", "Служба поддержки")}
                </h3>
                <p className="text-sm" style={{ color: "var(--text-gray)" }}>
                  {t("support.subtitle", "Опишите ваш вопрос или проблему")}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{
                color: "var(--text-gray)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                e.currentTarget.style.color = "var(--text-white)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--text-gray)";
              }}
            >
              <MdClose className="text-xl" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Category Selection */}
            <div>
              <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text-white)" }}>
                {t("support.selectCategory", "Выберите категорию")}
              </h4>
              <p className="text-xs mb-3" style={{ color: "var(--text-gray)" }}>
                {t("support.categoryHelp", "Это поможет нам быстрее обработать ваш запрос")}
              </p>

              <div className="grid grid-cols-1 gap-2">
                {SUPPORT_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => handleCategorySelect(category.id)}
                      className="flex items-start gap-3 p-3 rounded-xl transition-all duration-200 text-left w-full"
                      style={{
                        border: selectedCategory === category.id ? "2px solid #3b82f6" : "1px solid var(--border-color)",
                        backgroundColor: selectedCategory === category.id ? "rgba(59, 130, 246, 0.1)" : "var(--bg-secondary)",
                        boxShadow: selectedCategory === category.id ? "0 2px 8px rgba(59, 130, 246, 0.2)" : "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                      onMouseEnter={(e) => {
                        if (selectedCategory !== category.id) {
                          e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                          e.currentTarget.style.borderColor = "#3b82f6";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCategory !== category.id) {
                          e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                          e.currentTarget.style.borderColor = "var(--border-color)";
                        }
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          backgroundColor: selectedCategory === category.id ? "rgba(59, 130, 246, 0.2)" : "rgba(59, 130, 246, 0.1)",
                          color: selectedCategory === category.id ? "#2563eb" : "#3b82f6",
                        }}
                      >
                        <IconComponent className="text-lg" />
                      </div>
                      <div className="flex-1">
                        <div
                          className="text-sm font-medium"
                          style={{
                            color: selectedCategory === category.id ? "#2563eb" : "var(--text-white)",
                          }}
                        >
                          {category.label}
                        </div>
                        <div className="text-xs mt-1" style={{ color: "var(--text-gray)" }}>
                          {category.description}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Subject Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{ color: "var(--text-white)" }}>
                {t("support.subjectLabel", "Тема обращения")}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("support.subjectPlaceholder", "Кратко опишите суть вопроса")}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 focus:outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "2px solid var(--border-color)",
                  color: "var(--text-white)",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                }}
                maxLength={100}
              />
            </div>

            {/* Message Field */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold" style={{ color: "var(--text-white)" }}>
                {t("support.messageLabel", "Подробное описание")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("support.messagePlaceholder", "Опишите подробно ваш вопрос или проблему...")}
                rows={6}
                className="w-full px-4 py-3 rounded-xl text-sm transition-all duration-200 resize-none focus:outline-none"
                style={{
                  backgroundColor: "var(--bg-secondary)",
                  border: "2px solid var(--border-color)",
                  color: "var(--text-white)",
                  boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "#3b82f6";
                  e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59, 130, 246, 0.1)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "var(--border-color)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                }}
                maxLength={2000}
              />
              <div className="text-xs text-right" style={{ color: "var(--text-gray)" }}>
                <span className="font-medium">{message.length}/2000</span>
              </div>
            </div>

            {/* VPN Information Block */}
            <div
              className="p-3 rounded-xl"
              style={{
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
              }}
            >
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-gray)" }}>
                ℹ️ {t("support.vpnInfo", "Если вы используете VPN или ваше сообщение не было отправлено пишите прямо на почту")} <a href="mailto:support@sentiensapps.online" className="font-medium" style={{ color: "#3b82f6" }}>support@sentiensapps.online</a>
              </p>
            </div>
            
            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!subject.trim() || !message.trim() || !selectedCategory || isSubmitting}
                className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 rounded-xl flex items-center justify-center gap-2"
                style={{
                  boxShadow: (!subject.trim() || !message.trim() || !selectedCategory || isSubmitting) ? "none" : "0 4px 12px rgba(59, 130, 246, 0.3)",
                }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{t("support.sending", "Отправка...")}</span>
                  </>
                ) : (
                  <>
                    <MdSend className="text-lg" />
                    <span>{t("support.send", "Отправить в поддержку")}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t text-center"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <p className="text-xs" style={{ color: "var(--text-gray)" }}>
            ⏱️ {t("support.responseTime", "Мы ответим в течение 24 часов")}
          </p>
        </div>
      </div>
    </div>
  );
}