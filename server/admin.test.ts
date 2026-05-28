import { describe, it, expect, beforeAll } from "vitest";
import * as db from "./db";

describe("Admin Procedures", () => {
  describe("getAdminStats", () => {
    it("should return platform statistics", async () => {
      const stats = await db.getAdminStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("totalUsers");
      expect(stats).toHaveProperty("totalCompanies");
      expect(stats).toHaveProperty("totalDocuments");
      expect(stats).toHaveProperty("totalTransactions");
      expect(stats).toHaveProperty("totalAdvisorConversations");
      expect(stats).toHaveProperty("docStatusBreakdown");
      expect(stats).toHaveProperty("txnTypeBreakdown");
      
      expect(typeof stats.totalUsers).toBe("number");
      expect(typeof stats.totalCompanies).toBe("number");
      expect(typeof stats.totalDocuments).toBe("number");
      expect(typeof stats.totalTransactions).toBe("number");
      expect(typeof stats.totalAdvisorConversations).toBe("number");
      
      expect(Array.isArray(stats.docStatusBreakdown)).toBe(true);
      expect(Array.isArray(stats.txnTypeBreakdown)).toBe(true);
    });
  });

  describe("getAllUsers", () => {
    it("should return list of users with pagination", async () => {
      const users = await db.getAllUsers(10, 0);
      
      expect(Array.isArray(users)).toBe(true);
      
      if (users.length > 0) {
        const user = users[0];
        expect(user).toHaveProperty("id");
        expect(user).toHaveProperty("openId");
        expect(user).toHaveProperty("name");
        expect(user).toHaveProperty("email");
        expect(user).toHaveProperty("role");
        expect(user).toHaveProperty("createdAt");
      }
    });

    it("should respect limit parameter", async () => {
      const limit = 5;
      const users = await db.getAllUsers(limit, 0);
      
      expect(users.length).toBeLessThanOrEqual(limit);
    });
  });

  describe("getAllCompanies", () => {
    it("should return list of companies with pagination", async () => {
      const companies = await db.getAllCompanies(10, 0);
      
      expect(Array.isArray(companies)).toBe(true);
      
      if (companies.length > 0) {
        const company = companies[0];
        expect(company).toHaveProperty("id");
        expect(company).toHaveProperty("name");
        expect(company).toHaveProperty("companyType");
        expect(company).toHaveProperty("ssmNumber");
        expect(company).toHaveProperty("createdAt");
      }
    });
  });

  describe("getAllTransactions", () => {
    it("should return list of transactions with pagination", async () => {
      const transactions = await db.getAllTransactions(10, 0);
      
      expect(Array.isArray(transactions)).toBe(true);
      
      if (transactions.length > 0) {
        const txn = transactions[0];
        expect(txn).toHaveProperty("id");
        expect(txn).toHaveProperty("companyId");
        expect(txn).toHaveProperty("date");
        expect(txn).toHaveProperty("description");
        expect(txn).toHaveProperty("amount");
        expect(txn).toHaveProperty("transactionType");
      }
    });
  });

  describe("getDocumentProcessingStats", () => {
    it("should return document processing statistics", async () => {
      const stats = await db.getDocumentProcessingStats();
      
      expect(stats).toBeDefined();
      expect(stats).toHaveProperty("processed");
      expect(stats).toHaveProperty("failed");
      expect(stats).toHaveProperty("pending");
      expect(stats).toHaveProperty("processing");
      expect(stats).toHaveProperty("needsClarification");
      
      expect(typeof stats.processed).toBe("number");
      expect(typeof stats.failed).toBe("number");
      expect(typeof stats.pending).toBe("number");
      expect(typeof stats.processing).toBe("number");
      expect(typeof stats.needsClarification).toBe("number");
    });
  });

  describe("Audit Logs", () => {
    it("should log audit events", async () => {
      const auditData = {
        userId: 1,
        companyId: 1,
        action: "test_action",
        resourceType: "test_resource",
        resourceId: 1,
        details: JSON.stringify({ test: true }),
      };
      
      // Log the event
      await db.logAuditEvent(auditData);
      
      // Retrieve audit logs
      const logs = await db.getAuditLogs(10, 0);
      expect(Array.isArray(logs)).toBe(true);
    });

    it("should retrieve audit logs by company", async () => {
      const logs = await db.getAuditLogsByCompany(1, 10);
      
      expect(Array.isArray(logs)).toBe(true);
    });

    it("should retrieve audit logs by user", async () => {
      const logs = await db.getAuditLogsByUser(1, 10);
      
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe("System Metrics", () => {
    it("should record system metrics", async () => {
      const metricData = {
        metricType: "test_metric",
        value: 100,
        unit: "ms",
        metadata: JSON.stringify({ test: true }),
      };
      
      // Record the metric
      await db.recordSystemMetric(metricData);
      
      // Retrieve metrics
      const metrics = await db.getSystemMetrics("test_metric", 10);
      expect(Array.isArray(metrics)).toBe(true);
    });

    it("should retrieve all system metrics", async () => {
      const metrics = await db.getSystemMetrics(undefined, 10);
      
      expect(Array.isArray(metrics)).toBe(true);
    });
  });
});
