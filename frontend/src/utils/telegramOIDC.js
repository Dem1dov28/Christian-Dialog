/**
 * Утилиты для Log In With Telegram (OIDC redirect flow)
 * https://core.telegram.org/bots/telegram-login
 */

const STORAGE_KEY_VERIFIER = "telegram_oidc_code_verifier";
const STORAGE_KEY_STATE = "telegram_oidc_state";

function generateRandomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    result += chars[array[i] % chars.length];
  }
  return result;
}

async function sha256(str) {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function base64UrlEncode(hexStr) {
  const bytes = new Uint8Array(hexStr.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function buildTelegramAuthUrl(clientId, redirectUri) {
  const codeVerifier = generateRandomString(64);
  const state = generateRandomString(32);
  const hashHex = await sha256(codeVerifier);
  const codeChallenge = base64UrlEncode(hashHex);

  sessionStorage.setItem(STORAGE_KEY_VERIFIER, codeVerifier);
  sessionStorage.setItem(STORAGE_KEY_STATE, state);

  const params = new URLSearchParams({
    client_id: String(clientId),
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid profile",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://oauth.telegram.org/auth?${params.toString()}`;
}

export { STORAGE_KEY_VERIFIER, STORAGE_KEY_STATE };
