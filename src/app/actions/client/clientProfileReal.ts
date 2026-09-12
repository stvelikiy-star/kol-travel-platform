"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth/roles";
import { updateClientProfileFromSupabase } from "@/lib/data/client-profile-supabase";

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function updateClientProfileRealAction(formData: FormData) {
  const client = await requireClient();
  if (!client.ok) {
    redirect("/login?next=%2Fclient%2Fprofile");
  }

  const result = await updateClientProfileFromSupabase({
    fullName: readField(formData, "fullName"),
    locale: readField(formData, "locale"),
    defaultAddress: readField(formData, "defaultAddress"),
    requestId: readField(formData, "requestId")
  });

  if (result.ok) {
    revalidatePath("/client/profile");
    redirect("/client/profile?profile=updated");
  }

  const code = encodeURIComponent(result.code || "profile_failed");
  redirect(`/client/profile?profile=error&code=${code}`);
}