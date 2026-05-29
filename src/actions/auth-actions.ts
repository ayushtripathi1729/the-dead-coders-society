"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";

export async function adminSignIn(formData: FormData) {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/controlroomadmin",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect("/controlroomadmin?error=1");
    }
    throw error;
  }
}

export async function adminSignOut() {
  await signOut({ redirectTo: "/controlroomadmin" });
  redirect("/controlroomadmin");
}
