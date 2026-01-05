import React, { useState } from "react";
import { MdPerson, MdHeight, MdMonitorWeight, MdFitnessCenter, MdRestaurant, MdFavorite, MdClose } from "react-icons/md";
import apiClient from "../../services/api";

/**
 * Компонент формы onboarding для сбора личных данных
 */
const OnboardingForm = ({ onComplete, onCancel, activeConversation, onSendMessage }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    // Шаг 1: Основные данные
    gender: "",
    age: "",
    height_cm: "",
    current_weight_kg: "",
    target_weight_kg: "",
    
    // Шаг 2: Цели и активность
    goal: "",
    activity_level: "",
    
    // Шаг 3: Здоровье
    health_conditions: "",
    intolerances: "",
    
    // Шаг 4: Предпочтения
    dietary_preferences: "",
    favorite_foods: "",
    disliked_foods: "",
    
    // Шаг 5: Образ жизни
    cooking_frequency: "",
    budget_level: "",
    recipe_complexity: "",
  });

  const totalSteps = 5;

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // Формируем данные для отправки через прямой API endpoint
      const onboardingData = {
        gender: formData.gender,
        age: parseInt(formData.age),
        height_cm: parseFloat(formData.height_cm),
        current_weight_kg: parseFloat(formData.current_weight_kg),
        target_weight_kg: parseFloat(formData.target_weight_kg),
        goal: formData.goal,
        activity_level: formData.activity_level,
        health_conditions: formData.health_conditions || null,
        intolerances: formData.intolerances || null,
        dietary_preferences: formData.dietary_preferences || null,
        favorite_foods: formData.favorite_foods || null,
        disliked_foods: formData.disliked_foods || null,
        cooking_frequency: formData.cooking_frequency,
        budget_level: formData.budget_level,
        recipe_complexity: formData.recipe_complexity,
        onboarding_completed: true, // Устанавливаем флаг завершения onboarding
      };

      // Отправляем данные напрямую через API endpoint
      const response = await apiClient.put("/dietitian/profile", onboardingData);

      console.log("[ONBOARDING] Профиль успешно сохранен:", response);

      // Ждем немного, чтобы данные успели сохраниться в базе
      await new Promise(resolve => setTimeout(resolve, 500));

      if (onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error("[ONBOARDING] Ошибка при сохранении:", error);
      const errorMessage = error?.response?.data?.detail || error?.message || "Неизвестная ошибка";
      alert(`Ошибка при сохранении данных: ${errorMessage}. Попробуйте еще раз.`);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return formData.gender && formData.age && formData.height_cm && 
               formData.current_weight_kg && formData.target_weight_kg;
      case 2:
        return formData.goal && formData.activity_level;
      case 3:
        return true; // Опциональные поля
      case 4:
        return true; // Опциональные поля
      case 5:
        return formData.cooking_frequency && formData.budget_level && formData.recipe_complexity;
      default:
        return false;
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-primary)]">
      {/* Заголовок */}
      <div className="flex items-center justify-between p-4 border-b border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-white)]">Настройка профиля</h2>
          <p className="text-sm text-[var(--text-gray)] mt-1">
            Шаг {step} из {totalSteps}
          </p>
        </div>
        {onCancel && (
          <button
            onClick={onCancel}
            className="p-2 rounded-lg hover:bg-[var(--hover-bg)] transition-colors"
          >
            <MdClose size={20} className="text-[var(--text-gray)]" />
          </button>
        )}
      </div>

      {/* Прогресс-бар */}
      <div className="h-1 bg-[var(--bg-secondary)]">
        <div
          className="h-full bg-[var(--accent)] transition-all duration-300"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      {/* Контент формы */}
      <div className="flex-1 overflow-y-auto p-6">
        {/* Шаг 1: Основные данные */}
        {step === 1 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-[var(--accent)]/20">
                <MdPerson size={24} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-white)]">Основные данные</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Пол *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => handleChange("gender", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Выберите пол</option>
                  <option value="male">Мужской</option>
                  <option value="female">Женский</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Возраст *
                </label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => handleChange("age", e.target.value)}
                  placeholder="Введите возраст"
                  min="1"
                  max="120"
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                    <MdHeight className="inline mr-1" /> Рост (см) *
                  </label>
                  <input
                    type="number"
                    value={formData.height_cm}
                    onChange={(e) => handleChange("height_cm", e.target.value)}
                    placeholder="Рост"
                    min="50"
                    max="250"
                    className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                    <MdMonitorWeight className="inline mr-1" /> Текущий вес (кг) *
                  </label>
                  <input
                    type="number"
                    value={formData.current_weight_kg}
                    onChange={(e) => handleChange("current_weight_kg", e.target.value)}
                    placeholder="Вес"
                    min="20"
                    max="300"
                    step="0.1"
                    className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Желаемый вес (кг) *
                </label>
                <input
                  type="number"
                  value={formData.target_weight_kg}
                  onChange={(e) => handleChange("target_weight_kg", e.target.value)}
                  placeholder="Желаемый вес"
                  min="20"
                  max="300"
                  step="0.1"
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Шаг 2: Цели и активность */}
        {step === 2 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-[var(--accent)]/20">
                <MdFitnessCenter size={24} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-white)]">Цели и активность</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Цель *
                </label>
                <select
                  value={formData.goal}
                  onChange={(e) => handleChange("goal", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Выберите цель</option>
                  <option value="weight_loss">Похудение</option>
                  <option value="muscle_gain">Набор мышечной массы</option>
                  <option value="weight_maintenance">Поддержание веса</option>
                  <option value="health_improvement">Улучшение самочувствия</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Уровень физической активности *
                </label>
                <select
                  value={formData.activity_level}
                  onChange={(e) => handleChange("activity_level", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Выберите уровень</option>
                  <option value="sedentary">Сидячий образ жизни</option>
                  <option value="light">Легкая активность (1-3 раза в неделю)</option>
                  <option value="moderate">Умеренная активность (3-5 раз в неделю)</option>
                  <option value="active">Активный образ жизни (6-7 раз в неделю)</option>
                  <option value="very_active">Очень активный (тренировки 2 раза в день)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Шаг 3: Здоровье */}
        {step === 3 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-[var(--accent)]/20">
                <MdFavorite size={24} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-white)]">Состояние здоровья</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Заболевания (опционально)
                </label>
                <input
                  type="text"
                  value={formData.health_conditions}
                  onChange={(e) => handleChange("health_conditions", e.target.value)}
                  placeholder="Например: диабет, проблемы с ЖКТ"
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Непереносимости (опционально)
                </label>
                <input
                  type="text"
                  value={formData.intolerances}
                  onChange={(e) => handleChange("intolerances", e.target.value)}
                  placeholder="Например: лактоза, глютен"
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Шаг 4: Предпочтения */}
        {step === 4 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-[var(--accent)]/20">
                <MdRestaurant size={24} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-white)]">Предпочтения в питании</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Диетические предпочтения (опционально)
                </label>
                <select
                  value={formData.dietary_preferences}
                  onChange={(e) => handleChange("dietary_preferences", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Нет предпочтений</option>
                  <option value="vegetarian">Вегетарианство</option>
                  <option value="vegan">Веганство</option>
                  <option value="pescatarian">Пескетарианство</option>
                  <option value="keto">Кето-диета</option>
                  <option value="paleo">Палео-диета</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Любимые продукты (опционально)
                </label>
                <input
                  type="text"
                  value={formData.favorite_foods}
                  onChange={(e) => handleChange("favorite_foods", e.target.value)}
                  placeholder="Например: курица, овощи, фрукты"
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Нелюбимые продукты (опционально)
                </label>
                <input
                  type="text"
                  value={formData.disliked_foods}
                  onChange={(e) => handleChange("disliked_foods", e.target.value)}
                  placeholder="Например: рыба, грибы"
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Шаг 5: Образ жизни */}
        {step === 5 && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 rounded-full bg-[var(--accent)]/20">
                <MdRestaurant size={24} className="text-[var(--accent)]" />
              </div>
              <h3 className="text-lg font-semibold text-[var(--text-white)]">Образ жизни</h3>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Частота готовки *
                </label>
                <select
                  value={formData.cooking_frequency}
                  onChange={(e) => handleChange("cooking_frequency", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Выберите частоту</option>
                  <option value="daily">Каждый день</option>
                  <option value="few_times_week">Несколько раз в неделю</option>
                  <option value="rarely">Редко</option>
                  <option value="never">Не готовлю</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Бюджет *
                </label>
                <select
                  value={formData.budget_level}
                  onChange={(e) => handleChange("budget_level", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Выберите бюджет</option>
                  <option value="low">Экономный</option>
                  <option value="medium">Средний</option>
                  <option value="high">Высокий</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--text-white)] mb-2">
                  Сложность рецептов *
                </label>
                <select
                  value={formData.recipe_complexity}
                  onChange={(e) => handleChange("recipe_complexity", e.target.value)}
                  className="w-full px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border-color)] text-[var(--text-white)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                >
                  <option value="">Выберите сложность</option>
                  <option value="simple">Простые</option>
                  <option value="medium">Средние</option>
                  <option value="complex">Сложные</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Кнопки навигации */}
      <div className="flex items-center justify-between p-4 border-t border-[var(--border-color)] bg-[var(--bg-secondary)]">
        <button
          onClick={handleBack}
          disabled={step === 1}
          className={`px-6 py-2 rounded-lg font-medium transition-colors ${
            step === 1
              ? "bg-[var(--bg-tertiary)] text-[var(--text-gray)] cursor-not-allowed"
              : "bg-[var(--bg-primary)] text-[var(--text-white)] hover:bg-[var(--hover-bg)]"
          }`}
        >
          Назад
        </button>

        {step < totalSteps ? (
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              canProceed()
                ? "bg-[var(--accent)] text-white hover:brightness-110"
                : "bg-[var(--bg-tertiary)] text-[var(--text-gray)] cursor-not-allowed"
            }`}
          >
            Далее
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || loading}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              canProceed() && !loading
                ? "bg-[var(--accent)] text-white hover:brightness-110"
                : "bg-[var(--bg-tertiary)] text-[var(--text-gray)] cursor-not-allowed"
            }`}
          >
            {loading ? "Сохранение..." : "Завершить"}
          </button>
        )}
      </div>
    </div>
  );
};

export default OnboardingForm;

