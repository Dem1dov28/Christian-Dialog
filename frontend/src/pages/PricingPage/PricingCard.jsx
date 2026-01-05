import React from "react";
import styles from "./PricingCard.module.css";
import FeatureList from "./FeatureList";
import { useLanguage } from "../../contexts/LanguageContext";

const PricingCard = ({
  title,
  price,
  description,
  features,
  buttonText,
  buttonAction,
  isActive = false,
  isCurrentPlan = false,
  isDisabled = false,
}) => {
  const { t } = useLanguage();
  return (
    <div className={`${styles.card} ${isActive ? styles.active : ""}`}>
      <div className={styles.cardHeader}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.price}>
          <span className={styles.currency}>$</span>
          <span className={styles.amount}>{price}</span>
          <span className={styles.period}>{t("pricing.perMonth")}</span>
        </div>
        <p className={styles.description}>{description}</p>
      </div>

      <div className={styles.cardBody}>
        <FeatureList features={features} />
      </div>

      <div className={styles.cardFooter}>
        <button
          className={`${styles.button} ${
            isCurrentPlan ? styles.currentPlan : styles.upgradePlan
          } ${isDisabled ? styles.disabled : ""}`}
          onClick={buttonAction}
          disabled={isCurrentPlan || isDisabled}
        >
          {buttonText}
        </button>
      </div>
    </div>
  );
};

export default PricingCard;
