"use client";

import * as React from "react";

import { WherebyProvider } from "@whereby.com/browser-sdk/react";

function Provider({ children }: { children: React.ReactNode }) {
    return (
        <WherebyProvider>
            <>{children}</>
        </WherebyProvider>
    );
}

export default Provider;
