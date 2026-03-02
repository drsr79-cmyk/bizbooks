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
import { Upload, CreditCard, Loader2, FileText, CheckCircle2, Edit2, X, AlertCircle, Sparkles, RefreshCw, Camera } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { TRANSACTION_CATEGORIES } from "@shared/types";

export default function BankStatements() {
  const { activeCompany } = useCompany();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [statementType, setStatementType] = useState<string>("bank_statement");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingTxn, setEditingTxn] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [clarificationDoc, setClarificationDoc] = useState<any>(null);
  const [clarificationResponse, setClarificationResponse] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();

  // Poll documents for processing status updates
  const { data: documents } = trpc.document.list.useQuery(
    { companyId: activeCompany?.id ?? 0, docType: statementType },
    { enabled: !!activeCompany, refetchInterval: 5000 }
  );

  const { data: transactions, isLoading: txnLoading } = trpc.transaction.list.useQuery(
    { companyId: activeCompany?.id ?? 0, limit: 200 },
    { enabled: !!activeCompany, refetchInterval: 5000 }
  );

  const uploadMutation = trpc.document.upload.useMutation();
  const ocrMutation = trpc.document.processWithOCR.useMutation();
  const updateCategoryMutation = trpc.transaction.updateCategory.useMutation();
  const clarifyMutation = trpc.document.respondToClarification.useMutation();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File size must be under 10MB");
      return;
    }
    setSelectedFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }
  };

  const handleUpload = async () => {
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

      await uploadMutation.mutateAsync({
        companyId: activeCompany.id,
        docType: statementType as any,
        fileName: selectedFile.name,
        fileBase64: base64,
        mimeType: selectedFile.type,
      });

      toast.success("Statement uploaded! AI is now processing it...", {
        description: "Transactions will be automatically extracted and categorized. This may take a moment.",
        duration: 6000,
      });

      await utils.document.list.invalidate();
      await utils.transaction.list.invalidate();
      setUploadOpen(false);
      setSelectedFile(null);
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleRetryProcessing = async (docId: number) => {
    try {
      toast.info("Re-processing statement...");
      const result = await ocrMutation.mutateAsync({ documentId: docId });
      if (result.needsClarification) {
        toast.warning("Sarah (Bookkeeper) needs clarification on some items");
      } else {
        toast.success("Statement processed successfully!");
      }
      await utils.document.list.invalidate();
      await utils.transaction.list.invalidate();
    } catch {
      toast.error("Processing failed — please try again later");
    }
  };

  const handleClarificationSubmit = async () => {
    if (!clarificationDoc || !clarificationResponse) return;
    try {
      await clarifyMutation.mutateAsync({
        documentId: clarificationDoc.id,
        response: clarificationResponse,
      });
      toast.success("Clarification submitted — re-processing...");
      setClarificationDoc(null);
      setClarificationResponse("");
      await utils.document.list.invalidate();
      await utils.transaction.list.invalidate();
    } catch (e: any) {
      toast.error(e.message);
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

  const statusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string; icon?: React.ReactNode }> = {
      pending: { variant: "secondary", label: "Pending" },
      processing: { variant: "outline", label: "AI Processing...", icon: <Loader2 className="w-3 h-3 animate-spin mr-1" /> },
      processed: { variant: "default", label: "Auto-Categorized", icon: <Sparkles className="w-3 h-3 mr-1" /> },
      error: { variant: "destructive", label: "Error" },
      needs_clarification: { variant: "destructive", label: "Needs Clarification", icon: <AlertCircle className="w-3 h-3 mr-1" /> },
    };
    const s = variants[status] ?? { variant: "secondary" as const, label: status, icon: undefined };
    return <Badge variant={s.variant} className="flex items-center">{s.icon ?? null}{s.label}</Badge>;
  };

  // Count processing/clarification docs
  const processingDocs = documents?.filter(d => d.status === "processing") ?? [];
  const clarificationDocs = documents?.filter(d => d.status === "needs_clarification") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Bank & Credit Card Statements</h1>
          <p className="text-muted-foreground">Upload statements — AI extracts and categorizes all transactions automatically</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="w-4 h-4 mr-2" />Upload Statement</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Statement</DialogTitle>
              <DialogDescription>Upload a bank or credit card statement. AI will extract every transaction and categorize them.</DialogDescription>
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

              {preview && (
                <div className="relative">
                  <img src={preview} alt="Preview" className="w-full rounded-lg border max-h-48 object-contain bg-muted" />
                  <Button variant="outline" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => { setSelectedFile(null); setPreview(null); }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              {selectedFile && !preview && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <span className="text-sm truncate">{selectedFile.name}</span>
                  <Button variant="ghost" size="icon" className="ml-auto h-7 w-7" onClick={() => setSelectedFile(null)}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}

              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept=".csv,.txt,.pdf,image/*" className="hidden" onChange={handleFileSelect} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />Browse Files
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />Take Photo
                </Button>
              </div>

              <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm text-muted-foreground">
                <div className="flex items-center gap-2 text-primary font-medium mb-1">
                  <Sparkles className="w-4 h-4" />AI Auto-Categorization
                </div>
                After upload, AI will extract every transaction from your statement, categorize each one, and create entries automatically. If anything is unclear, Sarah (your bookkeeper) will ask for clarification.
              </div>

              <Button onClick={handleUpload} className="w-full" disabled={!selectedFile || uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {uploading ? "Uploading..." : "Upload & Auto-Categorize"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Processing Status Banner */}
      {processingDocs.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4 flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <div>
              <span className="font-medium text-sm">AI is processing {processingDocs.length} statement{processingDocs.length > 1 ? "s" : ""}...</span>
              <span className="block text-xs text-muted-foreground">Transactions will appear below once extraction is complete</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Clarification Needed Banner */}
      {clarificationDocs.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800">
          <CardContent className="py-4 space-y-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" />
              <span className="font-medium text-sm">Sarah (Bookkeeper) needs your help</span>
            </div>
            {clarificationDocs.map(doc => (
              <div key={doc.id} className="p-3 rounded-lg bg-white dark:bg-background border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{doc.fileName}</span>
                  <Button variant="outline" size="sm" onClick={() => { setClarificationDoc(doc); setClarificationResponse(""); }}>
                    <AlertCircle className="w-3 h-3 mr-1" />Respond
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground whitespace-pre-line">{doc.clarificationNote}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Clarification Dialog */}
      <Dialog open={!!clarificationDoc} onOpenChange={() => setClarificationDoc(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-teal-100 dark:bg-teal-900 flex items-center justify-center text-teal-700 dark:text-teal-300 font-bold text-sm">S</div>
              Sarah — Bookkeeper
            </DialogTitle>
            <DialogDescription>Clarification needed for: {clarificationDoc?.fileName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 border text-sm whitespace-pre-line">
              {clarificationDoc?.clarificationNote}
            </div>
            <div className="space-y-2">
              <Label>Your Response</Label>
              <Textarea
                value={clarificationResponse}
                onChange={e => setClarificationResponse(e.target.value)}
                placeholder="Provide the missing information so Sarah can categorize correctly..."
                rows={4}
              />
            </div>
            <Button onClick={handleClarificationSubmit} className="w-full" disabled={!clarificationResponse || clarifyMutation.isPending}>
              {clarifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
              Submit & Re-Categorize
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Uploaded Statements */}
      {documents && documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Uploaded Statements</CardTitle>
            <CardDescription>Status of your uploaded bank and credit card statements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map(doc => (
                <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                  <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <CreditCard className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium truncate block">{doc.fileName}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                      {!!(doc.ocrData && (doc.ocrData as Record<string, any>).transactions?.length > 0) && (
                        <> · {(doc.ocrData as Record<string, any>).transactions.length} transactions extracted</>
                      )}
                    </span>
                  </div>
                  {statusBadge(doc.status)}
                  <div className="flex gap-1">
                    {doc.status === "needs_clarification" && (
                      <Button variant="outline" size="sm" onClick={() => { setClarificationDoc(doc); setClarificationResponse(""); }}>
                        Clarify
                      </Button>
                    )}
                    {doc.status === "error" && (
                      <Button variant="outline" size="sm" onClick={() => handleRetryProcessing(doc.id)} disabled={ocrMutation.isPending}>
                        <RefreshCw className="w-3 h-3 mr-1" />Retry
                      </Button>
                    )}
                    {doc.status === "processed" && !(doc.ocrData && (doc.ocrData as Record<string, any>).transactions?.length > 0) && !(doc.ocrData && (doc.ocrData as Record<string, any>).total > 0) && (
                      <Button variant="outline" size="sm" onClick={() => handleRetryProcessing(doc.id)} disabled={ocrMutation.isPending}>
                        <RefreshCw className="w-3 h-3 mr-1" />Reprocess
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Categorized Transactions</CardTitle>
          <CardDescription>
            Review and correct AI-categorized transactions. Click the category to manually override.
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
              <span className="block text-muted-foreground">No transactions yet</span>
              <span className="block text-sm text-muted-foreground mt-1">Upload a bank or credit card statement to auto-categorize transactions</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
