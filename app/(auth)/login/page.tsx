"use client";

/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react/no-unescaped-entities */

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import Image from "next/image";
import { curly } from "@/lib/utils";
import { login } from "./actions";
import { Icon } from "@iconify/react";
import { motion } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const checkUser = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        router.push("/accueil");
      }
    };

    checkUser();
  }, [router]);

  const handleLogin = async () => {
    setIsLoading(true);
    setError(null);

    if (!email || !password) {
      setError("Email et mot de passe requis");
      setIsLoading(false);
      return;
    }

    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("password", password);

      const result = await login(formData);

      if (result?.error) {
        setError(result.error);
        setIsLoading(false);
      }
    } catch (err) {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: any) => {
    if (e.key === "Enter") {
      handleLogin();
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  return (
    <div className="flex flex-col md:flex-row min-h-screen w-full">
      <div className="w-full md:w-1/2 flex items-center justify-center p-4 md:p-0">
        <div className="w-full md:w-4/5 aspect-square bg-[#FFE245]/50 relative rounded-[1.5rem] overflow-hidden">
          <div className="absolute top-6 left-6 z-10">
            <Image
              src="/logo.png"
              alt="Company logo"
              width={80}
              height={80}
              className="object-contain"
            />
          </div>

          <Image
            src="/login.png"
            alt="Login illustration"
            width={500}
            height={200}
            className="absolute -bottom-2 right-0 opacity-75 max-w-[80%] md:max-w-full"
          />

          <div className="absolute bottom-0 left-0 w-full h-[40%] rounded-[1.5rem] bg-gradient-to-t from-black/80 to-transparent"></div>

          <div className="absolute bottom-0 left-0 p-4 md:p-6 z-10 text-white">
            <h2 className="text-2xl md:text-[2rem] font-bold mb-1 flex flex-row items-center gap-2">
              Les fugues sont-elles des préludes ?
              <Icon
                icon="mingcute:sparkles-fill"
                className="text-white"
                width={28}
              />
            </h2>
            <p className="text-xs md:text-sm pt-2">
              Votre outil interne d'atomisation de la concurence.
            </p>
          </div>
        </div>
      </div>

      <div className="w-full md:w-1/2 flex items-center justify-center px-4 py-8 md:px-14">
        <div className="w-full max-w-md md:w-4/5 flex flex-col">
          <div className="text-center mb-6 md:mb-8 relative">
            <div className="absolute left-1/2 top-[30%;] -translate-x-1/2 -translate-y-1/2 w-52 h-12 bg-[#FFE245] -rotate-1 z-0"></div>
            <h1 className="text-[2rem] font-normal mb-8 relative z-10">
              Bienvenue !
            </h1>
            <p className="text-sm text-gray-400">
              Entrez votre email et mot de passe pour accéder à votre compte
            </p>
          </div>

          <div className="space-y-4 md:space-y-6">
            <div className="space-y-3 md:space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Entrez votre adresse e-mail"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="h-12 px-4 bg-gray-100 font-light placeholder:text-zinc-400 border-0 rounded-lg text-base focus:ring-2 focus:ring-yellow-400"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-sm font-medium">
                  Mot de passe
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Entrez votre mot de passe"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="h-12 px-4 bg-gray-100 font-light placeholder:text-zinc-400 border-0 rounded-lg text-base focus:ring-2 focus:ring-yellow-400 pr-10"
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                  >
                    <Icon
                      icon={showPassword ? "mdi:eye-off" : "mdi:eye"}
                      className="w-5 h-5"
                    />
                  </button>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  id="remember"
                  type="checkbox"
                  className="h-4 w-4 rounded border-gray-300 text-yellow-500 focus:ring-yellow-400"
                />
                <label
                  htmlFor="remember"
                  className="ml-2 block text-xs text-gray-700"
                >
                  Se souvenir de moi
                </label>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="text-red-500 text-sm mt-2"
              >
                Erreur lors de la connexion
              </motion.div>
            )}

            <Button
              className="w-full h-11 bg-black hover:bg-gray-800 text-white text-base rounded-lg"
              loading={isLoading}
              onClick={handleLogin}
            >
              Se connecter
            </Button>
          </div>

          <div className="text-center text-sm text-gray-500 mt-8 md:mt-12">
            ©Hello prepa. Tous droits réservés.
          </div>
        </div>
      </div>
    </div>
  );
}
