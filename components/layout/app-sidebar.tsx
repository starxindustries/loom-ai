"use client";
import * as React from "react";
import {
  BarChartIcon,
  CameraIcon,
  FileCodeIcon,
  FileTextIcon,
  FolderIcon,
  SettingsIcon,
  BrainIcon,
  PaperclipIcon,
  AlertCircleIcon,
  ZapIcon,
  ArrowUp01Icon,
} from "lucide-react";

import { CommingSoon } from "./nav-documents";
import { NavMain } from "./nav-main";
import { motion } from "framer-motion";
import { NavUser } from "./nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

const data = {
  navMain: [
    {
      title: "Memories",
      url: "/protected/memories",
      icon: BrainIcon,
    },
    {
      title: "Files",
      url: "/protected/files",
      icon: PaperclipIcon,
    },
    {
      title: "Analytics",
      url: "/protected/analytics",
      icon: BarChartIcon,
    },
    {
      title: "Automations",
      url: "/protected/automations",
      icon: ZapIcon,
    },
    {
      title: "Reminder",
      url: "/protected/remainder",
      icon: AlertCircleIcon,
    },
    {
      title: "Projects",
      url: "/protected/projects",
      icon: FolderIcon,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [userInfo, setUserInfo] = useState<{
    name: string;
    email: string;
    avatar?: string;
  }>({
    name: "Loading..",
    email: "Loading..",
    avatar: "L",
  });

  useEffect(() => {
    const supabase = createClient();

    const mapFromMeta = (email: string | null, meta: any = {}) => {
      const safeEmail = email || "";
      const name = meta.full_name || meta.name || meta.user_name || safeEmail;
      const avatar = meta.avatar_url || meta.picture || undefined;
      return { name, email: safeEmail, avatar };
    };

    const loadFromSession = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const u = data?.session?.user;
        if (u) {
          setUserInfo(mapFromMeta(u.email, u.user_metadata));
        }
      } catch (error) {
        console.log(error);
      }
    };

    // 1) Immediate, cached session read (no network)
    loadFromSession();

    // 2) Keep user info fresh if auth state changes
    supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user;
      if (u) {
        setUserInfo(mapFromMeta(u.email, u.user_metadata));
      }
    });
  }, []);

  return (
    <Sidebar collapsible="offcanvas" className="h-screen" {...props}>
      <div className="flex h-full flex-col justify-between">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="data-[slot=sidebar-menu-button]:p-1.5! hover:bg-transparent hover:text-default"
              >
                {/* make the logo black and white */}
                <Link href="/protected" className="flex items-center gap-2 h-full group">
                  <motion.div
                    initial={false}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6, ease: "easeInOut" }}
                  >
                    <Image
                      src="/assests/logo/logo.png"
                      alt="logo"
                      width={40}
                      height={40}
                      className="grayscale invert"
                      quality={100}
                      priority
                      unoptimized
                    />
                  </motion.div>
                  <div className="flex flex-col">
                    <span className="text-lg font-bold">
                      Loom AI
                    </span>
                    <p className="text-[10px] text-muted-foreground">End to End Encrypted.</p>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className=" flex-1 gap-0 p-0 m-0">
          <NavMain items={data.navMain} />
          {/* <CommingSoon items={data.commingSoon} /> */}
        </SidebarContent>
        {/* <NavSecondary items={data.navSecondary} /> */}
        <SidebarFooter>
          <NavUser user={userInfo} />
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
