import { HeroHeader } from "@/components/blocks/hero-section-1";
import { SignUpForm } from "@/components/forms/sign-up-form";

export default function Page() {
  return (
    <div>
      <HeroHeader />
      <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-xl">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}
