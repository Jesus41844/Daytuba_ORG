"use client";

import { useTransition } from "react";
import { login as loginAction, register as registerAction } from "./actions";
import type { LoginInput, RegisterInput } from "@/lib/validations";

export function useLogin() {
  const [pending, startTransition] = useTransition();

  function login(data: LoginInput) {
    return new Promise<Awaited<ReturnType<typeof loginAction>>>((resolve) => {
      startTransition(async () => {
        const result = await loginAction(data.email, data.password);
        resolve(result);
      });
    });
  }

  return { login, pending };
}

export function useRegister() {
  const [pending, startTransition] = useTransition();

  function register(data: RegisterInput) {
    return new Promise<Awaited<ReturnType<typeof registerAction>>>(
      (resolve) => {
        startTransition(async () => {
          const result = await registerAction(
            data.displayName,
            data.email,
            data.password
          );
          resolve(result);
        });
      }
    );
  }

  return { register, pending };
}
