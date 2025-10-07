"use client";

import { PlusCircleIcon, type LucideIcon } from "lucide-react";
import { usePathname } from "next/navigation";

import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import Link from "next/link";

export function NavMain({
  items,
}: {
  items: {
    title: string;
    url: string;
    icon?: LucideIcon;
  }[];
}) {
  const pathname = usePathname();
  const isProtectedPage = pathname === '/protected';

  return (
    <SidebarGroup>
      <SidebarGroupContent className="flex flex-col gap-3">
        <SidebarMenu>
          <Link href="/protected">
            <SidebarMenuItem className="flex items-center gap-2 cursor-pointer">
              <SidebarMenuButton
                tooltip="Quick Create"
                className={'cursor-pointer border border-primary/20'}
              >
                <PlusCircleIcon />
                <span className="">Create New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </Link>
        </SidebarMenu>
        <SidebarMenu className="gap-2">
          {/* <SidebarGroupLabel>Manage Memories</SidebarGroupLabel> */}
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <Link href={item.url}>
                <SidebarMenuButton
                  tooltip={item.title}
                  className={`cursor-pointer ${pathname === item.url ? 'bg-primary text-background hover:bg-primary hover:text-background/90' : ''
                    }`}
                >
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                </SidebarMenuButton>
              </Link>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
