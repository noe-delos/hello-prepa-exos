"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSidebarStore } from "@/store/sidebar-store";
import { cn } from "@/lib/utils";
import { User } from "@/types";
import { createClient } from "@/utils/supabase/client";
import { useState } from "react";
import { GenerationHistory } from "@/components/history/GenerationHistory";
import { Separator } from "@/components/ui/separator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

interface SidebarProps {
  user: User | null;
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { isCollapsed, toggleSidebar } = useSidebarStore();
  const [isHovering, setIsHovering] = useState(false);

  const navItems = [
    {
      title: "Accueil",
      icon: "majesticons:home",
      href: "/accueil",
    },
    {
      title: "Utilisateurs",
      icon: "solar:users-group-rounded-bold",
      href: "/utilisateurs",
    },
    {
      title: "Profil",
      icon: "mdi:account-circle",
      href: "/profile",
    },
  ];

  // Simplified animation variants
  const sidebarVariants = {
    expanded: { width: 250 },
    collapsed: { width: 70 },
  };

  // Handle sign out
  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  // Handle logo click
  const handleLogoClick = () => {
    router.push("/accueil");
  };

  return (
    <QueryClientProvider client={queryClient}>
      <motion.div
        initial={isCollapsed ? "collapsed" : "expanded"}
        animate={isCollapsed ? "collapsed" : "expanded"}
        variants={sidebarVariants}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className="h-screen gradient-background dark:bg-slate-950 border-r border-slate-100 dark:border-slate-800 flex flex-col"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
      >
        {/* Header with logo and toggle button */}
        <div className="flex items-center justify-between p-4 h-16 dark:border-slate-800">
          {isCollapsed ? (
            // In collapsed mode, show either logo or expand button based on hover state
            <>
              {isHovering ? (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleSidebar}
                  aria-label="Expand sidebar"
                  className="w-full flex justify-center"
                >
                  <Icon icon="mdi-light:chevron-right" width={24} />
                </Button>
              ) : (
                <div
                  className="cursor-pointer w-full flex justify-center"
                  onClick={handleLogoClick}
                >
                  <Image
                    src="/logo.png"
                    alt="Logo"
                    width={40}
                    height={40}
                    className="cursor-pointer transition-all duration-300"
                  />
                </div>
              )}
            </>
          ) : (
            // In expanded mode, show both logo and collapse button
            <>
              <div className="cursor-pointer" onClick={handleLogoClick}>
                <Image
                  src="/logo.png"
                  alt="Logo"
                  width={60}
                  height={40}
                  className="cursor-pointer transition-all duration-300"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleSidebar}
                aria-label="Collapse sidebar"
              >
                <Icon icon="mdi-light:chevron-left" width={24} />
              </Button>
            </>
          )}
        </div>

        {/* Main sidebar content - flex-col with flex-1 to allow for proper stretching */}
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Navigation items */}
          <nav className="p-2 space-y-1 px-3 mt-2">
            <TooltipProvider delayDuration={300}>
              {navItems.map((item) => (
                <div key={item.href}>
                  {isCollapsed ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            "flex items-center justify-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                            pathname === item.href &&
                              "bg-slate-200 dark:bg-slate-800"
                          )}
                        >
                          <Icon
                            icon={item.icon}
                            className={cn(
                              "size-5 text-foreground/50 transition-all duration-300",
                              pathname === item.href && "text-foreground"
                            )}
                          />
                        </Link>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.title}</TooltipContent>
                    </Tooltip>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors",
                        pathname === item.href &&
                          "bg-slate-200 dark:bg-slate-800"
                      )}
                    >
                      <Icon
                        icon={item.icon}
                        className={cn(
                          "size-5 text-foreground/50",
                          pathname === item.href && "text-foreground"
                        )}
                      />
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                        className={cn(
                          "overflow-hidden whitespace-nowrap lowercase transition-all",
                          pathname === item.href && "font-semibold"
                        )}
                      >
                        {item.title}
                      </motion.span>
                    </Link>
                  )}
                </div>
              ))}
            </TooltipProvider>
          </nav>

          <Separator className="my-4" />

          {/* Generation History Section - with relative positioning to allow for fade effect */}
          <div className="flex flex-col flex-1 px-3 overflow-hidden relative">
            {/* Add the history component inside a flex container with overflow handling */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <GenerationHistory user={user} />
            </div>
          </div>
        </div>

        {/* Logout button */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <TooltipProvider delayDuration={300}>
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleSignOut}
                    className="flex items-center justify-center gap-3 px-3 py-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors w-full"
                  >
                    <Icon icon="solar:logout-2-bold-duotone" width={24} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">Déconnexion</TooltipContent>
              </Tooltip>
            ) : (
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors w-full"
              >
                <Icon icon="solar:logout-2-bold-duotone" width={24} />
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="overflow-hidden whitespace-nowrap"
                >
                  Déconnexion
                </motion.span>
              </button>
            )}
          </TooltipProvider>
        </div>
      </motion.div>
    </QueryClientProvider>
  );
}
