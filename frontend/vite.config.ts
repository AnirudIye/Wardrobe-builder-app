import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// Content-Security-Policy for the built SPA, injected as a <meta> tag at
// BUILD TIME ONLY - the React plugin injects an inline preamble in dev, which
// a committed CSP would break. script-src 'self' with zero inline scripts is
// the load-bearing part (blocks XSS token exfiltration); img-src stays broad
// deliberately (Buy Next retailer thumbnails, TryOn data: results, camera
// blobs); frame-src covers the WeatherWidget OpenStreetMap embed.
// NOTE for deploy time: meta CSP cannot express frame-ancestors - when a
// static host exists, move this same policy to a real response header and add
// frame-ancestors 'none'.
// The accounts.google.com/gsi/ entries are Google's documented CSP for the
// Sign in with Google button (script + iframe + XHR); harmless when the
// feature is unconfigured, required when it is.
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src https://fonts.gstatic.com",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "frame-src https://www.openstreetmap.org https://accounts.google.com/gsi/",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function cspPlugin(): Plugin {
  return {
    name: "inject-csp",
    apply: "build",
    transformIndexHtml(html) {
      return html.replace(
        "<head>",
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

// The dev server proxies /api to the FastAPI backend so the browser can call
// it without CORS friction. The API client prefixes requests with /api.
export default defineConfig({
  plugins: [react(), cspPlugin()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
