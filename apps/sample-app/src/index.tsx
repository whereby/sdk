import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { WherebyProvider } from "@whereby.com/browser-sdk/react";

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
    <WherebyProvider>
        <App />
    </WherebyProvider>,
);
