"use client";

import { signIn } from "next-auth/react";

export function SignInAction() {
  return (
    <button
      className="button button-primary"
      onClick={() => void signIn("google", { callbackUrl: "/today" })}
    >
      Continue with Google
    </button>
  );
}
