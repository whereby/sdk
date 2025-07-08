"use client";

import dynamic from "next/dynamic";

const ProviderWrapper = dynamic(() => import("./provider"), {
    ssr: false,
});

export default ProviderWrapper;
