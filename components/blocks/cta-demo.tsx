"use client";
import React from "react";
import { BackgroundBeams } from "@/components/ui/background-beams";
import { Button } from "@/components/ui/button";
import Link from "next/link";

function CTA() {
  return (
    <div className="w-full rounded-md bg-background relative flex flex-col items-center justify-center antialiased">
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="relative z-10 text-lg md:text-7xl bg-clip-text text-transparent bg-gradient-to-b from-foreground to-muted-foreground text-center font-sans font-bold">
          Get started
        </h1>
        <p></p>
        <p className="text-muted-foreground max-w-lg mx-auto my-2 text-sm text-center relative z-10">
          Your external memory card — encrypted, fast, and actually useful.
          Save the essentials, recall in seconds, and let reminders ship on time.
        </p>
        <Link href="/auth/sign-up" className="block w-full relative z-10 mt-4">
          <Button className="w-full">
            Get started free
          </Button>
        </Link>
      </div>
    </div>
  );
}

export { CTA };