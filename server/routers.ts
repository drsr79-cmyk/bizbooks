import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import * as db from "./db";
import { storagePut } from "./storage";
import { invokeLLM } from "./_core/llm";
import { getAdvisorSystemPrompt } from "./advisorPrompts";
import { nanoid } from "nanoid";
import { extractLLMContent, parseLLMJson } from "./llmHelper";
import { ADVISOR_NAME_ERROR, ADVISOR_NAME_MAX_LENGTH, ADVISOR_NAME_PATTERN, ADVISOR_TYPES, resolveAdvisorName } from "@shared/types";
import type { AdvisorType } from "@shared/types";

// ─── Auth Router ─────────────────────────────────────────────────────
const authRouter = router({
  me: publicProcedure.query(opts => opts.ctx.user),
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),
});

// ─── Onboarding Router ──────────────────────────────────────────────
const onboardingRouter = router({
  updateProfile: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      icNumber: z.string().min(1),
      phone: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await db.updateUserProfile(ctx.user.id, {
        name: input.name,
        icNumber: input.icNumber,
        phone: input.phone,
      });
      return { success: true };
    }),

  completeOnboarding: protectedProcedure.mutation(async ({ ctx }) => {
    await db.updateUserProfile(ctx.user.id, { onboarded: true });
    return { success: true };
  }),
});

// ─── Company Router ─────────────────────────────────────────────────
const companyRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    return db.getUserCompanies(ctx.user.id);
  }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const company = await db.getCompanyById(input.id);
      if (!company) throw new TRPCError({ code: "NOT_FOUND", message: "Company not found" });
      return company;
    }),

  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      companyType: z.enum(["enterprise", "plt", "sdn_bhd", "bhd"]),
      ssmNumber: z.string().min(1),
      taxNumber: z.string().optional(),
      ownerName: z.string().optional(),
      ownerIc: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const companyId = await db.createCompany({ ...input, createdBy: ctx.user.id });
      await db.addCompanyMember({
        companyId,
        userId: ctx.user.id,
        memberRole: "owner",
        accessLevel: "full",
        permissions: JSON.stringify(["all"]),
      });
      await db.seedDefaultAccounts(companyId);
      return { id: companyId };
    }),

  getMembers: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (!role) throw new TRPCError({ code: "FORBIDDEN" });
      return db.getCompanyMembers(input.companyId);
    }),

  addMember: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      userEmail: z.string().email(),
      memberRole: z.enum(["owner", "staff"]),
      accessLevel: z.enum(["full", "limited"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerRole = await db.getMemberRole(input.companyId, ctx.user.id);
      if (callerRole !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can add members" });

      const targetUser = await db.getUserByEmail(input.userEmail);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "No user found with that email. They must sign up first." });

      const existing = await db.getMemberByCompanyAndUser(input.companyId, targetUser.id);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "This user is already a member of the company" });

      await db.addCompanyMember({
        companyId: input.companyId,
        userId: targetUser.id,
        memberRole: input.memberRole,
        accessLevel: input.accessLevel,
        permissions: JSON.stringify(input.memberRole === "owner" ? ["all"] : ["upload", "view_own"]),
      });

      return { success: true, userName: targetUser.name };
    }),

  updateMember: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      companyId: z.number(),
      memberRole: z.enum(["owner", "staff"]).optional(),
      accessLevel: z.enum(["full", "limited"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerRole = await db.getMemberRole(input.companyId, ctx.user.id);
      if (callerRole !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can update members" });

      const updateData: any = {};
      if (input.memberRole) {
        updateData.memberRole = input.memberRole;
        updateData.permissions = JSON.stringify(input.memberRole === "owner" ? ["all"] : ["upload", "view_own"]);
      }
      if (input.accessLevel) updateData.accessLevel = input.accessLevel;

      await db.updateCompanyMember(input.memberId, updateData);
      return { success: true };
    }),

  removeMember: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      companyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const callerRole = await db.getMemberRole(input.companyId, ctx.user.id);
      if (callerRole !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can remove members" });
      await db.removeCompanyMember(input.memberId);
      return { success: true };
    }),

  getChartOfAccounts: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return db.getChartOfAccounts(input.companyId);
    }),
});

// ─── Document Router ────────────────────────────────────────────────
const documentRouter = router({
  upload: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      docType: z.enum(["receipt", "invoice", "bank_statement", "credit_card_statement", "income_statement", "other"]),
      fileName: z.string(),
      fileBase64: z.string(),
      mimeType: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this company" });

      const fileBuffer = Buffer.from(input.fileBase64, "base64");
      const fileKey = `docs/${input.companyId}/${nanoid()}-${input.fileName}`;
      const { url } = await storagePut(fileKey, fileBuffer, input.mimeType);

      const docId = await db.createDocument({
        companyId: input.companyId,
        uploadedBy: ctx.user.id,
        docType: input.docType,
        fileName: input.fileName,
        fileUrl: url,
        fileKey,
        mimeType: input.mimeType,
        status: "processing",
      });

      // Fire-and-forget: auto-categorize ALL uploaded documents
      processDocumentAsync(docId, url, input.docType, input.fileName, input.companyId, input.mimeType).catch(err => {
        console.error("[AutoCategorize] Error:", err);
      });

      return { id: docId, url };
    }),

  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      docType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (!role) throw new TRPCError({ code: "FORBIDDEN" });
      return db.getDocuments(input.companyId, input.docType);
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getDocumentById(input.id);
    }),

  processWithOCR: protectedProcedure
    .input(z.object({ documentId: z.number() }))
    .mutation(async ({ input }) => {
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      await db.updateDocument(doc.id, { status: "processing" });

      try {
        // Delete any previously auto-created transactions for this document
        await db.deleteTransactionsByDocumentId(doc.id);

        const ocrData = await extractDocumentData(doc.fileUrl, doc.docType, doc.fileName, doc.mimeType ?? "application/octet-stream");
        
        if (!ocrData) {
          await db.updateDocument(doc.id, { status: "error", clarificationNote: "AI could not process this document. Please try again." });
          return { success: false, ocrData: null, needsClarification: false };
        }
        
        const needsClarification = Array.isArray(ocrData.clarificationNeeded) && ocrData.clarificationNeeded.length > 0;

        await db.updateDocument(doc.id, {
          ocrText: ocrData.extractedText ?? "",
          ocrData: ocrData,
          status: needsClarification ? "needs_clarification" : "processed",
          clarificationNote: needsClarification
            ? formatBookkeeperClarification(ocrData.clarificationNeeded, doc.fileName)
            : null,
        });

        // For receipts/invoices: auto-create a single transaction
        if ((doc.docType === "receipt" || doc.docType === "invoice" || doc.docType === "other") && ocrData.total && ocrData.total > 0) {
          await db.createTransaction({
            companyId: doc.companyId,
            documentId: doc.id,
            date: ocrData.date ? new Date(ocrData.date) : new Date(),
            description: ocrData.vendor || doc.fileName,
            amount: ocrData.total.toFixed(2),
            transactionType: doc.docType === "invoice" ? "credit" : "debit",
            category: ocrData.suggestedCategory || (doc.docType === "receipt" ? "Miscellaneous Expenses" : "Sales Revenue"),
            autoCategory: ocrData.suggestedCategory || null,
            manualOverride: false,
          });
        }

        // For bank/credit card statements: create multiple transactions
        if ((doc.docType === "bank_statement" || doc.docType === "credit_card_statement") && ocrData.transactions && ocrData.transactions.length > 0) {
          const txData = ocrData.transactions.map((tx: any) => ({
            companyId: doc.companyId,
            documentId: doc.id,
            date: tx.date ? new Date(tx.date) : new Date(),
            description: tx.description,
            amount: Math.abs(tx.amount).toFixed(2),
            transactionType: tx.type as "debit" | "credit",
            category: tx.category,
            autoCategory: tx.category,
            autoCategoryConfidence: (tx.confidence ?? 80).toFixed(2),
            manualOverride: false,
          }));
          await db.createTransactionsBatch(txData);
        }

        return { success: true, ocrData, needsClarification };
      } catch (error: any) {
        console.error("[processWithOCR] Failed:", error.message);
        await db.updateDocument(doc.id, { status: "error", clarificationNote: error.message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "OCR processing failed" });
      }
    }),

  respondToClarification: protectedProcedure
    .input(z.object({
      documentId: z.number(),
      response: z.string(),
    }))
    .mutation(async ({ input }) => {
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      // Re-process with the user's clarification
      await db.updateDocument(input.documentId, { status: "processing" });

      try {
        // Delete any previously auto-created transactions for this document
        await db.deleteTransactionsByDocumentId(input.documentId);

        const result = await reCategorizeWithClarification(doc, input.response);
        const needsClarification = result?.clarificationNeeded?.length > 0;

        await db.updateDocument(input.documentId, {
          ocrText: result?.extractedText ?? (doc.ocrText || ""),
          ocrData: result,
          status: needsClarification ? "needs_clarification" : "processed",
          clarificationNote: needsClarification
            ? formatBookkeeperClarification(result.clarificationNeeded, doc.fileName)
            : `Clarified and processed. User response: ${input.response}`,
        });

        // Create transaction from clarified data
        if (result?.total && result.total > 0) {
          await db.createTransaction({
            companyId: doc.companyId,
            documentId: doc.id,
            date: result.date ? new Date(result.date) : new Date(),
            description: result.vendor || doc.fileName,
            amount: result.total.toFixed(2),
            transactionType: doc.docType === "invoice" ? "credit" : "debit",
            category: result.suggestedCategory || "Miscellaneous Expenses",
            autoCategory: result.suggestedCategory || null,
            manualOverride: false,
          });
        }

        // Also create transactions from individual items if it's a statement
        if (result?.transactions && result.transactions.length > 0) {
          const txData = result.transactions.map((tx: any) => ({
            companyId: doc.companyId,
            documentId: doc.id,
            date: tx.date ? new Date(tx.date) : new Date(),
            description: tx.description,
            amount: Math.abs(tx.amount).toFixed(2),
            transactionType: tx.type as "debit" | "credit",
            category: tx.category,
            autoCategory: tx.category,
            autoCategoryConfidence: (tx.confidence ?? 80).toFixed(2),
            manualOverride: false,
          }));
          if (txData.length > 0) {
            await db.createTransactionsBatch(txData);
          }
        }

        return { success: true };
      } catch (err: any) {
        await db.updateDocument(input.documentId, {
          status: "error",
          clarificationNote: `Re-processing failed: ${err.message}`,
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Re-processing failed" });
      }
    }),
  reprocessAll: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (!role || role === "staff") throw new TRPCError({ code: "FORBIDDEN" });

      // Find all documents that are processed but have no ocrData, or are in error/pending state
      const allDocs = await db.getDocuments(input.companyId);
      const failedDocs = allDocs.filter(d => 
        d.status === "error" || 
        d.status === "pending" || 
        (d.status === "processed" && !d.ocrData)
      );

      let reprocessed = 0;
      for (const doc of failedDocs) {
        await db.updateDocument(doc.id, { status: "processing" });
        processDocumentAsync(doc.id, doc.fileUrl, doc.docType, doc.fileName, doc.companyId, doc.mimeType ?? "application/octet-stream").catch(err => {
          console.error(`[ReprocessAll] Error for doc ${doc.id}:`, err.message);
        });
        reprocessed++;
      }

      return { reprocessed, total: failedDocs.length };
    }),
});

// ─── Bookkeeper Clarification Formatter ─────────────────────────────
function formatBookkeeperClarification(issues: string[], fileName: string): string {
  const intro = `Hi there! I'm Sarah, your bookkeeper. I've been going through "${fileName}" and I need a bit of help to make sure everything is recorded correctly.\n\n`;
  const questions = issues.map((issue, i) => `${i + 1}. ${issue}`).join("\n");
  const outro = "\n\nCould you please clarify these for me? I want to make sure your books are spot-on! 📋";
  return intro + questions + outro;
}

// ─── Auto-categorization helper (fire-and-forget) ───────────────────
async function extractDocumentData(fileUrl: string, docType: string, fileName: string, mimeType: string) {
  const isImage = mimeType.startsWith("image/");
  const isPdf = mimeType === "application/pdf";
  const isText = mimeType.startsWith("text/") || mimeType === "application/csv" || fileName.endsWith(".csv") || fileName.endsWith(".txt");

  const systemPrompt = `You are Sarah, a Senior Bookkeeper and OCR/document analysis expert for Malaysian businesses. Extract all text and structured data from the uploaded document. You are meticulous and thorough.

For receipts and invoices, return:
{ "extractedText": "full text", "vendor": "vendor name", "date": "YYYY-MM-DD", "total": number, "currency": "MYR", "items": [{"description": "item", "amount": number}], "taxAmount": number, "invoiceNumber": "if applicable", "documentType": "receipt|invoice|statement", "suggestedCategory": "best category from: Sales Revenue, Service Revenue, Cost of Goods Sold, Salaries & Wages, Rent & Utilities, Office Supplies, Marketing & Advertising, Professional Fees, Travel & Entertainment, Insurance, Depreciation, Interest Expense, Bank Charges, Tax Payment, Miscellaneous Expenses, Other Income, Other Expense", "clarificationNeeded": [], "transactions": null }

For bank/credit card statements, extract EVERY transaction line and return:
{ "extractedText": "summary", "vendor": null, "date": null, "total": null, "currency": "MYR", "items": [], "taxAmount": null, "invoiceNumber": null, "documentType": "statement", "suggestedCategory": null, "clarificationNeeded": [], "transactions": [{"date": "YYYY-MM-DD", "description": "original description", "amount": number (positive), "type": "debit|credit", "category": "best category", "confidence": 0-100}] }

IMPORTANT RULES:
- If any field is unclear, blurry, or ambiguous, set it to null and add a SPECIFIC question to "clarificationNeeded" array
- Be specific in your questions, e.g. "The receipt shows RM450 but the vendor name is unclear. Could you confirm who this payment was made to?"
- For statements, if a transaction description is ambiguous, still categorize it with your best guess but set confidence below 60 and add to clarificationNeeded
- Always extract the FULL text content you can read
- For Malaysian receipts, look for SST registration numbers, tax invoice numbers, and GST/SST amounts`;

  const messages: any[] = [{ role: "system", content: systemPrompt }];

  if (isImage) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: `Please extract and categorize this ${docType} document: ${fileName}` },
        { type: "image_url", image_url: { url: fileUrl, detail: "high" } }
      ]
    });
  } else if (isPdf) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: `Please extract and categorize this ${docType} document: ${fileName}` },
        { type: "file_url", file_url: { url: fileUrl, mime_type: "application/pdf" } }
      ]
    });
  } else {
    // For text/CSV files, fetch the content and send as text
    let textContent = "";
    try {
      const response = await fetch(fileUrl);
      textContent = await response.text();
    } catch (e) {
      textContent = "[Could not read file content]";
    }
    messages.push({
      role: "user",
      content: `Please extract and categorize this ${docType} document: ${fileName}\n\nFile content:\n${textContent.slice(0, 15000)}`
    });
  }

  const result = await invokeLLM({
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ocr_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            extractedText: { type: "string" },
            vendor: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
            total: { type: ["number", "null"] },
            currency: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" }
                },
                required: ["description", "amount"],
                additionalProperties: false,
              }
            },
            taxAmount: { type: ["number", "null"] },
            invoiceNumber: { type: ["string", "null"] },
            documentType: { type: "string" },
            suggestedCategory: { type: ["string", "null"] },
            clarificationNeeded: {
              type: "array",
              items: { type: "string" }
            },
            transactions: {
              type: ["array", "null"],
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  description: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string" },
                  category: { type: "string" },
                  confidence: { type: "number" }
                },
                required: ["date", "description", "amount", "type", "category", "confidence"],
                additionalProperties: false,
              }
            }
          },
          required: ["extractedText", "vendor", "date", "total", "currency", "items", "taxAmount", "invoiceNumber", "documentType", "suggestedCategory", "clarificationNeeded", "transactions"],
          additionalProperties: false,
        }
      }
    }
  });

  const parsed = parseLLMJson(result, null);
  if (parsed) {
    console.log(`[extractDocumentData] Success: txns=${parsed.transactions?.length ?? 0}, vendor=${parsed.vendor ?? 'N/A'}`);
  } else {
    console.error(`[extractDocumentData] Failed to parse LLM response for ${fileName}`);
  }
  return parsed;
}

async function reCategorizeWithClarification(doc: any, userResponse: string) {
  const previousData = doc.ocrData as any;
  const isImage = (doc.mimeType ?? "").startsWith("image/");
  const isPdf = (doc.mimeType ?? "") === "application/pdf";

  const systemPrompt = `You are Sarah, a Senior Bookkeeper. You previously analyzed a document and had some questions. The user has now provided clarification. Please re-analyze and provide the complete categorized data.

Previous analysis: ${JSON.stringify(previousData)}
Previous questions: ${doc.clarificationNote}
User's clarification: ${userResponse}

Now provide the complete, corrected analysis in the same JSON format. If you still have questions, add them to clarificationNeeded. Otherwise, leave clarificationNeeded as an empty array.`;

  const messages: any[] = [{ role: "system", content: systemPrompt }];

  if (isImage) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: `Re-analyze with clarification: ${userResponse}` },
        { type: "image_url", image_url: { url: doc.fileUrl, detail: "high" } }
      ]
    });
  } else if (isPdf) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: `Re-analyze with clarification: ${userResponse}` },
        { type: "file_url", file_url: { url: doc.fileUrl, mime_type: "application/pdf" } }
      ]
    });
  } else {
    messages.push({
      role: "user",
      content: `Re-analyze with clarification: ${userResponse}`
    });
  }

  const result = await invokeLLM({
    messages,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "ocr_result",
        strict: true,
        schema: {
          type: "object",
          properties: {
            extractedText: { type: "string" },
            vendor: { type: ["string", "null"] },
            date: { type: ["string", "null"] },
            total: { type: ["number", "null"] },
            currency: { type: "string" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  amount: { type: "number" }
                },
                required: ["description", "amount"],
                additionalProperties: false,
              }
            },
            taxAmount: { type: ["number", "null"] },
            invoiceNumber: { type: ["string", "null"] },
            documentType: { type: "string" },
            suggestedCategory: { type: ["string", "null"] },
            clarificationNeeded: {
              type: "array",
              items: { type: "string" }
            },
            transactions: {
              type: ["array", "null"],
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  description: { type: "string" },
                  amount: { type: "number" },
                  type: { type: "string" },
                  category: { type: "string" },
                  confidence: { type: "number" }
                },
                required: ["date", "description", "amount", "type", "category", "confidence"],
                additionalProperties: false,
              }
            }
          },
          required: ["extractedText", "vendor", "date", "total", "currency", "items", "taxAmount", "invoiceNumber", "documentType", "suggestedCategory", "clarificationNeeded", "transactions"],
          additionalProperties: false,
        }
      }
    }
  });

  const parsed = parseLLMJson(result, null);
  if (parsed) {
    console.log(`[reCategorize] Success: txns=${parsed.transactions?.length ?? 0}`);
  } else {
    console.error(`[reCategorize] Failed to parse LLM response`);
  }
  return parsed;
}

async function processDocumentAsync(docId: number, fileUrl: string, docType: string, fileName: string, companyId: number, mimeType: string) {
  const MAX_RETRIES = 2;
  let ocrData: any = null;
  
  try {
    console.log(`[AutoCategorize] Processing doc ${docId}: ${fileName} (${mimeType})`);
    
    // Retry up to MAX_RETRIES times if extraction returns null
    for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
      try {
        ocrData = await extractDocumentData(fileUrl, docType, fileName, mimeType);
        if (ocrData) break;
        console.warn(`[AutoCategorize] Attempt ${attempt}/${MAX_RETRIES + 1} returned null for doc ${docId}`);
        if (attempt <= MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000 * attempt)); // backoff
        }
      } catch (retryErr: any) {
        console.error(`[AutoCategorize] Attempt ${attempt} error for doc ${docId}:`, retryErr.message);
        if (attempt <= MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 2000 * attempt));
        }
      }
    }
    
    if (!ocrData) {
      console.error(`[AutoCategorize] All attempts failed for doc ${docId}`);
      await db.updateDocument(docId, {
        status: "error",
        clarificationNote: "AI could not process this document after multiple attempts. Please try the Reprocess button.",
      });
      return;
    }
    
    const needsClarification = Array.isArray(ocrData.clarificationNeeded) && ocrData.clarificationNeeded.length > 0;
    console.log(`[AutoCategorize] Doc ${docId}: extracted=${!!ocrData.extractedText}, txns=${ocrData.transactions?.length ?? 0}, clarify=${needsClarification}`);

    await db.updateDocument(docId, {
      ocrText: ocrData.extractedText ?? "",
      ocrData: ocrData,
      status: needsClarification ? "needs_clarification" : "processed",
      clarificationNote: needsClarification
        ? formatBookkeeperClarification(ocrData.clarificationNeeded, fileName)
        : null,
    });

    // For receipts/invoices: auto-create a single transaction
    if ((docType === "receipt" || docType === "invoice" || docType === "other") && ocrData?.total && ocrData.total > 0) {
      await db.createTransaction({
        companyId,
        documentId: docId,
        date: ocrData.date ? new Date(ocrData.date) : new Date(),
        description: ocrData.vendor || fileName,
        amount: ocrData.total.toFixed(2),
        transactionType: docType === "invoice" ? "credit" : "debit",
        category: ocrData.suggestedCategory || (docType === "receipt" ? "Miscellaneous Expenses" : "Sales Revenue"),
        autoCategory: ocrData.suggestedCategory || null,
        autoCategoryConfidence: "85.00",
        manualOverride: false,
      });
    }

    // For bank/credit card statements: create multiple transactions from extracted lines
    if ((docType === "bank_statement" || docType === "credit_card_statement") && ocrData?.transactions && ocrData.transactions.length > 0) {
      const txData = ocrData.transactions.map((tx: any) => ({
        companyId,
        documentId: docId,
        date: tx.date ? new Date(tx.date) : new Date(),
        description: tx.description,
        amount: Math.abs(tx.amount).toFixed(2),
        transactionType: tx.type as "debit" | "credit",
        category: tx.category,
        autoCategory: tx.category,
        autoCategoryConfidence: (tx.confidence ?? 80).toFixed(2),
        manualOverride: false,
      }));
      await db.createTransactionsBatch(txData);
    }

    console.log(`[AutoCategorize] Done doc ${docId}: status=${needsClarification ? "needs_clarification" : "processed"}, txns=${ocrData?.transactions?.length ?? (ocrData?.total ? 1 : 0)}`);
  } catch (err: any) {
    console.error("[processDocumentAsync] Failed:", err.message);
    await db.updateDocument(docId, { status: "error", clarificationNote: `Processing failed: ${err.message}. You can retry by clicking the Retry button.` });
  }
}

// ─── Transaction Router ─────────────────────────────────────────────
const transactionRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this company" });
      return db.getTransactions(input.companyId, input.limit ?? 100, input.offset ?? 0);
    }),

  categorizeStatement: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      documentId: z.number(),
      rawText: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      // Get the document to use its file URL for LLM analysis
      const doc = await db.getDocumentById(input.documentId);
      if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });

      // Delete any existing transactions for this document before re-categorizing
      await db.deleteTransactionsByDocumentId(input.documentId);
      await db.updateDocument(input.documentId, { status: "processing" });

      try {
        const ocrData = await extractDocumentData(doc.fileUrl, doc.docType, doc.fileName, doc.mimeType ?? "application/octet-stream");
        const needsClarification = ocrData?.clarificationNeeded?.length > 0;

        await db.updateDocument(input.documentId, {
          ocrText: ocrData?.extractedText ?? "",
          ocrData: ocrData,
          status: needsClarification ? "needs_clarification" : "processed",
          clarificationNote: needsClarification
            ? formatBookkeeperClarification(ocrData.clarificationNeeded, doc.fileName)
            : null,
        });

        // Create transactions from extracted statement lines
        const txns = ocrData?.transactions ?? [];
        const txData = txns.map((tx: any) => ({
          companyId: input.companyId,
          documentId: input.documentId,
          date: tx.date ? new Date(tx.date) : new Date(),
          description: tx.description,
          amount: Math.abs(tx.amount).toFixed(2),
          transactionType: tx.type as "debit" | "credit",
          category: tx.category,
          autoCategory: tx.category,
          autoCategoryConfidence: (tx.confidence ?? 80).toFixed(2),
          manualOverride: false,
        }));

        if (txData.length > 0) {
          await db.createTransactionsBatch(txData);
        }

        return { transactions: txns, count: txns.length, needsClarification };
      } catch (err: any) {
        await db.updateDocument(input.documentId, { status: "error", clarificationNote: err.message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Statement processing failed" });
      }
    }),

  updateCategory: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
      category: z.string(),
      accountId: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      await db.updateTransaction(input.transactionId, {
        category: input.category,
        accountId: input.accountId,
        manualOverride: true,
      });
      return { success: true };
    }),

  create: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      date: z.string(),
      description: z.string().min(1),
      amount: z.string(),
      transactionType: z.enum(["debit", "credit"]),
      category: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createTransaction({
        companyId: input.companyId,
        date: new Date(input.date),
        description: input.description,
        amount: input.amount,
        transactionType: input.transactionType,
        category: input.category,
        notes: input.notes,
        manualOverride: true,
      });
      return { id };
    }),

  delete: protectedProcedure
    .input(z.object({
      transactionId: z.number(),
      companyId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this company" });
      await db.deleteTransaction(input.transactionId);
      return { success: true };
    }),
});

// ─── Income Statement Router (owner-only) ──────────────────────────
const incomeStatementRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      period: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can view income statements" });
      return db.getIncomeStatementLines(input.companyId, input.period);
    }),

  addLine: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      period: z.string(),
      lineType: z.enum(["revenue", "cost_of_goods", "operating_expense", "other_income", "other_expense", "tax"]),
      description: z.string().min(1),
      amount: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
      const id = await db.createIncomeStatementLine({
        companyId: input.companyId,
        period: input.period,
        lineType: input.lineType,
        description: input.description,
        amount: input.amount,
      });
      return { id };
    }),

  deleteLine: protectedProcedure
    .input(z.object({ lineId: z.number(), companyId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
      await db.deleteIncomeStatementLine(input.lineId);
      return { success: true };
    }),
});

// ─── Financial Statements Router (owner-only) ──────────────────────
const financialRouter = router({
  generateStatement: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      statementType: z.enum(["profit_loss", "balance_sheet", "cash_flow"]),
      period: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can generate financial statements" });

      const [txns, incomeLines, accounts, company] = await Promise.all([
        db.getTransactions(input.companyId, 1000, 0),
        db.getIncomeStatementLines(input.companyId, input.period),
        db.getChartOfAccounts(input.companyId),
        db.getCompanyById(input.companyId),
      ]);

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are David, a Chartered Accountant preparing financial statements for ${company?.name || "the company"} (${company?.companyType || "sdn_bhd"}) in Malaysia. Generate a ${input.statementType.replace("_", " ")} for period ${input.period}. Follow MFRS/MPERS standards. Return structured JSON.`
          },
          {
            role: "user",
            content: `Generate ${input.statementType} for period ${input.period}.\n\nTransactions: ${JSON.stringify(txns.map(t => ({ date: t.date, desc: t.description, amount: t.amount, type: t.transactionType, category: t.category })))}\n\nIncome Statement Lines: ${JSON.stringify(incomeLines.map(l => ({ period: l.period, type: l.lineType, desc: l.description, amount: l.amount })))}\n\nChart of Accounts: ${JSON.stringify(accounts.map(a => ({ code: a.code, name: a.name, type: a.accountType })))}`
          }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "financial_statement",
            strict: true,
            schema: {
              type: "object",
              properties: {
                title: { type: "string" },
                period: { type: "string" },
                sections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      items: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            label: { type: "string" },
                            amount: { type: "number" },
                            isSubtotal: { type: "boolean" }
                          },
                          required: ["label", "amount", "isSubtotal"],
                          additionalProperties: false,
                        }
                      },
                      subtotal: { type: "number" }
                    },
                    required: ["name", "items", "subtotal"],
                    additionalProperties: false,
                  }
                },
                grandTotal: { type: "number" },
                notes: { type: "string" }
              },
              required: ["title", "period", "sections", "grandTotal", "notes"],
              additionalProperties: false,
            }
          }
        }
      });

      const statementData = parseLLMJson(result, {});

      const snapshotId = await db.saveFinancialSnapshot({
        companyId: input.companyId,
        statementType: input.statementType,
        period: input.period,
        data: statementData,
        generatedBy: ctx.user.id,
      });

      return { id: snapshotId, data: statementData };
    }),

  getSnapshots: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      statementType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (role !== "owner") throw new TRPCError({ code: "FORBIDDEN" });
      return db.getFinancialSnapshots(input.companyId, input.statementType);
    }),
});

// ─── Advisor Router ─────────────────────────────────────────────────

/** Build an AdvisorType -> custom name map from stored overrides. */
function toAdvisorNameMap(
  overrides: { advisorType: AdvisorType; name: string }[]
): Partial<Record<AdvisorType, string>> {
  const map: Partial<Record<AdvisorType, string>> = {};
  for (const override of overrides) {
    map[override.advisorType] = override.name;
  }
  return map;
}

const advisorRouter = router({
  /** Advisor profiles with per-company name overrides merged over the defaults. */
  profiles: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this company" });

      const overrides = toAdvisorNameMap(await db.getAdvisorNameOverrides(input.companyId));

      return ADVISOR_TYPES.map(advisorType => ({
        advisorType,
        name: resolveAdvisorName(advisorType, overrides),
        isCustomName: Boolean(overrides[advisorType]),
      }));
    }),

  setName: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      advisorType: z.enum(ADVISOR_TYPES),
      // Narrow allowlist keeps the stored/displayed label safe for UI and logs.
      // Advisor display names are never sent to the LLM.
      name: z.string().trim().min(1).max(ADVISOR_NAME_MAX_LENGTH).regex(ADVISOR_NAME_PATTERN, ADVISOR_NAME_ERROR),
    }))
    .mutation(async ({ ctx, input }) => {
      // Owner-only: the name is company-wide presentation data, so changing it
      // follows the same tier as other company-wide settings.
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (role !== "owner") throw new TRPCError({ code: "FORBIDDEN", message: "Only owners can rename advisors" });

      await db.setAdvisorNameOverride({
        companyId: input.companyId,
        advisorType: input.advisorType,
        name: input.name,
      });

      return { success: true, name: input.name };
    }),

  listConversations: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      advisorType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getConversations(input.companyId, ctx.user.id, input.advisorType);
    }),

  startConversation: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      advisorType: z.enum(ADVISOR_TYPES),
    }))
    .mutation(async ({ ctx, input }) => {
      const role = await db.getMemberRole(input.companyId, ctx.user.id);
      if (!role) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this company" });

      const [company, overrides] = await Promise.all([
        db.getCompanyById(input.companyId),
        db.getAdvisorNameOverrides(input.companyId),
      ]);

      const systemPrompt = getAdvisorSystemPrompt(
        input.advisorType,
        resolveAdvisorName(input.advisorType, toAdvisorNameMap(overrides)),
        company?.name || "Your Company",
        company?.companyType || "sdn_bhd"
      );

      const messages = [{ role: "system", content: systemPrompt, timestamp: Date.now() }];
      const id = await db.createConversation({
        companyId: input.companyId,
        userId: ctx.user.id,
        advisorType: input.advisorType,
        title: "New conversation",
        messages,
      });
      return { id, messages };
    }),

  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.number(),
      message: z.string(),
    }))
    .mutation(async ({ input }) => {
      const convo = await db.getConversationById(input.conversationId);
      if (!convo) throw new TRPCError({ code: "NOT_FOUND" });

      const [company, txns, incomeLines, docs] = await Promise.all([
        db.getCompanyById(convo.companyId),
        db.getTransactions(convo.companyId, 50, 0),
        db.getIncomeStatementLines(convo.companyId),
        db.getDocuments(convo.companyId),
      ]);

      // Stored messages are conversation data, not trusted instructions. Drop
      // every persisted system-role message (including legacy name-interpolated
      // prompts) and rebuild the fixed persona from server-owned code each time.
      const systemPrompt = getAdvisorSystemPrompt(
        convo.advisorType,
        "",
        company?.name || "Your Company",
        company?.companyType || "sdn_bhd"
      );
      const messages = [
        { role: "system", content: systemPrompt, timestamp: Date.now() },
        ...(((convo.messages as any[]) || []).filter(message => message.role !== "system")),
        { role: "user", content: input.message, timestamp: Date.now() },
      ];

      const contextMsg = `[CONTEXT - Current financial data for reference]
Recent transactions (last 50): ${JSON.stringify(txns.slice(0, 20).map(t => ({ date: t.date, desc: t.description, amount: t.amount, type: t.transactionType, category: t.category })))}
Income statement lines: ${JSON.stringify(incomeLines.slice(0, 20).map(l => ({ period: l.period, type: l.lineType, desc: l.description, amount: l.amount })))}
Documents count: ${docs.length} (${docs.filter(d => d.status === "processed").length} processed, ${docs.filter(d => d.status === "needs_clarification").length} need clarification)
[END CONTEXT]`;

      const llmMessages = messages.map((m: any) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      llmMessages.splice(llmMessages.length - 1, 0, {
        role: "system" as const,
        content: contextMsg,
      });

      const result = await invokeLLM({ messages: llmMessages });
      const assistantContent = extractLLMContent(result)
        || "I apologize, but I encountered an issue processing your request. Could you please rephrase?";

      messages.push({ role: "assistant", content: assistantContent, timestamp: Date.now() });

      let title = convo.title ?? "New conversation";
      if (title === "New conversation" && messages.filter((m: any) => m.role === "user").length === 1) {
        title = input.message.slice(0, 80) + (input.message.length > 80 ? "..." : "");
      }

      await db.updateConversation(convo.id, { messages, title });

      return { content: assistantContent, messages };
    }),
});

// ─── Staff Summary Router ──────────────────────────────────────────
const staffRouter = router({
  summary: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ ctx, input }) => {
      return db.getStaffInputSummary(input.companyId, ctx.user.id);
    }),
});

// --- Admin Procedure (owner-only) ---
const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// --- Admin Router ---
const adminRouter = router({
  stats: adminProcedure.query(async () => {
    return db.getAdminStats();
  }),

  users: adminProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 100;
      const offset = input?.offset || 0;
      return db.getAllUsers(limit, offset);
    }),

  companies: adminProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 100;
      const offset = input?.offset || 0;
      return db.getAllCompanies(limit, offset);
    }),

  transactions: adminProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 100;
      const offset = input?.offset || 0;
      return db.getAllTransactions(limit, offset);
    }),

  documentStats: adminProcedure.query(async () => {
    return db.getDocumentProcessingStats();
  }),

  metrics: adminProcedure
    .input(z.object({ metricType: z.string().optional(), limit: z.number().default(100) }).optional())
    .query(async ({ input }) => {
      return db.getSystemMetrics(input?.metricType, input?.limit || 100);
    }),

  auditLogs: adminProcedure
    .input(z.object({ limit: z.number().default(100), offset: z.number().default(0) }).optional())
    .query(async ({ input }) => {
      const limit = input?.limit || 100;
      const offset = input?.offset || 0;
      return db.getAuditLogs(limit, offset);
    }),

  auditLogsByCompany: adminProcedure
    .input(z.object({ companyId: z.number(), limit: z.number().default(100) }))
    .query(async ({ input }) => {
      return db.getAuditLogsByCompany(input.companyId, input.limit);
    }),

  auditLogsByUser: adminProcedure
    .input(z.object({ userId: z.number(), limit: z.number().default(100) }))
    .query(async ({ input }) => {
      return db.getAuditLogsByUser(input.userId, input.limit);
    }),
});

// ─── Main Router ────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  onboarding: onboardingRouter,
  company: companyRouter,
  document: documentRouter,
  transaction: transactionRouter,
  incomeStatement: incomeStatementRouter,
  financial: financialRouter,
  advisor: advisorRouter,
  staff: staffRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
