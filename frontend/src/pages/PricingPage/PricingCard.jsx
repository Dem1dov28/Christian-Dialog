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
  priceStars,
}) => {
  const { t } = useLanguage();
  return (
    <article className={`${styles.card} ${isActive ? styles.active : ""}`} aria-label={`Pricing plan: ${title}`}>
      <header className={styles.cardHeader}>
        <h3 className={styles.title}>{title}</h3>
        <div className={styles.price}>
          {priceStars != null ? (
            <>
              <span className={styles.amount}>{priceStars}</span>
              <span className={styles.stars}> ⭐</span>
              <span className={styles.period}>{t("pricing.perMonth")}</span>
            </>
          ) : (
            <>
              <span className={styles.currency}>$</span>
              <span className={styles.amount}>{price}</span>
              <span className={styles.period}>{t("pricing.perMonth")}</span>
            </>
          )}
        </div>
        <p className={styles.description}>{description}</p>
      </header>

      <div className={styles.cardBody}>
        <FeatureList features={features} />
      </div>

      <footer className={styles.cardFooter}>
        <button
          className={`${styles.button} ${isCurrentPlan ? styles.currentPlan : styles.upgradePlan
            } ${isDisabled ? styles.disabled : ""}`}
          onClick={buttonAction}
          disabled={isCurrentPlan || isDisabled}
        >
          {buttonText}
        </button>
      </footer>
    </article>
  );
};

export default PricingCard;
