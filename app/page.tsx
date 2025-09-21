"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Clock,
  Shield,
  Globe,
  Star,
  Check,
  Zap,
  Cpu,
  Database,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function MemoryAILanding() {
  const showPaymentToast = () => {
    toast.warning("Coming Soon", {
      description: "Payment integration is coming soon.",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="glass-morphism border-b border-border/50 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <Brain className="h-8 w-8 text-primary glow-effect" />
              <div className="absolute inset-0 h-8 w-8 text-secondary opacity-30 animate-pulse">
                <Brain className="h-8 w-8" />
              </div>
            </div>
            <span className="text-2xl font-bold holographic-text">
              MemoryAI
            </span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <a
              href="#features"
              className="text-muted-foreground hover:text-primary transition-all duration-300 hover:glow-effect"
            >
              Features
            </a>
            <a
              href="#pricing"
              className="text-muted-foreground hover:text-primary transition-all duration-300 hover:glow-effect"
            >
              Pricing
            </a>
            <a
              href="#about"
              className="text-muted-foreground hover:text-primary transition-all duration-300 hover:glow-effect"
            >
              About
            </a>
            <Link href="/auth/login">
              <Button
                variant="outline"
                size="sm"
                className="neon-border hover:bg-primary/20 transition-all duration-300 bg-transparent"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                size="sm"
                className="glow-effect hover:scale-105 transition-all duration-300"
              >
                Get Started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <section className="py-32 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-accent/10"></div>
        <div className="absolute top-20 left-1/4 w-64 h-64 bg-primary/20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-1/4 w-48 h-48 bg-secondary/20 rounded-full blur-3xl animate-pulse delay-1000"></div>

        <div className="container mx-auto max-w-4xl relative z-10">
          <div className="float-effect">
            <h1 className="text-6xl md:text-8xl font-bold text-balance mb-8 holographic-text">
              MemoryAI
            </h1>
          </div>
          <p className="text-2xl md:text-3xl text-primary mb-6 text-balance font-medium">
            Extend your memory, automate your reminders.
          </p>
          <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto text-pretty leading-relaxed">
            MemoryAI helps you remember everything important, manage your
            digital memories, and never miss a task with cutting-edge AI
            technology.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/auth/login">
              <Button
                size="lg"
                className="text-lg px-12 py-6 glow-effect hover:scale-105 transition-all duration-300"
              >
                <Zap className="mr-2 h-5 w-5" />
                Get Started
              </Button>
            </Link>
            <Link href="/auth/login">
              <Button
                variant="outline"
                size="lg"
                className="text-lg px-12 py-6 neon-border hover:bg-primary/20 transition-all duration-300 bg-transparent"
              >
                Watch Demo
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <section id="about" className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-r from-secondary/5 to-accent/5"></div>
        <div className="container mx-auto max-w-4xl text-center relative z-10">
          <Card className="glass-morphism neon-border p-8">
            <CardHeader>
              <CardTitle className="text-4xl font-bold mb-6 holographic-text">
                About MemoryAI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-lg text-muted-foreground text-pretty leading-relaxed">
                MemoryAI provides an AI-powered personal memory assistant that
                helps users store and recall important information, automate
                reminders, and manage digital memories and files. Customers
                learn about us through social media, tech communities, and
                online campaigns. Users can try a free plan or upgrade to paid
                subscription plans for enhanced storage and features.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-4xl font-bold text-center mb-16 holographic-text">
            Core Features
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Card className="glass-morphism neon-border text-center hover:scale-105 transition-all duration-300 group">
              <CardHeader>
                <div className="relative mx-auto mb-4">
                  <Brain className="h-16 w-16 text-primary mx-auto glow-effect" />
                </div>
                <CardTitle className="text-xl text-primary">
                  Store & Recall
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Store and recall memories instantly with AI-powered search and
                  organization.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-morphism neon-border text-center hover:scale-105 transition-all duration-300 group">
              <CardHeader>
                <div className="relative mx-auto mb-4">
                  <Zap className="h-16 w-16 mx-auto text-primary" />
                </div>
                <CardTitle className="text-xl text-primary">
                  Smart Reminders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Automate reminders and tasks with intelligent scheduling and
                  notifications.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-morphism neon-border text-center hover:scale-105 transition-all duration-300 group">
              <CardHeader>
                <div className="relative text-primary mx-auto mb-4">
                  <Shield className="h-16 w-16 mx-auto" />
                </div>
                <CardTitle className="text-xl text-primary">
                  Secure Storage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Securely manage files and data with enterprise-grade
                  encryption and privacy.
                </p>
              </CardContent>
            </Card>

            <Card className="glass-morphism neon-border text-center hover:scale-105 transition-all duration-300 group">
              <CardHeader>
                <div className="relative mx-auto mb-4">
                  <Globe className="h-16 w-16 text-primary mx-auto glow-effect" />
                  {/* <div
                    className="absolute inset-0 h-16 w-16 text-secondary opacity-30 animate-spin group-hover:opacity-60 transition-opacity"
                    style={{ animationDuration: "8s" }}
                  >
                    <Globe className="h-16 w-16" />
                  </div> */}
                </div>
                <CardTitle className="text-xl text-primary">
                  Global Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  Access from anywhere globally with seamless sync across all
                  your devices.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="pricing" className="py-20 px-4 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <h2 className="text-4xl font-bold text-center mb-16 holographic-text">
            Choose Your Plan
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Free Plan */}
            <Card className="glass-morphism border-border/50 hover:scale-105 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-2xl text-primary">Free</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Great for testing, limited usage
                </CardDescription>
                <div className="text-4xl font-bold text-foreground">
                  $0
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-primary glow-effect" />
                  <span className="text-sm">20 Memory Records</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-primary glow-effect" />
                  <span className="text-sm">2 File Records</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full neon-border hover:bg-primary/20 transition-all duration-300 bg-transparent"
                  onClick={showPaymentToast}
                >
                  Subscribe
                </Button>
              </CardFooter>
            </Card>

            {/* Starter Plan */}
            <Card className="glass-morphism border-border/50 hover:scale-105 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-2xl text-secondary">
                  Starter
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Affordable entry-level plan
                </CardDescription>
                <div className="text-4xl font-bold text-foreground">
                  $9
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-secondary glow-effect" />
                  <span className="text-sm">200 Memory Records</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-secondary glow-effect" />
                  <span className="text-sm">10 File Records</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full neon-border hover:bg-secondary/20 transition-all duration-300 bg-transparent"
                  onClick={showPaymentToast}
                >
                  Subscribe
                </Button>
              </CardFooter>
            </Card>

            {/* Pro Plan - Enhanced highlight */}
            <Card className="glass-morphism neon-border relative scale-105 glow-effect">
              <Badge className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-primary text-primary-foreground pulse-neon text-sm px-4 py-1">
                Recommended
              </Badge>
              <CardHeader>
                <CardTitle className="text-2xl holographic-text">Pro</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Best value for regular users
                </CardDescription>
                <div className="text-4xl font-bold holographic-text">
                  $19
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-primary glow-effect" />
                  <span className="text-sm">1,000 Memory Records</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-primary glow-effect" />
                  <span className="text-sm">50 File Records</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full glow-effect hover:scale-105 transition-all duration-300"
                  onClick={showPaymentToast}
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Subscribe
                </Button>
              </CardFooter>
            </Card>

            {/* Pro Plus Plan */}
            <Card className="glass-morphism border-border/50 hover:scale-105 transition-all duration-300">
              <CardHeader>
                <CardTitle className="text-2xl text-accent">Pro Plus</CardTitle>
                <CardDescription className="text-muted-foreground">
                  For power users and small teams
                </CardDescription>
                <div className="text-4xl font-bold text-foreground">
                  $49
                  <span className="text-sm font-normal text-muted-foreground">
                    /month
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-accent glow-effect" />
                  <span className="text-sm">5,000 Memory Records</span>
                </div>
                <div className="flex items-center space-x-3">
                  <Check className="h-5 w-5 text-accent glow-effect" />
                  <span className="text-sm">200 File Records</span>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  className="w-full neon-border hover:bg-accent/20 transition-all duration-300 bg-transparent"
                  onClick={showPaymentToast}
                >
                  Subscribe
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </section>

      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-4xl font-bold mb-12 holographic-text">
            Coming Soon
          </h2>
          <Card className="max-w-2xl mx-auto glass-morphism neon-border hover:scale-105 transition-all duration-300 float-effect">
            <CardHeader>
              <CardTitle className="text-3xl flex items-center justify-center space-x-3">
                <div className="relative">
                  <Star className="h-8 w-8 text-accent glow-effect" />
                  <Star className="absolute inset-0 h-8 w-8 text-primary opacity-30 animate-pulse" />
                </div>
                <span className="holographic-text">Enterprise Mode</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-pretty leading-relaxed text-lg">
                Collaboration, automation, and advanced features for teams and
                enterprises. Enhanced security, team management, and
                enterprise-grade integrations with cutting-edge AI capabilities.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      <footer className="glass-morphism py-16 px-4 border-t border-border/50 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent"></div>
        <div className="container mx-auto max-w-6xl relative z-10">
          <div className="grid md:grid-cols-3 gap-12">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="relative">
                  <Brain className="h-8 w-8 text-primary glow-effect" />
                  <Brain className="absolute inset-0 h-8 w-8 text-secondary opacity-30 animate-pulse" />
                </div>
                <span className="text-2xl font-bold holographic-text">
                  MemoryAI
                </span>
              </div>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Your AI-powered personal memory assistant for the digital age.
                Experience the future of memory management.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-primary mb-6 text-lg">
                Contact
              </h3>
              <Link href="/auth/login">
                <p className="text-muted-foreground text-sm mb-3 hover:text-primary transition-colors cursor-pointer">
                  Email: support@memoryai.com
                </p>
              </Link>
            </div>

            <div>
              <h3 className="font-semibold text-secondary mb-6 text-lg">
                Connect
              </h3>
              <div className="flex space-x-6">
                <Link
                  href="/auth/login"
                  className="text-muted-foreground hover:text-primary transition-all duration-300 hover:glow-effect"
                >
                  Twitter
                </Link>
                <Link
                  href="/auth/login"
                  className="text-muted-foreground hover:text-secondary transition-all duration-300 hover:glow-effect"
                >
                  LinkedIn
                </Link>
                <Link
                  href="/auth/login"
                  className="text-muted-foreground hover:text-accent transition-all duration-300 hover:glow-effect"
                >
                  GitHub
                </Link>
              </div>
            </div>
          </div>

          <div className="border-t border-border/50 mt-12 pt-8 text-center">
            <p className="text-muted-foreground text-sm">
              © 2025 MemoryAI. All rights reserved. | Powered by cutting-edge
              AI technology
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
