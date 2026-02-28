import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, CreditCard, Loader2, FileText, CheckCircle2, Edit2, X } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { TRANSACTION_CATEGORIES } from "@shared/types";

export default function BankStatements() {
  const { activeCompany } = useCompany();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [statementType, setStatementType] = useState<string>("bank_statement");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [editingTxn, setEditingTxn] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  const { data: documents } = trpc.document.list.useQuery(
    { companyId: activeCompany?.id ?? 0, docType: statementType },
    { enabled: !!activeCompany }
  );

  const { data: transactions, isLoading: txnLoading } = trpc.transaction.list.useQuery(
    { companyId: activeCompany?.id ?? 0, limit: 200 },
    { enabled: !!activeCompany }
  );

  const uploadMutation = trpc.document.upload.useMutation();
  const categorizeMutation = trpc.transaction.categorizeStatement.useMutation();
  const updateCategoryMutation = trpc.transaction.updateCategory.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
  };

  const handleUploadAndProcess = async () => {
    if (!selectedFile || !activeCompany) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.readAsDataURL(selectedFile);
      });

      const result = await uploadMutation.mutateAsync({
        companyId: activeCompany.id,
        docType: statementType as any,
        fileName: selectedFile.name,
        fileBase64: base64,
        mimeType: selectedFile.type,
      });

      toast.success("Statement uploaded. Now processing with AI...");
      setUploading(false);
      setProcessing(true);

      // Read file as text for categorization
      const textContent = await selectedFile.text();

      const catResult = await categorizeMutation.mutateAsync({
        companyId: activeCompany.id,
        documentId: result.id,
        rawText: textContent,
      });

      toast.success(`${catResult.count} transactions categorized`);
      await utils.transaction.list.invalidate();
      await utils.document.list.invalidate();
      setUploadOpen(false);
      setSelectedFile(null);
    } catch (e: any) {
      toast.error(e.message || "Processing failed");
    } finally {
      setUploading(false);
      setProcessing(false);
    }
  };

  const handleUpdateCategory = async (txnId: number) => {
    if (!editCategory) return;
    try {
      await updateCategoryMutation.mutateAsync({
        transactionId: txnId,
        category: editCategory,
      });
      toast.success("Category updated");
      setEditingTxn(null);
      setEditCategory("");
      await utils.transaction.list.invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank & Credit Card Statements</h1>
          <p className="text-muted-foreground">Upload statements for automatic transaction categorization</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="w-4 h-4 mr-2" />Upload Statement</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Statement</DialogTitle>
              <DialogDescription>Upload a bank or credit card statement (CSV, PDF, or text)</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Statement Type</Label>
                <Select value={statementType} onValueChange={setStatementType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bank_statement">Bank Statement</SelectItem>
                    <SelectItem value="credit_card_statement">Credit Card Statement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedFile && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm truncate">{selectedFile.name}</span>
                  <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => setSelectedFile(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              <div>
                <input ref={fileInputRef} type="file" accept=".csv,.txt,.pdf,image/*" className="hidden" onChange={handleFileSelect} />
                <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />Select File
                </Button>
              </div>

              <Button onClick={handleUploadAndProcess} className="w-full" disabled={!selectedFile || uploading || processing}>
                {(uploading || processing) ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {uploading ? "Uploading..." : processing ? "AI Categorizing..." : "Upload & Categorize"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categorized Transactions</CardTitle>
          <CardDescription>
            Review and correct AI-categorized transactions. Click the category to edit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {txnLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded" />)}
            </div>
          ) : transactions && transactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount (RM)</TableHead>
                    <TableHead>Confidence</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{tx.description}</TableCell>
                      <TableCell>
                        {editingTxn === tx.id ? (
                          <div className="flex items-center gap-1">
                            <Select value={editCategory} onValueChange={setEditCategory}>
                              <SelectTrigger className="h-8 text-xs w-[180px]"><SelectValue placeholder="Select category" /></SelectTrigger>
                              <SelectContent>
                                {TRANSACTION_CATEGORIES.map(cat => (
                                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button size="icon" className="h-8 w-8" onClick={() => handleUpdateCategory(tx.id)}>
                              <CheckCircle2 className="w-3 h-3" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingTxn(null)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ) : (
                          <button
                            className="text-sm hover:underline text-left flex items-center gap-1"
                            onClick={() => { setEditingTxn(tx.id); setEditCategory(tx.category ?? ""); }}
                          >
                            <Badge variant={tx.manualOverride ? "default" : "secondary"} className="text-xs">
                              {tx.category ?? "Uncategorized"}
                            </Badge>
                            {tx.manualOverride && <Edit2 className="w-3 h-3 text-muted-foreground" />}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${tx.transactionType === "credit" ? "text-green-600" : "text-red-500"}`}>
                        {tx.transactionType === "credit" ? "+" : "-"}{parseFloat(tx.amount).toLocaleString("en-MY", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        {tx.autoCategoryConfidence ? (
                          <Badge variant={parseFloat(tx.autoCategoryConfidence) > 80 ? "default" : parseFloat(tx.autoCategoryConfidence) > 50 ? "secondary" : "destructive"} className="text-xs">
                            {parseFloat(tx.autoCategoryConfidence).toFixed(0)}%
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Manual</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingTxn(tx.id); setEditCategory(tx.category ?? ""); }}>
                          <Edit2 className="w-3 h-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <CreditCard className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload a bank statement to auto-categorize transactions</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
