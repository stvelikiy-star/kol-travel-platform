"use server";
import {requireRole} from "@/lib/auth/roles";
import {isAssistantPreviewEnabled} from "@/lib/assistant/preview-gate";
import {findPublicAssistantReply,type AssistantLocale,type AssistantReply} from "@/lib/assistant/public-knowledge";

export async function askPublicAssistant(locale:AssistantLocale,question:string):Promise<AssistantReply>{
  if(!isAssistantPreviewEnabled()) return {kind:"unavailable"};
  const actor=await requireRole(["super_admin","content_manager"]);
  if(!actor.ok) return {kind:"unavailable"};
  return findPublicAssistantReply(locale,question);
}
