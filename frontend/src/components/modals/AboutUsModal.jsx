import React from "react";
import { MdClose } from "react-icons/md";
import { FaTelegram, FaInstagram, FaYoutube, FaTiktok } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { useLanguage } from "../../contexts/LanguageContext";

const SOCIAL_LINKS = {
  ru: [
    {
      id: "telegram",
      icon: FaTelegram,
      color: "#0088cc",
      url: "https://t.me/sentiensapps",
    },
    {
      id: "instagram",
      icon: FaInstagram,
      gradient: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
      url: "https://www.instagram.com/sentiensapps/",
    },
    {
      id: "youtube",
      icon: FaYoutube,
      color: "#FF0000",
      url: "https://www.youtube.com/@SentiensApps",
    },
    {
      id: "tiktok",
      icon: FaTiktok,
      color: "#000000",
      url: "https://www.tiktok.com/@sentiensapps",
    },
  ],
  en: [
    {
      id: "twitter",
      icon: FaXTwitter,
      color: "#000000",
      url: "https://x.com/SentiensApps",
    },
    {
      id: "instagram",
      icon: FaInstagram,
      gradient: "linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)",
      url: "https://www.instagram.com/epochaldialog",
    },
    {
      id: "youtube",
      icon: FaYoutube,
      color: "#FF0000",
      url: "https://youtube.com/@epochaldialog",
    },
    {
      id: "tiktok",
      icon: FaTiktok,
      color: "#000000",
      url: "https://www.tiktok.com/@epochaldialog",
    },
  ],
};

export default function AboutUsModal({ isOpen, onClose }) {
  const { t, language } = useLanguage();
  const socialLinks = SOCIAL_LINKS[language] || SOCIAL_LINKS.en;

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[100] p-4"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <div
        className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        style={{
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border-color)",
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3), 0 0 1px rgba(0, 0, 0, 0.1)",
        }}
        onClick={(e) => e.stopPropagation()}
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
            <div>
              <h3 className="text-lg font-semibold" style={{ color: "var(--text-white)" }}>
                {t("aboutUs.title")}
              </h3>
              <p className="text-sm" style={{ color: "var(--text-gray)" }}>
                {t("aboutUs.subtitle")}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200"
              style={{ color: "var(--text-gray)" }}
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

        {/* Social Links */}
        <div className="px-6 py-6">
          <div className="grid grid-cols-2 gap-4">
            {socialLinks.map((social) => {
              const IconComponent = social.icon;
              return (
                <a
                  key={social.id}
                  href={social.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center gap-3 p-5 rounded-xl transition-all duration-200 group"
                  style={{
                    border: "1px solid var(--border-color)",
                    backgroundColor: "var(--bg-secondary)",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = `0 8px 24px ${social.color || "rgba(0,0,0,0.2)"}40`;
                    e.currentTarget.style.borderColor = social.color || "var(--accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.borderColor = "var(--border-color)";
                  }}
                >
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200"
                    style={{
                      background: social.gradient || social.color,
                    }}
                  >
                    <IconComponent className="text-2xl text-white" />
                  </div>
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--text-white)" }}
                  >
                    {t(`aboutUs.social.${social.id}`)}
                  </span>
                </a>
              );
            })}
          </div>
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
            {t("aboutUs.footer")}
          </p>
        </div>
      </div>
    </div>
  );
}
