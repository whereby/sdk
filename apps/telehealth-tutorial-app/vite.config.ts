import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    define: {
        "process.env": {},
    },
    server: {
        host: "127.0.0.1",
        port: 5421,
    },
});
