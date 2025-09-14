"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const themes = ["light", "dark", "system"] as const;

const ThemeSwitcher = () => {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  const ICON_SIZE = 16;

  // Find the next theme in the cycle
  const getNextTheme = (current: string | undefined) => {
    const idx = themes.indexOf(
      (current as (typeof themes)[number]) || "system"
    );
    return themes[(idx + 1) % themes.length];
  };

  const handleClick = () => {
    setTheme(getNextTheme(theme));
  };

  let Icon;
  if (theme === "light") {
    Icon = <Sun size={ICON_SIZE} className="text-muted-foreground" />;
  } else if (theme === "dark") {
    Icon = <Moon size={ICON_SIZE} className="text-muted-foreground" />;
  } else {
    Icon = <Laptop size={ICON_SIZE} className="text-muted-foreground" />;
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      aria-label="Toggle theme"
    >
      {Icon}
    </Button>
  );
};

export { ThemeSwitcher };
