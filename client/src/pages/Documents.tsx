import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileText, Receipt, Camera, Loader2, CheckCircle2, AlertCircle, Eye, X } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

export default function Documents() {
  const { activeCompany } = useCompany();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [docType, setDocType] = useState<string>("receipt");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [clarificationDoc, setClarificationDoc] = useState<any>(null);
  const [clarificationResponse, setClarificationResponse] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const utils = trpc.useUtils();
  const { data: documents, isLoading } = trpc.document.list.useQuery(
    { companyId: activeCompany?.id ?? 0 },
    { enabled: !!activeCompany }
  );

  const uploadMutation = trpc.document.upload.useMutation();
  const ocrMutation = trpc.document.processWithOCR.useMutation();
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

      const result = await uploadMutation.mutateAsync({
        companyId: activeCompany.id,
        docType: docType as any,
        fileName: selectedFile.name,
        fileBase64: base64,
        mimeType: selectedFile.type,
      });

      toast.success("Document uploaded successfully");

      // Auto-process with OCR for receipts and invoices
      if (docType === "receipt" || docType === "invoice") {
        toast.info("Processing document with AI...");
        try {
          const ocrResult = await ocrMutation.mutateAsync({ documentId: result.id });
          if (ocrResult.needsClarification) {
            toast.warning("AI needs clarification on some items");
          } else {
            toast.success("Document processed successfully");
          }
        } catch {
          toast.error("OCR processing failed — you can retry later");
        }
      }

      await utils.document.list.invalidate();
      setUploadOpen(false);
      setSelectedFile(null);
      setPreview(null);
    } catch (e: any) {
      toast.error(e.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleClarificationSubmit = async () => {
    if (!clarificationDoc || !clarificationResponse) return;
    try {
      await clarifyMutation.mutateAsync({
        documentId: clarificationDoc.id,
        response: clarificationResponse,
      });
      toast.success("Clarification submitted");
      setClarificationDoc(null);
      setClarificationResponse("");
      await utils.document.list.invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const statusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Pending" },
      processing: { variant: "outline", label: "Processing" },
      processed: { variant: "default", label: "Processed" },
      error: { variant: "destructive", label: "Error" },
      needs_clarification: { variant: "destructive", label: "Needs Clarification" },
    };
    const s = variants[status] ?? { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const receipts = documents?.filter(d => d.docType === "receipt") ?? [];
  const invoices = documents?.filter(d => d.docType === "invoice") ?? [];
  const others = documents?.filter(d => d.docType !== "receipt" && d.docType !== "invoice") ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">Upload and manage receipts, invoices, and other documents</p>
        </div>
        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button><Upload className="w-4 h-4 mr-2" />Upload Document</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Upload Document</DialogTitle>
              <DialogDescription>Upload a receipt, invoice, or other document for processing</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Document Type</Label>
                <Select value={docType} onValueChange={setDocType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">Receipt</SelectItem>
                    <SelectItem value="invoice">Invoice</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
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
                <input ref={fileInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={handleFileSelect} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
                <Button variant="outline" className="flex-1" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="w-4 h-4 mr-2" />Browse Files
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => cameraInputRef.current?.click()}>
                  <Camera className="w-4 h-4 mr-2" />Take Photo
                </Button>
              </div>

              <Button onClick={handleUpload} className="w-full" disabled={!selectedFile || uploading}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {uploading ? "Uploading & Processing..." : "Upload"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Clarification Dialog */}
      <Dialog open={!!clarificationDoc} onOpenChange={() => setClarificationDoc(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clarification Needed</DialogTitle>
            <DialogDescription>Our AI needs your help to process this document correctly</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30">
              <p className="text-sm font-medium text-warning-foreground flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                AI Question:
              </p>
              <p className="text-sm mt-1">{clarificationDoc?.clarificationNote}</p>
            </div>
            <div className="space-y-2">
              <Label>Your Response</Label>
              <Textarea
                value={clarificationResponse}
                onChange={e => setClarificationResponse(e.target.value)}
                placeholder="Provide the missing information..."
                rows={3}
              />
            </div>
            <Button onClick={handleClarificationSubmit} className="w-full" disabled={!clarificationResponse || clarifyMutation.isPending}>
              {clarifyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Submit Clarification
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Document Tabs */}
      <Tabs defaultValue="receipts">
        <TabsList>
          <TabsTrigger value="receipts">Receipts ({receipts.length})</TabsTrigger>
          <TabsTrigger value="invoices">Invoices ({invoices.length})</TabsTrigger>
          <TabsTrigger value="others">Others ({others.length})</TabsTrigger>
        </TabsList>

        {["receipts", "invoices", "others"].map(tab => {
          const list = tab === "receipts" ? receipts : tab === "invoices" ? invoices : others;
          return (
            <TabsContent key={tab} value={tab}>
              {isLoading ? (
                <div className="grid gap-3">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />)}
                </div>
              ) : list.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
                    <p className="text-muted-foreground">No {tab} uploaded yet</p>
                    <Button variant="outline" className="mt-3" onClick={() => setUploadOpen(true)}>
                      <Upload className="w-4 h-4 mr-2" />Upload
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {list.map(doc => (
                    <Card key={doc.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="py-3 flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                          {doc.docType === "receipt" ? <Receipt className="w-5 h-5 text-muted-foreground" /> : <FileText className="w-5 h-5 text-muted-foreground" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{doc.fileName}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(doc.createdAt).toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        {statusBadge(doc.status)}
                        <div className="flex gap-1">
                          {doc.status === "needs_clarification" && (
                            <Button variant="outline" size="sm" onClick={() => setClarificationDoc(doc)}>
                              <AlertCircle className="w-3 h-3 mr-1" />Clarify
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => window.open(doc.fileUrl, "_blank")}>
                            <Eye className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
