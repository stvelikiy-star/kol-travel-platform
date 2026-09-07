"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireClient } from "@/lib/auth/roles";
import { createClientSupportTicketFromSupabase } from "@/lib/data/client-support-supabase";

function readField(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createSupportTicketRealAction(formData: FormData) {
  const client = await requireClient();
  if (!client.ok) {
    redirect("/login?next=%2Fclient%2Fsupport");
  }

  const result = await createClientSupportTicketFromSupabase({
    category: readField(formData, "category"),
    title: readField(formData, "title"),
    message: readField(formData, "message"),
    requestId: readField(formData, "requestId"),
    relatedOrderId: readField(formData, "relatedOrderId") || null,
    relatedBookingId: readField(formData, "relatedBookingId") || null
  });

  if (result.ok && result.ticketId) {
    revalidatePath("/client/support");
    redirect(`/client/support?support=created&ticket=${encodeURIComponent(result.ticketId)}`);
  }

  const code = encodeURIComponent(result.code || "support_failed");
  redirect(`/client/support?support=error&code=${code}`);
}