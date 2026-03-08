import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./PricingPage.module.css";
import PricingCard from "./PricingCard";
import { getPricingData } from "../../data/pricingData";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTelegramWebApp } from "../../hooks/useTelegramWebApp";
import { SEO } from "@/components/common/SEO";
import apiClient from "../../services/api";

const PricingPage = ({ isVisible, onClose }) => {
  const { user, upgradeSubscription, refreshUserData } = useAuth();
  const { t, language } = useLanguage();
  const [isClosing, setIsClosing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState(null);
  const [cryptocloudEnabled, setCryptocloudEnabled] = useState(false);
  const [telegramStarsEnabled, setTelegramStarsEnabled] = useState(false);
  const [paymentsConfigLoaded, setPaymentsConfigLoaded] = useState(false);
  const [starsPricePlus, setStarsPricePlus] = useState(250);
  const [starsPricePro, setStarsPricePro] = useState(500);
  const { isTelegram } = useTelegramWebApp();

  useEffect(() => {
    if (isVisible) {
      setIsClosing(false);
      setUpgradeError(null);
      setUpgradeSuccess(null);
      setPaymentsConfigLoaded(false);
      refreshUserData?.();
      apiClient.getPaymentsConfig()
        .then((r) => {
          setCryptocloudEnabled(r.cryptocloud_enabled === true);
          setTelegramStarsEnabled(r.telegram_stars_enabled === true);
          if (r.telegram_stars_price_plus != null) setStarsPricePlus(r.telegram_stars_price_plus);
          if (r.telegram_stars_price_pro != null) setStarsPricePro(r.telegram_stars_price_pro);
        })
        .catch(() => {
          setCryptocloudEnabled(false);
        })
        .finally(() => setPaymentsConfigLoaded(true));
    }
  }, [isVisible, refreshUserData]);

  // Обновить данные при возврате в приложение (после оплаты в другом окне/Telegram)
  useEffect(() => {
    if (!isVisible || !refreshUserData) return;
    let lastRefresh = 0;
    const throttleMs = 2000;
    const maybeRefresh = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefresh < throttleMs) return;
      lastRefresh = now;
      refreshUserData();
    };
    document.addEventListener("visibilitychange", maybeRefresh);
    window.addEventListener("focus", maybeRefresh);
    return () => {
      document.removeEventListener("visibilitychange", maybeRefresh);
      window.removeEventListener("focus", maybeRefresh);
    };
  }, [isVisible, refreshUserData]);

  if (!isVisible) return null;

  const handleClose = () => {
    setIsClosing(true);
    // Ждем завершения анимации перед вызовом onClose
    setTimeout(() => {
      onClose();
    }, 300);
  };


  const handleUpgrade = async (subscriptionTier, apiKey = null) => {
    try {
      setIsUpgrading(true);
      setUpgradeError(null);
      setUpgradeSuccess(null);

      const response = await upgradeSubscription(subscriptionTier, apiKey);

      if (response.success) {
        setUpgradeSuccess(response.message);
        if (refreshUserData) await refreshUserData();
        setTimeout(() => {
          handleClose();
        }, 2000);
      } else {
        setUpgradeError(response.message || t("pricing.upgradeError"));
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      setUpgradeError(error.message || t("pricing.upgradeError"));
    } finally {
      setIsUpgrading(false);
    }
  };

  const handlePayWithStars = async (tier) => {
    try {
      setIsUpgrading(true);
      setUpgradeError(null);
      setUpgradeSuccess(null);
      const response = await apiClient.createTelegramStarsInvoice(tier);
      if (response.invoice_url) {
        const webApp = window.Telegram?.WebApp;
        const version = parseFloat(webApp?.version || "0") || 0;
        let opened = false;

        const onPaymentSuccess = async () => {
          if (refreshUserData) await refreshUserData();
        };

        if (webApp?.openInvoice && version >= 6.1) {
          try {
            webApp.openInvoice(response.invoice_url, async (status) => {
              if (status === "paid") await onPaymentSuccess();
            });
            opened = true;
          } catch (_) {
            // openInvoice выбросил — пробуем fallback
          }
        }
        // На Desktop openInvoice иногда не работает — открываем t.me ссылку через openTelegramLink
        if (!opened && webApp?.openTelegramLink) {
          try {
            webApp.openTelegramLink(response.invoice_url);
            opened = true;
            setUpgradeSuccess(t("pricing.starsOpenedInTelegram") || "Окно оплаты открыто в Telegram. После оплаты обновите страницу.");
          } catch (_) { }
        }
        if (!opened) {
          window.open(response.invoice_url, "_blank", "noopener,noreferrer");
          setUpgradeSuccess(t("pricing.starsOpenedInNewTab") || "Ссылка открыта. После оплаты в Telegram обновите страницу.");
        }
      } else {
        setUpgradeError(response.error || t("pricing.upgradeError"));
      }
    } catch (error) {
      setUpgradeError(error.message || t("pricing.upgradeError"));
    } finally {
      setIsUpgrading(false);
    }
  };

  const handlePayWithCrypto = async (tier) => {
    try {
      setIsUpgrading(true);
      setUpgradeError(null);
      const response = await apiClient.createCryptoInvoice(tier);
      if (response.link) {
        window.location.href = response.link;
        return;
      }
      setUpgradeError(response.error || t("pricing.upgradeError"));
    } catch (error) {
      console.error("CryptoCloud error:", error);
      setUpgradeError(error.message || t("pricing.upgradeError"));
    } finally {
      setIsUpgrading(false);
    }
  };

  const isCurrentPlan = (tier) => user?.subscription_tier === tier;

  // Telegram Stars работает и в вебе: ссылка на инвойс откроется в Telegram
  const hasPaymentMethod = paymentsConfigLoaded && (cryptocloudEnabled || telegramStarsEnabled);
  const showPaymentLoading = !paymentsConfigLoaded;

  const isProUser = user?.subscription_tier === "pro";
  const isPlusUser = user?.subscription_tier === "plus";
  const canDowngradeToFree = !isPlusUser && !isProUser;

  const pricingData = getPricingData(t);

  const overlay = (
    <div className={`${styles.overlay} ${isClosing ? styles.closing : ""} ${isTelegram ? "tg-safe-area-overlay" : ""}`}>
      <SEO
        title={t("pricing.title") || "Тарифы и подписки"}
        description="Выберите подходящий тариф для Epochal Dialog. Расширенные возможности общения с AI-персонажами, доступ к эксклюзивным героям и отсутствие лимитов."
        keywords={`${t("common.keywords")}, подписка, тарифы, pricing`}
        canonical="/Subscription"
        noindex={false}
      />
      <section className={`${styles.container} ${isClosing ? styles.closing : ""}`}>
        {/* Header with close button */}
        <header className={styles.header}>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close pricing page"
          >
            ×
          </button>
        </header>

        {/* Main content */}
        <div className={styles.content}>
          <h1 className={styles.title}>{t("pricing.title")}</h1>

          {/* Pricing cards container */}
          <main className={styles.cardsContainer}>
            <PricingCard
              title={pricingData.free.title}
              price={pricingData.free.price}
              description={pricingData.free.description}
              features={pricingData.free.features}
              buttonText={
                isCurrentPlan("free")
                  ? t("pricing.currentPlan")
                  : isProUser
                    ? t("pricing.yourPlanHigher")
                    : isPlusUser
                      ? (language === "ru" ? "Активна подписка Plus" : "Plus subscription active")
                      : t("pricing.switchToFree")
              }
              buttonAction={() => {
                if (!isCurrentPlan("free") && canDowngradeToFree) handleUpgrade("free");
              }}
              isCurrentPlan={isCurrentPlan("free") || isProUser || isPlusUser}
              isDisabled={isUpgrading || isPlusUser || isProUser}
            />
            <PricingCard
              title={pricingData.plus.title}
              price={pricingData.plus.price}
              priceStars={(telegramStarsEnabled || (isTelegram && !paymentsConfigLoaded)) ? starsPricePlus : undefined}
              description={pricingData.plus.description}
              features={pricingData.plus.features}
              buttonText={
                isCurrentPlan("plus")
                  ? t("pricing.currentPlan")
                  : isProUser
                    ? t("pricing.yourPlanHigher")
                    : showPaymentLoading
                      ? "..."
                      : hasPaymentMethod
                        ? (telegramStarsEnabled ? (isTelegram ? t("pricing.payWithStars") : t("pricing.payInTelegram")) : t("pricing.payWithCrypto"))
                        : t("pricing.paymentUnavailable")
              }
              buttonAction={() => {
                if (!isCurrentPlan("plus") && !isProUser && hasPaymentMethod) {
                  if (telegramStarsEnabled) handlePayWithStars("plus");
                  else if (cryptocloudEnabled) handlePayWithCrypto("plus");
                }
              }}
              isCurrentPlan={isCurrentPlan("plus") || isProUser}
              isDisabled={isUpgrading || isProUser || (showPaymentLoading || (!hasPaymentMethod && !isCurrentPlan("plus")))}
            />
            <PricingCard
              title={pricingData.pro.title}
              price={pricingData.pro.price}
              priceStars={(telegramStarsEnabled || (isTelegram && !paymentsConfigLoaded)) ? starsPricePro : undefined}
              description={pricingData.pro.description}
              features={pricingData.pro.features}
              buttonText={
                isCurrentPlan("pro")
                  ? t("pricing.currentPlan")
                  : showPaymentLoading
                    ? "..."
                    : hasPaymentMethod
                      ? (telegramStarsEnabled ? (isTelegram ? t("pricing.payWithStars") : t("pricing.payInTelegram")) : t("pricing.payWithCrypto"))
                      : t("pricing.paymentUnavailable")
              }
              buttonAction={() => {
                if (!isCurrentPlan("pro") && hasPaymentMethod) {
                  if (telegramStarsEnabled) handlePayWithStars("pro");
                  else if (cryptocloudEnabled) handlePayWithCrypto("pro");
                }
              }}
              isCurrentPlan={isCurrentPlan("pro")}
              isDisabled={isUpgrading || showPaymentLoading || !hasPaymentMethod}
            />
          </main>

          {/* Success/Error Messages */}
          {upgradeSuccess && (
            <div className={styles.successMessage}>
              <div className={styles.messageContent}>
                <span className={styles.successIcon}>✓</span>
                <span>{upgradeSuccess}</span>
              </div>
            </div>
          )}

          {upgradeError && (
            <div className={styles.errorMessage}>
              <div className={styles.messageContent}>
                <span className={styles.errorIcon}>✗</span>
                <span>{upgradeError}</span>
              </div>
            </div>
          )}

          {/* Loading overlay */}
          {isUpgrading && (
            <div className={styles.loadingOverlay}>
              <div className={styles.loadingSpinner}></div>
              <span>{t("pricing.upgrading")}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );

  // Рендерим поверх всего UI вне .app-root, чтобы transform не ломал fixed/viewport размеры
  return createPortal(overlay, document.body);
};

export default PricingPage;
