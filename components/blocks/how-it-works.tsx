"use client";
import React from "react";

import { twMerge } from "tailwind-merge";
import { TracingBeam } from "../ui/tracing-beam";
import { AnimatedGroup } from "../ui/animated-group";
import { Variants } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function TracingBeamDemo() {

    const transitionVariants = {
        item: {
            hidden: {
                opacity: 0,
                filter: 'blur(12px)',
                y: 12,
            },
            visible: {
                opacity: 1,
                filter: 'blur(0px)',
                y: 0,
                transition: {
                    type: 'spring',
                    bounce: 0.3,
                    duration: 1.5,
                },
            },
        },
    }

    return (
        <div className="pb-8 mt-16 w-full text-center border-none">
            <div className="pb-16">
                <Link
                    href="#link"
                    className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-black/5 transition-all duration-300 dark:border-t-white/5 dark:shadow-zinc-950">
                    <span className="text-foreground text-sm">Okay, but how?</span>
                    <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>

                    <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500">
                        <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                            <span className="flex size-6">
                                <ArrowRight className="m-auto size-3" />
                            </span>
                            <span className="flex size-6">
                                <ArrowRight className="m-auto size-3" />
                            </span>
                        </div>
                    </div>
                </Link>
                <h1
                    className="mt-8 max-w-4xl mx-auto text-balance text-4xl md:text-4xl xl:text-[3.25rem]">
                    How Loom AI works
                </h1>
                <p
                    className="mx-auto mt-4 max-w-2xl text-balance text-lg">
                    Three steps. All signal. No fluff.
                </p>
            </div>
            <TracingBeam className="px-6">
                <div className="max-w-3xl mx-auto antialiased pt-4 relative">
                    {dummyContent.map((item, index) => (
                        <div key={`content-${index}`} className="mb-10">
                            <h2 className="bg-black text-white rounded-full text-sm w-fit px-4 py-1 mb-4">
                                {item.badge}
                            </h2>

                            <p className={twMerge("text-xl mb-4 text-start")}>
                                {item.title}
                            </p>

                            <div className="text-sm  prose prose-sm dark:prose-invert">
                                {item?.image && (
                                    <img
                                        src={item.image}
                                        alt="blog thumbnail"
                                        height="1000"
                                        width="1000"
                                        className="rounded-lg mb-10 object-cover"
                                    />
                                )}
                                {item.description}
                            </div>
                        </div>
                    ))}
                </div>
            </TracingBeam>
        </div>

    );
}

const dummyContent = [
    {
        title: "Save it once",
        description: (
            <>
                <p>
                    Drop in passwords, dates, business details, files — the works. Loom AI stores it in a way only you can decode.
                </p>
            </>
        ),
        badge: "Private by design",
        image:
            "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1600&ixlib=rb-4.0.3",
    },
    {
        title: "Recall on demand",
        description: (
            <>
                <p>
                    Ask naturally or search. Your memory shows up instantly — clean, accurate, and on time.
                </p>
            </>
        ),
        badge: "Fast search",
        image:
            "https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&q=80&w=1600&ixlib=rb-4.0.3",
    },
    {
        title: "Automate the small stuff",
        description: (
            <>
                <p>
                    Set reminders and lightweight actions — like emailing your boss at 9 AM — and let Loom AI ship it.
                </p>
            </>
        ),
        badge: "Reminders & actions",
        image:
            "https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&q=80&w=1600&ixlib=rb-4.0.3",
    },
];
