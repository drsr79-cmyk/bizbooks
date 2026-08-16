/**
 * Company access guards.
 *
 * Central place for "is this caller allowed to touch this row?". Procedures
 * that accept a raw entity id must resolve the owning company from the *stored
 * row* and check membership against that — never against a companyId supplied
 * by the client, which the caller controls and can point at their own company.
 */

import { TRPCError } from "@trpc/server";
import * as db from "./db";

const NO_COMPANY_ACCESS = "You do not have access to this company";

/**
 * Assert the caller is a member of `companyId`.
 * Returns their member role so callers can layer a stricter tier on top
 * (e.g. `if (role !== "owner")`).
 */
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

/**
 * Load a document and assert the caller belongs to its owning company.
 * Returns the row so callers do not need a second fetch.
 */
export async function requireDocumentAccess(
  documentId: number,
  userId: number
) {
  const doc = await db.getDocumentById(documentId);
  if (!doc) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
  }
  await requireCompanyAccess(doc.companyId, userId);
  return doc;
}

/**
 * Load a transaction and assert the caller belongs to its owning company.
 * Returns the row so callers do not need a second fetch.
 */
export async function requireTransactionAccess(
  transactionId: number,
  userId: number
) {
  const txn = await db.getTransactionById(transactionId);
  if (!txn) {
    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Transaction not found",
    });
  }
  await requireCompanyAccess(txn.companyId, userId);
  return txn;
}
