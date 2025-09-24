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
} from "lucide-react";

import { CommingSoon } from "./nav-documents";
import { NavMain } from "./nav-main";
import { NavSecondary } from "./nav-secondary";
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

const data = {
  navMain: [
    {
      title: "Memories",
      url: "/protected/memories",
      icon: BrainIcon,
    },
    {
      title: "Files",
      url: "#",
      icon: PaperclipIcon,
    },
    {
      title: "Analytics",
      url: "#",
      icon: BarChartIcon,
    },
  ],
  navClouds: [
    {
      title: "Capture",
      icon: CameraIcon,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: FileTextIcon,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: FileCodeIcon,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "#",
      icon: SettingsIcon,
    },
  ],
  commingSoon: [
    {
      name: "Automations",
      url: "#",
      icon: ZapIcon,
    },
    {
      name: "Reminder",
      url: "#",
      icon: AlertCircleIcon,
    },
    {
      name: "Projects",
      url: "#",
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
                <Link href="/protected">
                  <span className="text-base text-[25px] font-bold ">
                    Loom AI
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent className=" flex-1">
          <NavMain items={data.navMain} />
          <CommingSoon items={data.commingSoon} />
        </SidebarContent>
        <NavSecondary items={data.navSecondary} />
        <SidebarFooter>
          <NavUser user={userInfo} />
        </SidebarFooter>
      </div>
    </Sidebar>
  );
}
