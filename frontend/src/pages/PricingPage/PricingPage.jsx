import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./PricingPage.module.css";
import PricingCard from "./PricingCard";
import { getPricingData } from "../../data/pricingData";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";

const PricingPage = ({ isVisible, onClose }) => {
  const { user, upgradeSubscription } = useAuth();
  const { t } = useLanguage();
  const [isClosing, setIsClosing] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState(null);
  const [upgradeSuccess, setUpgradeSuccess] = useState(null);

  useEffect(() => {
    if (isVisible) {
      setIsClosing(false);
      setUpgradeError(null);
      setUpgradeSuccess(null);
    }
  }, [isVisible]);

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
        // Закрываем страницу через 2 секунды после успешного обновления
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

  const isCurrentPlan = (tier) => {
    return user?.subscription_tier === tier;
  };

  const pricingData = getPricingData(t);

  const overlay = (
    <div className={`${styles.overlay} ${isClosing ? styles.closing : ""}`}>
      <div className={`${styles.container} ${isClosing ? styles.closing : ""}`}>
        {/* Header with close button */}
        <div className={styles.header}>
          <button
            className={styles.closeButton}
            onClick={handleClose}
            aria-label="Close pricing page"
          >
            ×
          </button>
        </div>

        {/* Main content */}
        <div className={styles.content}>
          <h1 className={styles.title}>{t("pricing.title")}</h1>

          {/* Pricing cards container */}
          <div className={styles.cardsContainer}>
            <PricingCard
              title={pricingData.free.title}
              price={pricingData.free.price}
              description={pricingData.free.description}
              features={pricingData.free.features}
              buttonText={
                isCurrentPlan("free")
                  ? t("pricing.currentPlan")
                  : t("pricing.switchToFree")
              }
              buttonAction={() => {
                if (!isCurrentPlan("free")) {
                  handleUpgrade("free");
                }
              }}
              isCurrentPlan={isCurrentPlan("free")}
              isDisabled={isUpgrading}
            />
            <PricingCard
              title={pricingData.plus.title}
              price={pricingData.plus.price}
              description={pricingData.plus.description}
              features={pricingData.plus.features}
              buttonText={
                isCurrentPlan("plus")
                  ? t("pricing.currentPlan")
                  : t("pricing.switchToPlus")
              }
              buttonAction={() => {
                if (!isCurrentPlan("plus")) {
                  handleUpgrade("plus");
                }
              }}
              isCurrentPlan={isCurrentPlan("plus")}
              isDisabled={isUpgrading}
            />
            <PricingCard
              title={pricingData.pro.title}
              price={pricingData.pro.price}
              description={pricingData.pro.description}
              features={pricingData.pro.features}
              buttonText={
                isCurrentPlan("pro") ? t("pricing.currentPlan") : t("pricing.switchToPro")
              }
              buttonAction={() => {
                if (!isCurrentPlan("pro")) {
                  handleUpgrade("pro");
                }
              }}
              isCurrentPlan={isCurrentPlan("pro")}
              isDisabled={isUpgrading}
            />
          </div>

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
      </div>
    </div>
  );

  // Рендерим поверх всего UI вне .app-root, чтобы transform не ломал fixed/viewport размеры
  return createPortal(overlay, document.body);
};

export default PricingPage;
