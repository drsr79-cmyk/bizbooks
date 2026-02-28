import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { COMPANY_TYPE_LABELS } from "@shared/types";
import type { CompanyType } from "@shared/types";
import {
  FileText, Receipt, CreditCard, TrendingUp, Upload, MessageSquare,
  ArrowUpRight, ArrowDownRight, Building2, AlertCircle
} from "lucide-react";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { activeCompany } = useCompany();
  const [, setLocation] = useLocation();

  const { data: documents, isLoading: docsLoading } = trpc.document.list.useQuery(
    { companyId: activeCompany?.id ?? 0 },
    { enabled: !!activeCompany }
  );

  const { data: transactions, isLoading: txnLoading } = trpc.transaction.list.useQuery(
    { companyId: activeCompany?.id ?? 0, limit: 10 },
    { enabled: !!activeCompany }
  );

  if (!activeCompany) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Building2 className="w-12 h-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">No Company Selected</h2>
        <p className="text-muted-foreground text-center max-w-md">
          Register a company to get started with your accounting.
        </p>
        <Button onClick={() => setLocation("/companies/new")}>Register Company</Button>
      </div>
    );
  }

  const receiptCount = documents?.filter(d => d.docType === "receipt").length ?? 0;
  const invoiceCount = documents?.filter(d => d.docType === "invoice").length ?? 0;
  const statementCount = documents?.filter(d => d.docType === "bank_statement" || d.docType === "credit_card_statement").length ?? 0;
  const needsClarification = documents?.filter(d => d.status === "needs_clarification").length ?? 0;

  const totalDebits = transactions?.reduce((sum, t) => t.transactionType === "debit" ? sum + parseFloat(t.amount) : sum, 0) ?? 0;
  const totalCredits = transactions?.reduce((sum, t) => t.transactionType === "credit" ? sum + parseFloat(t.amount) : sum, 0) ?? 0;

  return (
    <div className="space-y-6">
      {/* Company Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{activeCompany.name}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="secondary">
              {COMPANY_TYPE_LABELS[activeCompany.companyType as CompanyType] ?? activeCompany.companyType}
            </Badge>
            <span className="text-sm text-muted-foreground">SSM: {activeCompany.ssmNumber}</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {needsClarification > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="py-3 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-warning shrink-0" />
            <p className="text-sm">
              <strong>{needsClarification} document{needsClarification > 1 ? "s" : ""}</strong> need your clarification.
              Our AI couldn't fully process them and needs your input.
            </p>
            <Button variant="outline" size="sm" className="ml-auto shrink-0" onClick={() => setLocation("/documents")}>
              Review
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/documents")}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Receipts</p>
                <p className="text-2xl font-bold mt-1">{docsLoading ? <Skeleton className="h-8 w-12" /> : receiptCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Receipt className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/documents")}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Invoices</p>
                <p className="text-2xl font-bold mt-1">{docsLoading ? <Skeleton className="h-8 w-12" /> : invoiceCount}</p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <FileText className="w-5 h-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/transactions")}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Inflow</p>
                <p className="text-2xl font-bold mt-1 text-green-600">
                  {txnLoading ? <Skeleton className="h-8 w-20" /> : `RM ${totalCredits.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <ArrowUpRight className="w-5 h-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setLocation("/transactions")}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Outflow</p>
                <p className="text-2xl font-bold mt-1 text-red-500">
                  {txnLoading ? <Skeleton className="h-8 w-20" /> : `RM ${totalDebits.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`}
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <ArrowDownRight className="w-5 h-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
            <CardDescription>Common tasks to keep your books up to date</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => setLocation("/documents")}>
              <Upload className="w-4 h-4" />
              Upload Receipt or Invoice
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => setLocation("/bank-statements")}>
              <CreditCard className="w-4 h-4" />
              Upload Bank Statement
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => setLocation("/income-statement")}>
              <TrendingUp className="w-4 h-4" />
              Input Income Statement
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => setLocation("/financials")}>
              <FileText className="w-4 h-4" />
              Generate Financial Statements
            </Button>
            <Button variant="outline" className="w-full justify-start gap-3 h-11" onClick={() => setLocation("/advisors")}>
              <MessageSquare className="w-4 h-4" />
              Talk to an Advisor
            </Button>
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Transactions</CardTitle>
            <CardDescription>Latest categorized entries</CardDescription>
          </CardHeader>
          <CardContent>
            {txnLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : transactions && transactions.length > 0 ? (
              <div className="space-y-2">
                {transactions.slice(0, 5).map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{tx.category ?? "Uncategorized"}</p>
                    </div>
                    <span className={`text-sm font-mono font-medium shrink-0 ml-3 ${
                      tx.transactionType === "credit" ? "text-green-600" : "text-red-500"
                    }`}>
                      {tx.transactionType === "credit" ? "+" : "-"}RM {parseFloat(tx.amount).toLocaleString("en-MY", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No transactions yet</p>
                <p className="text-xs mt-1">Upload a bank statement to get started</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
