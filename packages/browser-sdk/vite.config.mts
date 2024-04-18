import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react()],
    define: {
        "process.env": {
            REACT_APP_API_BASE_URL: process.env.REACT_APP_API_BASE_URL || "https://api.appearin.net",
            REACT_APP_SIGNAL_BASE_URL: process.env.REACT_APP_SIGNAL_BASE_URL || "wss://signal.appearin.net",
            STORYBOOK_ROOM: process.env.STORYBOOK_ROOM,
            STORYBOOK_ROOM_HOST_ROOMKEY: process.env.STORYBOOK_ROOM_HOST_ROOMKEY,
            REACT_APP_IS_DEV: process.env.REACT_APP_IS_DEV || "false",
        },
    },
    envDir: "../..",
    envPrefix: "REACT_APP_",
});
