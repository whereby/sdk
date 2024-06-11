import * as React from "react";
import dynamic from "next/dynamic";

const Room = dynamic(() => import("../components/room"), { ssr: false });

// Replace this with your own Whereby room URL
const roomUrl = "";

export default function Home() {
    return (
        <main className="h-screen w-screen">
            <Room roomUrl={roomUrl} />
        </main>
    );
}
