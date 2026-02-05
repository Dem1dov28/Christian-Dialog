import React, { useState, useMemo } from "react";
import {
  MdClose,
  MdSend,
  MdReport,
  MdWarning,
  MdBlock,
  MdDescription,
  MdPersonOff,
  MdSecurity,
} from "react-icons/md";
import { useLanguage } from "../../contexts/LanguageContext";

export default function ReportModalNew({ isOpen, onClose, onSubmit }) {
  const { t } = useLanguage();
  const [reportText, setReportText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: выбор категории, 2: описание

  const REPORT_CATEGORIES = useMemo(() => [
    {
      id: "inappropriate_content",
      label: t("report.categories.inappropriate.label", "Неприемлемый контент"),
      icon: MdWarning,
      description: t("report.categories.inappropriate.description", "Контент, нарушающий правила платформы"),
    },
    {
      id: "incorrect_responses",
      label: t("report.categories.inaccurate.label", "Неточные ответы"),
      icon: MdDescription,
      description: t("report.categories.inaccurate.description", "Неточная или вводящая в заблуждение информация"),
    },
    {
      id: "technical_issues",
      label: t("report.categories.technical.label", "Технические проблемы"),
      icon: MdBlock,
      description: t("report.categories.technical.description", "Проблемы с работой приложения, ошибки, баги"),
    },
    {
      id: "inappropriate_behavior",
      label: t("report.categories.behavior.label", "Неприемлемое поведение"),
      icon: MdPersonOff,
      description: t("report.categories.behavior.description", "Агент ведет себя неприемлемо"),
    },
    {
      id: "privacy_concerns",
      label: t("report.categories.privacy.label", "Проблемы с конфиденциальностью"),
      icon: MdSecurity,
      description: t("report.categories.privacy.description", "Проблемы с конфиденциальностью данных"),
    },
    {
      id: "other",
      label: t("report.categories.other.label", "Другое"),
      icon: MdReport,
      description: t("report.categories.other.description", "Любые другие вопросы"),
    },
  ], [t]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reportText.trim() || !selectedCategory) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        category: selectedCategory,
        description: reportText.trim(),
      });
      setReportText("");
      setSelectedCategory("");
      setStep(1);
      onClose();
    } catch (error) {
      console.error("Error submitting report:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setReportText("");
    setSelectedCategory("");
    setStep(1);
    onClose();
  };

  const handleCategorySelect = (categoryId) => {
    setSelectedCategory(categoryId);
    setStep(2);
  };

  const handleBack = () => {
    setStep(1);
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
                className="w-11 h-11 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg"
                style={{
                  boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)",
                }}
              >
                <MdReport className="text-white text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: "var(--text-white)" }}>
                  {t("report.title", "Сообщить о проблеме")}
                </h3>
                <p className="text-sm" style={{ color: "var(--text-gray)" }}>
                  {t("report.subtitle", "Помогите нам улучшить платформу")}
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
          {step === 1 ? (
            // Step 1: Category Selection
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-2" style={{ color: "var(--text-white)" }}>
                  {t("report.selectCategory", "Выберите тип проблемы")}
                </h4>
                <p className="text-xs mb-4" style={{ color: "var(--text-gray)" }}>
                  {t("report.categoryHelp", "Это поможет нам быстрее обработать вашу жалобу")}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {REPORT_CATEGORIES.map((category) => {
                  const IconComponent = category.icon;
                  return (
                    <button
                      key={category.id}
                      onClick={() => handleCategorySelect(category.id)}
                      className="flex items-start gap-4 p-4 rounded-xl transition-all duration-200 group"
                      style={{
                        border: "1px solid var(--border-color)",
                        backgroundColor: "var(--bg-secondary)",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "#ef4444";
                        e.currentTarget.style.backgroundColor = "var(--bg-tertiary)";
                        e.currentTarget.style.boxShadow = "0 4px 12px rgba(239, 68, 68, 0.15)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border-color)";
                        e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-200"
                        style={{
                          backgroundColor: "rgba(239, 68, 68, 0.1)",
                          color: "#ef4444",
                        }}
                      >
                        <IconComponent className="text-xl" />
                      </div>
                      <div className="flex-1 text-left">
                        <h5 className="text-sm font-semibold mb-1" style={{ color: "var(--text-white)" }}>
                          {category.label}
                        </h5>
                        <p className="text-xs leading-relaxed" style={{ color: "var(--text-gray)" }}>
                          {category.description}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            // Step 2: Description
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="flex items-center gap-3 mb-4">
                <button
                  type="button"
                  onClick={handleBack}
                  className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
                  style={{
                    color: "var(--text-gray)",
                    backgroundColor: "var(--bg-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                    e.currentTarget.style.color = "var(--text-white)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                    e.currentTarget.style.color = "var(--text-gray)";
                  }}
                >
                  <MdClose className="text-xl rotate-45" />
                </button>
                <div>
                  <h4 className="text-sm font-semibold" style={{ color: "var(--text-white)" }}>
                    {
                      REPORT_CATEGORIES.find((c) => c.id === selectedCategory)
                        ?.label
                    }
                  </h4>
                  <p className="text-xs" style={{ color: "var(--text-gray)" }}>
                    {t("report.describeProblem", "Расскажите подробнее о проблеме")}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold" style={{ color: "var(--text-white)" }}>
                  {t("report.descriptionLabel", "Описание проблемы")}
                </label>
                <textarea
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                  className="w-full h-36 px-4 py-3 rounded-xl resize-none text-sm transition-all duration-200 focus:outline-none"
                  style={{
                    backgroundColor: "var(--bg-secondary)",
                    border: "2px solid var(--border-color)",
                    color: "var(--text-white)",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "#ef4444";
                    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(239, 68, 68, 0.1)";
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.05)";
                  }}
                  placeholder={t("report.descriptionPlaceholder", "Опишите детали проблемы, которую вы нашли...")}
                  maxLength={500}
                  disabled={isSubmitting}
                />
                <div className="flex justify-between items-center text-xs" style={{ color: "var(--text-gray)" }}>
                  <span>{t("report.beSpecific", "Будьте максимально конкретны")}</span>
                  <span className="font-medium">{reportText.length}/500</span>
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
                  ℹ️ {t("report.vpnInfo", "Если вы используете VPN или ваше сообщение не было отправлено пишите прямо на почту")} <a href="mailto:support@sentiensapps.online" className="font-medium" style={{ color: "#3b82f6" }}>support@sentiensapps.online</a>
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-200"
                  style={{
                    color: "var(--text-gray)",
                    backgroundColor: "var(--bg-secondary)",
                    border: "1px solid var(--border-color)",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSubmitting) {
                      e.currentTarget.style.color = "var(--text-white)";
                      e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                      e.currentTarget.style.borderColor = "var(--text-gray)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "var(--text-gray)";
                    e.currentTarget.style.backgroundColor = "var(--bg-secondary)";
                    e.currentTarget.style.borderColor = "var(--border-color)";
                  }}
                >
                  {t("report.back", "Назад")}
                </button>
                <button
                  type="submit"
                  disabled={!reportText.trim() || isSubmitting}
                  className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 rounded-xl flex items-center justify-center gap-2"
                  style={{
                    boxShadow: !reportText.trim() || isSubmitting ? "none" : "0 4px 12px rgba(239, 68, 68, 0.3)",
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t("report.sending", "Отправка...")}</span>
                    </>
                  ) : (
                    <>
                      <MdSend className="text-lg" />
                      <span>{t("report.send", "Отправить жалобу")}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div
          className="px-6 py-4 border-t"
          style={{
            backgroundColor: "var(--bg-secondary)",
            borderColor: "var(--border-color)",
          }}
        >
          <p className="text-xs text-center" style={{ color: "var(--text-gray)" }}>
            💡 {t("report.success", "Ваша жалоба будет рассмотрена в течение 24 часов")}
          </p>
        </div>
      </div>
    </div>
  );
}