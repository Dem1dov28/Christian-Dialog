import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const serverHost = env.VITE_DEV_SERVER_HOST || "localhost";
  const serverPort = Number(env.VITE_DEV_SERVER_PORT || 5173);
  const isDev = mode === "development";

  return {
    server: {
      host: serverHost,
      port: serverPort,
      hmr: {
        port: serverPort,
        host: serverHost,
      },
      headers: {
        // Временно отключаем CSP для тестирования
        // "Content-Security-Policy": isDev
        //   ? "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' http://localhost:8001;"
        //   : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://api.yourdomain.com;",
      },
    },
    plugins: [
      react({
        include: "**/*.{jsx,tsx}",
        babel: {
          plugins: [],
        },
      }),
    ],
    optimizeDeps: {
      include: ["react", "react-dom"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      "process.env": {},
    },
  };
});
