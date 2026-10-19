import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import telemetryHandler from "./api/telemetry.js";

/**
 * Serves the same serverless proxy during `npm run dev`, so the browser always talks to
 * same-origin `/api/telemetry` and never hits the upstream API directly (no CORS, no token
 * in the client bundle).
 */
function telemetryDevProxy(env: Record<string, string>): Plugin {
  return {
    name: "telemetry-dev-proxy",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/api/telemetry", (req, res) => {
        if (!process.env.API_TOKEN && env.VITE_API_TOKEN) process.env.API_TOKEN = env.VITE_API_TOKEN;
        if (!process.env.API_BASE && env.VITE_API_BASE) process.env.API_BASE = env.VITE_API_BASE;

        void Promise.resolve(telemetryHandler(req, res)).catch((error: unknown) => {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(
            JSON.stringify({
              error: error instanceof Error ? error.message : "Dev telemetry proxy failed.",
            }),
          );
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), telemetryDevProxy(env)],
    server: {
      port: 5173,
      open: false,
    },
  };
});
