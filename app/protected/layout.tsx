"use client";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "../../components/layout/app-sidebar";
import { SiteHeader } from "../../components/layout/site-header";
import React from "react";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider>
      <AppSidebar variant="inset" />
      <SidebarInset className="h-svh md:peer-data-[variant=inset]:h-[calc(100svh-(--spacing(4)))] overflow-hidden">
        <SiteHeader />
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
