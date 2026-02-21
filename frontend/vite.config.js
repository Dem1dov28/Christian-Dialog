import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { visualizer } from "rollup-plugin-visualizer";

// https://vitejs.dev/config/
// Загружаем .env из корня проекта (один файл для backend и frontend)
const rootDir = path.resolve(__dirname, "..");
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, rootDir, "");
  const serverHost = env.VITE_DEV_SERVER_HOST || "localhost";
  const serverPort = Number(env.VITE_DEV_SERVER_PORT || 5173);
  const isDev = mode === "development";

  return {
    // Загрузка .env из корня проекта для import.meta.env.VITE_* (иначе кнопка Google и API URL не видны)
    envDir: rootDir,
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
      // Bundle analyzer - generates stats.html on build
      visualizer({
        filename: './dist/stats.html',
        open: false,
        gzipSize: true,
        brotliSize: true,
      }),
    ],
    optimizeDeps: {
      include: ["react", "react-dom", "react-router-dom", "zustand"],
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            // Core React ecosystem - loaded on every page
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            // State management - smaller chunk
            'vendor-state': ['zustand'],
            // UI Components - only used Radix primitives
            'vendor-ui': [
              '@radix-ui/react-avatar',
              '@radix-ui/react-label',
              '@radix-ui/react-separator',
              '@radix-ui/react-slot',
              '@radix-ui/react-toast',
            ],
            // Animation libraries - lazy loaded when needed
            'vendor-animation': ['framer-motion'],
            // Utilities - tree-shakeable
            'vendor-utils': ['zod', 'clsx', 'tailwind-merge'],
            // Icons - only lucide-react, react-icons removed
            'vendor-icons': ['lucide-react'],
          },
          // Ensure small chunks for better caching
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: (assetInfo) => {
            const info = assetInfo.name.split('.');
            const ext = info[info.length - 1];
            if (/\.(woff2?|ttf|otf)$/.test(assetInfo.name)) {
              return 'assets/fonts/[name]-[hash][extname]';
            }
            if (/\.(png|jpe?g|gif|svg|webp|ico)$/.test(assetInfo.name)) {
              return 'assets/images/[name]-[hash][extname]';
            }
            return 'assets/[name]-[hash][extname]';
          },
        },
      },
      cssCodeSplit: true,
      cssMinify: true,
      // Source maps: enabled for development, disabled for production
      sourcemap: mode === 'development',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: mode === 'production',
          drop_debugger: mode === 'production',
          pure_funcs: mode === 'production' ? ['console.log', 'console.info', 'console.debug'] : [],
          passes: 2,
        },
        mangle: {
          safari10: true,
        },
        format: {
          comments: false,
        },
      },
      // Enable brotli compression for smaller assets
      reportCompressedSize: true,
      // Reduce chunk size warnings
      chunkSizeWarningLimit: 500,
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
