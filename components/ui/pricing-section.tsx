"use client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { TimelineContent } from "@/components/ui/timeline-animation";
import { VerticalCutReveal } from "@/components/ui/vertical-cut-reveal";
import { cn } from "@/lib/utils";
import NumberFlow from "@number-flow/react";
import { Briefcase, CheckCheck, Database, Server } from "lucide-react";
import { motion } from "motion/react";
import { useRef, useState } from "react";
import { Button } from "./button";
import Link from "next/link";

const plans = [
    {
        name: "Free",
        description:
            "Test the vibe. Save essentials and try reminders with tight limits.",
        price: 0,
        yearlyPrice: 0,
        buttonText: "Get started free",
        buttonVariant: "outline" as const,
        features: [
            { text: "20 memory records", icon: <Briefcase size={20} /> },
            { text: "2 file uploads", icon: <Database size={20} /> },
            { text: "Basic reminders", icon: <Server size={20} /> },
        ],
        includes: [
            "Free includes:",
            "Encrypted storage",
            "Fast recall",
            "2-factor authentication",
        ],
    },
    {
        name: "Pro",
        description:
            "For people who want speed, storage, and automations that just ship.",
        price: 48,
        yearlyPrice: 399,
        buttonText: "Get started",
        buttonVariant: "outline" as const,
        features: [
            { text: "500 memory records", icon: <Briefcase size={20} /> },
            { text: "50 file uploads", icon: <Database size={20} /> },
            { text: "Priority reminders/actions", icon: <Server size={20} /> },
        ],
        includes: [
            "Everything in Free, plus:",
            "Faster search",
            "Advanced reminder options",
            "Email actions",
        ],
    },
    {
        name: "Pro Plus",
        description:
            "For power users and small teams who want max capacity and control.",
        price: 96,
        yearlyPrice: 899,
        popular: true,
        buttonText: "Get started",
        buttonVariant: "default" as const,
        features: [
            { text: "2,000 memory records", icon: <Briefcase size={20} /> },
            { text: "200 file uploads", icon: <Database size={20} /> },
            { text: "Team-ready controls", icon: <Server size={20} /> },
        ],
        includes: [
            "Everything in Pro, plus:",
            "Role‑based access",
            "Advanced encryption controls",
            "Priority support",
        ],
    },
];

const PricingSwitch = ({
    onSwitch,
    className,
}: {
    onSwitch: (value: string) => void;
    className?: string;
}) => {
    const [selected, setSelected] = useState("0");

    const handleSwitch = (value: string) => {
        setSelected(value);
        onSwitch(value);
    };

    return (
        <div className={cn("flex justify-center", className)}>
            <div className="relative z-10 mx-auto flex w-fit rounded-full border border-border p-1 bg-background">
                <button
                    onClick={() => handleSwitch("0")}
                    className={cn(
                        "relative z-10 w-fit sm:h-12 cursor-pointer h-10 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
                        selected === "0"
                            ? "text-primary-foreground"
                            : "text-muted-foreground "
                    )}
                >
                    {selected === "0" && (
                        <motion.span
                            layoutId={"switch"}
                            className="absolute top-0 left-0 sm:h-12 h-10 w-full rounded-full border-4 shadow-sm border-primary/20 bg-primary"
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    )}
                    <span className="relative">Monthly</span>
                </button>

                <button
                    onClick={() => handleSwitch("1")}
                    className={cn(
                        "relative z-10 w-fit cursor-pointer sm:h-12 h-10 flex-shrink-0 rounded-full sm:px-6 px-3 sm:py-2 py-1 font-medium transition-colors",
                        selected === "1"
                            ? "text-primary-foreground"
                            : "text-muted-foreground "
                    )}
                >
                    {selected === "1" && (
                        <motion.span
                            layoutId={"switch"}
                            className="absolute top-0 left-0 sm:h-12 h-10 w-full rounded-full border-4 shadow-sm border-primary/20 bg-primary"
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                    )}
                    <span className="relative flex items-center gap-2">
                        Yearly
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-secondary-foreground">
                            Save 20%
                        </span>
                    </span>
                </button>
            </div>
        </div>
    );
};

export default function PricingSection() {
    const [isYearly, setIsYearly] = useState(false);
    const pricingRef = useRef<HTMLDivElement>(null);

    const revealVariants = {
        visible: (i: number) => ({
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            transition: {
                delay: i * 0.4,
                duration: 0.5,
            },
        }),
        hidden: {
            filter: "blur(10px)",
            y: -20,
            opacity: 0,
        },
    };

    const togglePricingPeriod = (value: string) =>
        setIsYearly(Number.parseInt(value) === 1);

    return (
        <div
            className="px-4 max-w-7xl  mx-auto relative"
            ref={pricingRef}
        >
            <article className="flex sm:flex-row flex-col sm:pb-0 pb-4 sm:items-center items-start justify-between">
                <div className="text-left mb-6">
                    <h2 className="text-4xl font-medium leading-[130%] mb-4">
                        <VerticalCutReveal
                            splitBy="words"
                            staggerDuration={0.15}
                            staggerFrom="first"
                            reverse={true}
                            containerClassName="justify-start"
                            transition={{
                                type: "spring",
                                stiffness: 250,
                                damping: 40,
                                delay: 0, // First element
                            }}
                        >
                            Plans built for brains
                        </VerticalCutReveal>
                    </h2>

                    <TimelineContent
                        as="p"
                        animationNum={0}
                        timelineRef={pricingRef}
                        customVariants={revealVariants}
                        once
                        className="w-[80%]"
                    >
                        Pick what fits now. Upgrade when your memory outgrows your notes.
                    </TimelineContent>
                </div>

                <TimelineContent
                    as="div"
                    animationNum={1}
                    timelineRef={pricingRef}
                    customVariants={revealVariants}
                    once
                >
                    <PricingSwitch onSwitch={togglePricingPeriod} className="shrink-0" />
                </TimelineContent>
            </article>

            <TimelineContent
                as="div"
                animationNum={2}
                timelineRef={pricingRef}
                customVariants={revealVariants}
                once
                className="grid md:grid-cols-3 gap-4 mx-auto sm:p-3 rounded-lg"
            >
                {plans.map((plan, index) => (
                    <TimelineContent
                        as="div"
                        key={plan.name}
                        animationNum={index + 3}
                        timelineRef={pricingRef}
                        customVariants={revealVariants}
                        once
                        className="border shadow-lg shadow-primary/10 rounded-lg"
                    >
                        <Card
                            className={`relative flex-col flex justify-between  ${plan.popular
                                ? "scale-110 ring-2 ring-neutral-900 bg-primary text-secondary-foreground dark:text-secondary"
                                : "border-none shadow-none bg-transparent pt-4 z"
                                }`}
                        >
                            <CardContent className="pt-0">
                                <div className="space-y-2 pb-3">
                                    {plan.popular && (
                                        <div className="pt-4">
                                            <span className="bg-neutral-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                                                Popular
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex items-baseline">
                                        <span className="text-4xl font-semibold ">
                                            $
                                            <NumberFlow
                                                format={{
                                                    currency: "USD",
                                                }}
                                                value={isYearly ? plan.yearlyPrice : plan.price}
                                                className="text-4xl font-semibold"
                                            />
                                        </span>
                                        <span
                                            className={
                                                plan.popular
                                                    ? "ml-1"
                                                    : "ml-1"
                                            }
                                        >
                                            /{isYearly ? "year" : "month"}
                                        </span>
                                    </div>
                                </div>

                                <div className="flex justify-between">
                                    <h3 className="text-3xl font-semibold mb-2">{plan.name}</h3>
                                </div>
                                <p
                                    className={
                                        plan.popular
                                            ? "text-sm mb-4"
                                            : "text-sm mb-4"
                                    }
                                >
                                    {plan.description}
                                </p>

                                <div className="space-y-3 pt-4 border-t border-neutral-200">
                                    <h4 className="font-medium mb-3">
                                        {plan.includes[0]}
                                    </h4>
                                    <ul className="space-y-2 font-semibold">
                                        {plan.includes.slice(1).map((feature, featureIndex) => (
                                            <li key={featureIndex} className="flex items-center">
                                                <span
                                                    className={
                                                        plan.popular
                                                            ? " h-6 w-6 border border-neutral-500 rounded-full grid place-content-center mt-0.5 mr-3"
                                                            : "h-6 w-6 border border-black rounded-full grid place-content-center mt-0.5 mr-3"
                                                    }
                                                >
                                                    <CheckCheck className="h-4 w-4  " />
                                                </span>
                                                <span
                                                    className={
                                                        plan.popular
                                                            ? "text-sm"
                                                            : "text-sm"
                                                    }
                                                >
                                                    {feature}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Link
                                    href="/auth/login"
                                    // variant={plan.buttonVariant}
                                    className={`w-full px-4 py-2 text-xl rounded-xl ${plan.popular
                                        ? "border bg-transparent hover:bg-background hover:text-primary"
                                        : plan.buttonVariant === "outline"
                                            ? "shadow-lg shadow-neutral-900 border border-neutral-700 hover:bg-primary hover:text-secondary-foreground dark:text-secondary "
                                            : "shadow-lg shadow-neutral-900 border border-neutral-700 hover:bg-primary hover:text-secondary-foreground dark:text-secondary "
                                        }`}
                                >
                                    {plan.buttonText}
                                </Link>
                            </CardFooter>
                        </Card>
                    </TimelineContent>
                ))}
            </TimelineContent>
        </div>
    );
}
