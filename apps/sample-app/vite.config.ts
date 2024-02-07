import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    define: {
        "process.env": {},
    },
    envDir: "../..",
    envPrefix: "REACT_APP_",
    server: {
        host: "127.0.0.1",
        port: 5420,
    },
});
