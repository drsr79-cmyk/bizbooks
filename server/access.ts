/**
 * Company access guards.
 *
 * Procedures that accept an entity id must resolve the owning company from the
 * stored row and authorize against that company, never one supplied by the
 * client.
 */

import { TRPCError } from "@trpc/server";
import * as db from "./db";

const NO_COMPANY_ACCESS = "You do not have access to this company";

export async function requireCompanyAccess(
  companyId: number,
  userId: number
): Promise<string> {
  const role = await db.getMemberRole(companyId, userId);
  if (!role) {
    throw new TRPCError({ code: "FORBIDDEN", message: NO_COMPANY_ACCESS });
  }
  return role;
}

export async function requireConversationAccess(
  conversationId: number,
  userId: number
) {
  const conversation = await db.getConversationById(conversationId);
  if (!conversation) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Conversation not found",
    });
  }
  if (conversation.userId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have access to this conversation",
    });
  }
  await requireCompanyAccess(conversation.companyId, userId);
  return conversation;
}
