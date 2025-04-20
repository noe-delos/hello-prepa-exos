"use client";

import { User } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface HeaderProps {
  user: User | null;
}

export function Header({ user }: HeaderProps) {
  // Get user initials for the avatar fallback
  const getInitials = () => {
    if (user?.name && user?.surname) {
      return `${user.name[0]}${user.surname[0]}`.toUpperCase();
    }
    return "U";
  };

  return (
    <header className="h-[4rem] dark:border-slate-800 flex items-center justify-end px-6">
      <div className="flex items-center gap-4">
        {user && (
          <div className="flex items-center gap-2">
            <Avatar>
              {user.picture_url ? <AvatarImage src={user.picture_url} /> : null}
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium">{`${user.name} ${user.surname}`}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">
                {user.role}
              </p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
