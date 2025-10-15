import type { Metadata } from "next";
import { Montserrat } from "next/font/google";
import { ThemeProvider } from "next-themes";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/common/error-boundary";
import React from "react";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: {
    default: "Loom AI Memory - AI Powered Personal Memory Assistant",
    template: "%s | Loom AI Memory"
  },
  description: "Loom AI Memory is an AI powered personal memory assistant for the digital age. Organize, remember, and access your digital memories with advanced AI technology.",
  keywords: [
    "AI memory assistant",
    "personal memory",
    "digital organization",
    "AI productivity",
    "memory management",
    "AI assistant",
    "digital memories",
    "productivity tool"
  ],
  authors: [{ name: "Loom AI Team" }],
  creator: "Loom AI",
  publisher: "Loom AI",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: defaultUrl,
    title: "Loom AI Memory - AI Powered Personal Memory Assistant",
    description: "Loom AI Memory is an AI powered personal memory assistant for the digital age. Organize, remember, and access your digital memories with advanced AI technology.",
    siteName: "Loom AI Memory",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Loom AI Memory - AI Powered Personal Memory Assistant",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Loom AI Memory - AI Powered Personal Memory Assistant",
    description: "Loom AI Memory is an AI powered personal memory assistant for the digital age. Organize, remember, and access your digital memories with advanced AI technology.",
    images: ["/og-image.png"],
    creator: "@loomai",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_VERIFICATION_ID,
  },
};

const geistSans = Montserrat({
  variable: "--font-montserrat-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;

}>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Loom AI Memory",
    "description": "AI powered personal memory assistant for the digital age",
    "url": defaultUrl,
    "applicationCategory": "ProductivityApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "author": {
      "@type": "Organization",
      "name": "Loom AI"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Loom AI"
    }
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//fonts.googleapis.com" />
        <link rel="dns-prefetch" href="//fonts.gstatic.com" />
      </head>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <ErrorBoundary>
            <NextTopLoader color="#1ca04c" height={4} />
            {children}
            <Toaster />
          </ErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  );
}
