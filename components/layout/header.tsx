/* eslint-disable @next/next/no-img-element */

"use client";

import { User } from "@/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "@radix-ui/react-icons";

interface HeaderProps {
  user: User | null;
}

type ExamType = "sesame" | "tage mage" | "accès";

export function Header({ user }: HeaderProps) {
  const pathname = usePathname();
  const [selectedExam, setSelectedExam] = useState<ExamType>("tage mage");

  // Get user initials for the avatar fallback
  const getInitials = () => {
    if (user?.name && user?.surname) {
      return `${user.name[0]}${user.surname[0]}`.toUpperCase();
    }
    return "U";
  };

  // Exam data with image URLs and availability status
  const exams = [
    {
      name: "sesame" as ExamType,
      imageUrl:
        "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQq8HLmBZuZQFzyre8C_yAP7Jor3MjDv6YMeQ&s",
      available: false,
    },
    {
      name: "tage mage" as ExamType,
      imageUrl:
        "https://allbestapps.fr/img/logo/190/tage-mage-officiel-1904230-1.png",
      available: true,
    },
    {
      name: "accès" as ExamType,
      imageUrl:
        "https://cours-legendre.fr/wp-content/uploads/2024/07/logo-acces-simple-1024x402.png",
      available: false,
    },
  ];

  const selectExam = (exam: ExamType) => {
    if (exams.find((e) => e.name === exam)?.available) {
      setSelectedExam(exam);
    }
  };

  return (
    <header className="h-[4rem] dark:border-slate-800 flex items-center px-6">
      <div className="flex-1">
        {pathname === "/accueil" && (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm focus:outline-none">
              <div className="size-4 relative flex items-center justify-center">
                <img
                  src={
                    exams.find((e) => e.name === selectedExam)?.imageUrl || ""
                  }
                  alt={selectedExam}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <span className="capitalize text-sm">{selectedExam}</span>
              <ChevronDownIcon className="h-4 w-4 text-slate-500" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {exams.map((exam) => (
                <DropdownMenuItem
                  key={exam.name}
                  className={`flex justify-between p-2 ${
                    !exam.available
                      ? "opacity-60 cursor-not-allowed"
                      : "cursor-pointer"
                  }`}
                  disabled={!exam.available}
                  onSelect={() => selectExam(exam.name)}
                >
                  <div className="flex items-center gap-2">
                    <div className="size-4 relative flex items-center justify-center">
                      <img
                        src={exam.imageUrl}
                        alt={exam.name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    <span className="capitalize text-sm">{exam.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedExam === exam.name && exam.available && (
                      <CheckIcon className="h-4 w-4" />
                    )}
                    {!exam.available && (
                      <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-full whitespace-nowrap">
                        Bientôt disponible
                      </span>
                    )}
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

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
