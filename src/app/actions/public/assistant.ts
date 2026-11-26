"use server";
import {findPublicAssistantReply,type AssistantLocale,type AssistantReply} from "@/lib/assistant/public-knowledge";
export async function askPublicAssistant(locale:AssistantLocale,question:string):Promise<AssistantReply>{
 return findPublicAssistantReply(locale,question);
}
