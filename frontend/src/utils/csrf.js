// Утилита для получения CSRF токена из куки

export const getCsrfToken = () => {
  if (typeof document === "undefined") return null;

  const cookies = document.cookie ? document.cookie.split(";") : [];
  for (let cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "csrf_token") {
      return decodeURIComponent(value || "");
    }
  }
  return null;
};

