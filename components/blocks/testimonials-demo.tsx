"use client";
import { TestimonialsColumn } from "@/components/blocks/testimonials-columns-1";
import { AnimatedGroup } from "../ui/animated-group";
import { Variants } from "framer-motion";
import { motion } from "motion/react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

const testimonials = [
  {
    text: "I stopped digging through notes. I just ask Loom and boom — it’s there.",
    image: "https://randomuser.me/api/portraits/women/1.jpg",
    name: "Briana Patton",
    role: "Founder",
  },
  {
    text: "Set a reminder once, never missed a beat again. Low effort, high impact.",
    image: "https://randomuser.me/api/portraits/men/2.jpg",
    name: "Bilal Ahmed",
    role: "Product Manager",
  },
  {
    text: "Finally a ‘private by default’ tool that actually respects privacy.",
    image: "https://randomuser.me/api/portraits/women/3.jpg",
    name: "Saman Malik",
    role: "Security Engineer",
  },
  {
    text: "My brain, but with search and superpowers. Big yes.",
    image: "https://randomuser.me/api/portraits/men/4.jpg",
    name: "Omar Raza",
    role: "Solo Dev",
  },
  {
    text: "The recall speed is unreal. I don’t ‘try to remember’ anymore.",
    image: "https://randomuser.me/api/portraits/women/5.jpg",
    name: "Zainab Hussain",
    role: "Designer",
  },
  {
    text: "Set it and forget it — Loom shipped my emails and nudges on time.",
    image: "https://randomuser.me/api/portraits/women/6.jpg",
    name: "Aliza Khan",
    role: "Ops Lead",
  },
  {
    text: "Encrypted, clean, fast. It’s the vibe.",
    image: "https://randomuser.me/api/portraits/men/7.jpg",
    name: "Farhan Siddiqui",
    role: "Engineer",
  },
  {
    text: "I put in messy details, it gives me crisp answers. Love it.",
    image: "https://randomuser.me/api/portraits/women/8.jpg",
    name: "Sana Sheikh",
    role: "Founder",
  },
  {
    text: "Low‑key the most useful app on my phone.",
    image: "https://randomuser.me/api/portraits/men/9.jpg",
    name: "Hassan Ali",
    role: "Student",
  },
];


const firstColumn = testimonials.slice(0, 3);
const secondColumn = testimonials.slice(3, 6);
const thirdColumn = testimonials.slice(6, 9);


export const Testimonials = () => {

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
    <AnimatedGroup variants={transitionVariants as Variants} inView once amount={0.25} className="pb-8 w-full text-center border-none">

      <section className="bg-background my-32 relative">

        <div className="flex flex-col items-center justify-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            viewport={{ once: true }}
            className="flex flex-col items-center justify-center max-w-5xl mx-auto"
          >
            <Link
              href="#link"
              className="hover:bg-background dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-black/5 transition-all duration-300 dark:border-t-white/5 dark:shadow-zinc-950 mb-4">
              <span className="text-foreground text-sm">Real users. Real glow‑ups.</span>
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

            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl font-bold tracking-tighter mt-5">
              People are legit obsessed
            </h2>
            <p className="text-center mt-5 opacity-75">
              Loom AI makes memory management actually effortless.
            </p>
          </motion.div>

          <div className="flex justify-center gap-6 mt-10 [mask-image:linear-gradient(to_bottom,transparent,black_25%,black_75%,transparent)] max-h-[740px] overflow-hidden min-w-full w-full">
            <TestimonialsColumn testimonials={firstColumn} duration={15} />
            <TestimonialsColumn testimonials={secondColumn} className="hidden md:block" duration={19} />
            <TestimonialsColumn testimonials={thirdColumn} className="hidden lg:block" duration={17} />
          </div>
        </div>
      </section>
    </AnimatedGroup>

  );
};