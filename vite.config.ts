import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: "auto",
      devOptions: {
        enabled: true,
      },
      workbox: {
        clientsClaim: true,
        skipWaiting: true,
      },
      includeAssets: ["trustipay.ico"],
      manifest: {
        name: "TrustiPay",
        short_name: "TrustiPay",
        description: "A secure and fast payment app",
        theme_color: "#0d9488",
        icons: [
          {
            src: "/trustipay.ico",
            sizes: "192x192",
            type: "image/ico",
          },
          {
            src: "/trustipay.ico",
            sizes: "512x512",
            type: "image/ico",
          },
        ],
      },
    }),
  ],
});
