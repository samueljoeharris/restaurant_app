import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = (env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");

  const adminBuild = process.env.VITE_BUILD_TARGET === "admin";
  const deployEnv = (env.VITE_DEPLOY_ENV || "dev").toLowerCase();
  const faviconHref = deployEnv === "prod" ? "/favicon.svg" : "/favicon-dev.svg";

  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: "deploy-env-favicon",
        transformIndexHtml(html: string) {
          return html.replace('href="/favicon.svg"', `href="${faviconHref}"`);
        },
      },
      adminBuild && {
        name: "admin-html-fallback",
        configureServer(server: { middlewares: Connect.Server }) {
          server.middlewares.use((
            req: IncomingMessage,
            _res: ServerResponse,
            next: Connect.NextFunction,
          ) => {
            const path = req.url?.split("?")[0] ?? "";
            if (
              path !== "/admin.html" &&
              !path.includes(".") &&
              !path.startsWith("/@") &&
              !path.startsWith("/src/") &&
              !path.startsWith("/node_modules/")
            ) {
              req.url = "/admin.html";
            }
            next();
          });
        },
      },
    ].filter(Boolean),
    build: adminBuild
      ? {
          rollupOptions: {
            input: {
              admin: "admin.html",
            },
          },
        }
      : undefined,
    server: {
      proxy: {
        "/v1": {
          target: apiTarget,
          changeOrigin: true,
        },
        "/auth/firebase-session": {
          target: apiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/auth\/firebase-session/, "/v1/admin/firebase-session"),
        },
      },
    },
  };
});
