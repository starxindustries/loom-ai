import { HeroHeader } from "@/components/blocks/hero-section-1";

export default function BlogsLayout({ children }: { children: React.ReactNode }) {
    return <div>
        <div className="w-full">
            <HeroHeader />
        </div>
        <div className="pt-20">
            {children}
        </div>
    </div>
}