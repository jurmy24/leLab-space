import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

// Check if certificates exist
const certPath = path.resolve(__dirname, "./certs/localhost+3.pem");
const keyPath = path.resolve(__dirname, "./certs/localhost+3-key.pem");
const certsExist = fs.existsSync(certPath) && fs.existsSync(keyPath);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    ...(certsExist && {
      https: {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      },
    }),
    // Proxy removed - the React app now handles API URLs directly through the ApiContext
    // This provides full flexibility for localhost/ngrok switching at runtime
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(
    Boolean
  ),
  preview: {
    allowedHosts: ["jurmy24-lelab.hf.space"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
