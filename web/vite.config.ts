import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiTarget = (env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");

  const adminBuild = process.env.VITE_BUILD_TARGET === "admin";

  return {
    plugins: [react()],
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
      },
    },
  };
});
