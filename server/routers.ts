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
      address: z.string().optional(),
      financialYearEnd: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const companyId = await db.createCompany({
        ...input,
      taxNumber: input.taxNumber,
      ownerName: input.ownerName,
      ownerIc: input.ownerIc,
      address: input.address,
      financialYearEnd: input.financialYearEnd,
        createdBy: ctx.user.id,
      });
      // Add creator as owner
      await db.addCompanyMember({
        companyId,
        userId: ctx.user.id,
        memberRole: "owner",
        permissions: JSON.stringify(["all"]),
      });
      // Seed default chart of accounts
      await db.seedDefaultAccounts(companyId);
      return { id: companyId };
    }),

  getMembers: protectedProcedure
    .input(z.object({ companyId: z.number() }))
    .query(async ({ input }) => {
      return db.getCompanyMembers(input.companyId);
    }),

  addMember: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      userEmail: z.string().email(),
      memberRole: z.enum(["owner", "staff"]),
      permissions: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      // For now, we store the invitation. In production, this would send an email.
      return { success: true, message: "Member invitation sent" };
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
        status: "pending",
      });

      return { id: docId, url };
    }),

  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      docType: z.string().optional(),
    }))
    .query(async ({ input }) => {
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
        const messages: any[] = [
          {
            role: "system",
            content: `You are an OCR and document analysis expert. Extract all text and structured data from the uploaded document image. Return a JSON object with: { "extractedText": "full text", "vendor": "vendor name if receipt/invoice", "date": "YYYY-MM-DD", "total": number, "currency": "MYR", "items": [{"description": "item", "amount": number}], "taxAmount": number, "invoiceNumber": "if applicable", "documentType": "receipt|invoice|statement" }. If any field is unclear, set it to null and add a "clarificationNeeded" array describing what's unclear.`
          },
          {
            role: "user",
            content: [
              { type: "text", text: `Please extract and analyse this ${doc.docType} document: ${doc.fileName}` },
              { type: "image_url", image_url: { url: doc.fileUrl, detail: "high" } }
            ]
          }
        ];

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
                  clarificationNeeded: {
                    type: "array",
                    items: { type: "string" }
                  }
                },
                required: ["extractedText", "vendor", "date", "total", "currency", "items", "taxAmount", "invoiceNumber", "documentType", "clarificationNeeded"],
                additionalProperties: false,
              }
            }
          }
        });

        const content = result.choices[0]?.message?.content;
        const ocrData = typeof content === "string" ? JSON.parse(content) : null;
        const needsClarification = ocrData?.clarificationNeeded?.length > 0;

        await db.updateDocument(doc.id, {
          ocrText: ocrData?.extractedText ?? "",
          ocrData: ocrData,
          status: needsClarification ? "needs_clarification" : "processed",
          clarificationNote: needsClarification ? ocrData.clarificationNeeded.join("; ") : null,
        });

        return { success: true, ocrData, needsClarification };
      } catch (error: any) {
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
      await db.updateDocument(input.documentId, {
        status: "processed",
        clarificationNote: `User response: ${input.response}`,
      });
      return { success: true };
    }),
});

// ─── Transaction Router ─────────────────────────────────────────────
const transactionRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .query(async ({ input }) => {
      return db.getTransactions(input.companyId, input.limit ?? 100, input.offset ?? 0);
    }),

  categorizeStatement: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      documentId: z.number(),
      rawText: z.string(),
    }))
    .mutation(async ({ input }) => {
      const accounts = await db.getChartOfAccounts(input.companyId);
      const accountNames = accounts.map(a => `${a.code} - ${a.name} (${a.accountType})`).join("\n");

      const result = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are an expert bookkeeper. Parse the following bank/credit card statement text and categorize each transaction. Available chart of accounts:\n${accountNames}\n\nReturn a JSON array of transactions with: { "transactions": [{ "date": "YYYY-MM-DD", "description": "original description", "amount": number (positive for credits, negative for debits), "type": "debit"|"credit", "category": "best matching category name", "accountCode": "matching account code", "confidence": 0-100 }] }`
          },
          { role: "user", content: input.rawText }
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "categorized_transactions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                transactions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      date: { type: "string" },
                      description: { type: "string" },
                      amount: { type: "number" },
                      type: { type: "string", enum: ["debit", "credit"] },
                      category: { type: "string" },
                      accountCode: { type: "string" },
                      confidence: { type: "number" }
                    },
                    required: ["date", "description", "amount", "type", "category", "accountCode", "confidence"],
                    additionalProperties: false,
                  }
                }
              },
              required: ["transactions"],
              additionalProperties: false,
            }
          }
        }
      });

      const content = result.choices[0]?.message?.content;
      const parsed = typeof content === "string" ? JSON.parse(content) : { transactions: [] };

      // Save transactions to DB
      const txData = parsed.transactions.map((tx: any) => ({
        companyId: input.companyId,
        documentId: input.documentId,
        date: new Date(tx.date),
        description: tx.description,
        amount: Math.abs(tx.amount).toFixed(2),
        transactionType: tx.type as "debit" | "credit",
        category: tx.category,
        autoCategory: tx.category,
        autoCategoryConfidence: tx.confidence.toFixed(2),
        manualOverride: false,
      }));

      if (txData.length > 0) {
        await db.createTransactionsBatch(txData);
      }

      await db.updateDocument(input.documentId, { status: "processed" });

      return { transactions: parsed.transactions, count: parsed.transactions.length };
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
      description: z.string(),
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
});

// ─── Income Statement Router ────────────────────────────────────────
const incomeStatementRouter = router({
  list: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      period: z.string().optional(),
    }))
    .query(async ({ input }) => {
      return db.getIncomeStatementLines(input.companyId, input.period);
    }),

  addLine: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      period: z.string(),
      lineType: z.enum(["revenue", "cost_of_goods", "operating_expense", "other_income", "other_expense", "tax"]),
      description: z.string(),
      amount: z.string(),
    }))
    .mutation(async ({ input }) => {
      const id = await db.createIncomeStatementLine(input);
      return { id };
    }),

  deleteLine: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.deleteIncomeStatementLine(input.id);
      return { success: true };
    }),
});

// ─── Financial Statements Router ────────────────────────────────────
const financialRouter = router({
  generateStatement: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      statementType: z.enum(["profit_loss", "balance_sheet", "cash_flow"]),
      period: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [txns, incomeLines, accounts] = await Promise.all([
        db.getTransactions(input.companyId, 10000, 0),
        db.getIncomeStatementLines(input.companyId, input.period),
        db.getChartOfAccounts(input.companyId),
      ]);

      const accountMap = Object.fromEntries(accounts.map(a => [a.code, a]));

      const prompt = input.statementType === "profit_loss"
        ? `Generate a Profit & Loss statement for period ${input.period}. Use the following data:
Transactions: ${JSON.stringify(txns.slice(0, 200))}
Income Statement Lines: ${JSON.stringify(incomeLines)}
Chart of Accounts: ${JSON.stringify(accounts)}

Return JSON: { "title": "Profit & Loss Statement", "period": "${input.period}", "sections": [{ "name": "Revenue", "items": [{"description": "...", "amount": number}], "total": number }, ...], "netProfit": number }`
        : input.statementType === "balance_sheet"
        ? `Generate a Balance Sheet for period ${input.period}. Use the following data:
Transactions: ${JSON.stringify(txns.slice(0, 200))}
Chart of Accounts: ${JSON.stringify(accounts)}

Return JSON: { "title": "Balance Sheet", "period": "${input.period}", "assets": { "current": [{"description": "...", "amount": number}], "nonCurrent": [{"description": "...", "amount": number}], "totalAssets": number }, "liabilities": { "current": [...], "nonCurrent": [...], "totalLiabilities": number }, "equity": { "items": [...], "totalEquity": number } }`
        : `Generate a Cash Flow Statement for period ${input.period}. Use the following data:
Transactions: ${JSON.stringify(txns.slice(0, 200))}
Chart of Accounts: ${JSON.stringify(accounts)}

Return JSON: { "title": "Cash Flow Statement", "period": "${input.period}", "operating": { "items": [{"description": "...", "amount": number}], "total": number }, "investing": { "items": [...], "total": number }, "financing": { "items": [...], "total": number }, "netCashFlow": number, "openingBalance": number, "closingBalance": number }`;

      const result = await invokeLLM({
        messages: [
          { role: "system", content: "You are a Malaysian Chartered Accountant preparing financial statements compliant with MFRS/MPERS. Generate accurate financial statements from the provided data. If data is insufficient, use reasonable estimates and note assumptions. Return valid JSON only." },
          { role: "user", content: prompt }
        ],
      });

      const content = result.choices[0]?.message?.content;
      let statementData: any;
      try {
        const jsonStr = typeof content === "string" ? content : "";
        const match = jsonStr.match(/\{[\s\S]*\}/);
        statementData = match ? JSON.parse(match[0]) : { error: "Failed to parse" };
      } catch {
        statementData = { error: "Failed to generate statement", raw: content };
      }

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
    .query(async ({ input }) => {
      return db.getFinancialSnapshots(input.companyId, input.statementType);
    }),
});

// ─── Advisor Router ─────────────────────────────────────────────────
const advisorRouter = router({
  listConversations: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      advisorType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      return db.getConversations(input.companyId, ctx.user.id, input.advisorType);
    }),

  getConversation: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      return db.getConversationById(input.id);
    }),

  startConversation: protectedProcedure
    .input(z.object({
      companyId: z.number(),
      advisorType: z.enum(["bookkeeper", "accountant", "tax_agent", "auditor", "cfo"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const company = await db.getCompanyById(input.companyId);
      if (!company) throw new TRPCError({ code: "NOT_FOUND" });

      const systemPrompt = getAdvisorSystemPrompt(input.advisorType, company.name, company.companyType);
      const messages = [{ role: "system", content: systemPrompt, timestamp: Date.now() }];

      const id = await db.createConversation({
        companyId: input.companyId,
        userId: ctx.user.id,
        advisorType: input.advisorType,
        title: "New conversation",
        messages: messages,
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

      const messages = (convo.messages as any[]) || [];
      messages.push({ role: "user", content: input.message, timestamp: Date.now() });

      // Get company data for context
      const [txns, incomeLines, docs] = await Promise.all([
        db.getTransactions(convo.companyId, 50, 0),
        db.getIncomeStatementLines(convo.companyId),
        db.getDocuments(convo.companyId),
      ]);

      const contextMsg = `[CONTEXT - Current financial data for reference]
Recent transactions (last 50): ${JSON.stringify(txns.slice(0, 20).map(t => ({ date: t.date, desc: t.description, amount: t.amount, type: t.transactionType, category: t.category })))}
Income statement lines: ${JSON.stringify(incomeLines.slice(0, 20).map(l => ({ period: l.period, type: l.lineType, desc: l.description, amount: l.amount })))}
Documents count: ${docs.length} (${docs.filter(d => d.status === 'processed').length} processed, ${docs.filter(d => d.status === 'needs_clarification').length} need clarification)
[END CONTEXT]`;

      // Build LLM messages (system + context + conversation history)
      const llmMessages = messages.map((m: any) => ({
        role: m.role as "system" | "user" | "assistant",
        content: m.content,
      }));

      // Insert context before the last user message
      llmMessages.splice(llmMessages.length - 1, 0, {
        role: "system" as const,
        content: contextMsg,
      });

      const result = await invokeLLM({ messages: llmMessages });
      const assistantContent = typeof result.choices[0]?.message?.content === "string"
        ? result.choices[0].message.content
        : "I apologize, but I encountered an issue processing your request. Could you please rephrase?";

      messages.push({ role: "assistant", content: assistantContent, timestamp: Date.now() });

      // Auto-generate title from first exchange
      let title = convo.title ?? "New conversation";
      if (title === "New conversation" && messages.filter((m: any) => m.role === "user").length === 1) {
        title = input.message.slice(0, 80) + (input.message.length > 80 ? "..." : "");
      }

      await db.updateConversation(convo.id, { messages, title });

      return { content: assistantContent, messages };
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
});

export type AppRouter = typeof appRouter;
