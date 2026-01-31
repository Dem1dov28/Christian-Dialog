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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4" style={{ paddingTop: '120px', paddingBottom: '20px' }}>
      <div 
        className="frosted-glass rounded-2xl shadow-2xl w-full max-w-lg max-h-[calc(100vh-160px)] overflow-y-auto border"
        style={{
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        {/* Header */}
        <div className="relative px-6 py-4 border-b" style={{ borderColor: "var(--border-color)" }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <MdSupportAgent className="text-white text-lg" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[var(--text-white)]">
                  {t("support.title", "Служба поддержки")}
                </h3>
                <p className="text-sm text-[var(--text-gray)]">
                  {t("support.subtitle", "Опишите ваш вопрос или проблему")}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors duration-200"
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
              <MdClose className="text-lg" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category Selection */}
            <div>
              <h4 className="text-sm font-medium text-[var(--text-white)] mb-2">
                {t("support.selectCategory", "Выберите категорию")}
              </h4>
              <p className="text-xs text-[var(--text-gray)] mb-3">
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
                      className={`flex items-start gap-3 p-3 rounded-xl transition-all duration-200 text-left w-full ${
                        selectedCategory === category.id 
                          ? "ring-2 ring-blue-500 bg-blue-500/10" 
                          : "border border-[var(--border-color)] hover:border-blue-500"
                      }`}
                      onMouseEnter={(e) => {
                        if (selectedCategory !== category.id) {
                          e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedCategory !== category.id) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <IconComponent className={`text-lg mt-0.5 ${
                        selectedCategory === category.id ? "text-blue-400" : "text-[var(--text-gray)]"
                      }`} />
                      <div>
                        <div className={`text-sm font-medium ${
                          selectedCategory === category.id ? "text-blue-300" : "text-[var(--text-white)]"
                        }`}>
                          {category.label}
                        </div>
                        <div className="text-xs text-[var(--text-gray)] mt-1">
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
              <label className="block text-sm font-medium text-[var(--text-white)]">
                {t("support.subjectLabel", "Тема обращения")}
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={t("support.subjectPlaceholder", "Кратко опишите суть вопроса")}
                className="w-full px-4 py-3 rounded-xl border transition-colors duration-200"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-white)",
                }}
                maxLength={100}
              />
            </div>

            {/* Message Field */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-[var(--text-white)]">
                {t("support.messageLabel", "Подробное описание")}
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t("support.messagePlaceholder", "Опишите подробно ваш вопрос или проблему...")}
                rows={6}
                className="w-full px-4 py-3 rounded-xl border transition-colors duration-200 resize-none"
                style={{
                  backgroundColor: "var(--bg-tertiary)",
                  borderColor: "var(--border-color)",
                  color: "var(--text-white)",
                }}
                maxLength={2000}
              />
              <div className="text-xs text-[var(--text-gray)] text-right">
                {message.length}/2000
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={!subject.trim() || !message.trim() || !selectedCategory || isSubmitting}
                className="w-full px-4 py-3 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed transition-all duration-200 rounded-xl flex items-center justify-center gap-2 shadow-lg"
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
          className="px-6 py-3 border-t text-center"
          style={{
            backgroundColor: "var(--bg-tertiary)",
            borderColor: "var(--border-color)",
          }}
        >
          <p className="text-xs text-[var(--text-gray)]">
            {t("support.responseTime", "Мы ответим в течение 24 часов")}
          </p>
        </div>
      </div>
    </div>
  );
}