"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  void error;
  return (
    <main className="grid min-h-screen place-items-center bg-black px-4 text-white">
      <section className="section-band max-w-xl p-6 text-center">
        <AlertTriangle className="mx-auto size-10 text-[#9AFF00]" />
        <h1 className="certificate-title mt-4 text-4xl">Systems Paused</h1>
        <p className="mt-3 text-sm text-zinc-400">
          The platform could not reach a required service. Retry in a moment; protected writes are transaction guarded.
        </p>
        <Button type="button" className="mt-5" onClick={() => reset()}>
          Retry
        </Button>
      </section>
    </main>
  );
}
