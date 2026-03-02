import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Loader2, TrendingUp, Upload, FileText, X } from "lucide-react";
import { useState, useMemo, useRef } from "react";
import { toast } from "sonner";

const LINE_TYPE_LABELS: Record<string, string> = {
  revenue: "Revenue",
  cost_of_goods: "Cost of Goods Sold",
  operating_expense: "Operating Expense",
  other_income: "Other Income",
  other_expense: "Other Expense",
  tax: "Tax",
};

const LINE_TYPE_COLORS: Record<string, string> = {
  revenue: "text-green-600",
  cost_of_goods: "text-red-500",
  operating_expense: "text-red-500",
  other_income: "text-green-600",
  other_expense: "text-red-500",
  tax: "text-orange-500",
};

export default function IncomeStatement() {
  const { activeCompany } = useCompany();
  const [addOpen, setAddOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [lineType, setLineType] = useState<string>("revenue");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const utils = trpc.useUtils();
  const { data: lines, isLoading } = trpc.incomeStatement.list.useQuery(
    { companyId: activeCompany?.id ?? 0, period },
    { enabled: !!activeCompany }
  );

  const addLineMutation = trpc.incomeStatement.addLine.useMutation();
  const deleteLineMutation = trpc.incomeStatement.deleteLine.useMutation();
  const uploadMutation = trpc.document.upload.useMutation();
  const ocrMutation = trpc.document.processWithOCR.useMutation();

  const handleAddLine = async () => {
    if (!description || !amount || !activeCompany) {
      toast.error("Please fill in all fields");
      return;
    }
    try {
      await addLineMutation.mutateAsync({
        companyId: activeCompany.id,
        period,
        lineType: lineType as any,
        description,
        amount,
      });
      toast.success("Line item added");
      setDescription("");
      setAmount("");
      setAddOpen(false);
      await utils.incomeStatement.list.invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteLineMutation.mutateAsync({ lineId: id, companyId: activeCompany!.id });
      toast.success("Line item removed");
      await utils.incomeStatement.list.invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUploadStatement = async () => {
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
        docType: "income_statement",
        fileName: selectedFile.name,
        fileBase64: base64,
        mimeType: selectedFile.type,
      });

      toast.success("Income statement uploaded");
      try {
        await ocrMutation.mutateAsync({ documentId: result.id });
        toast.success("Document processed with AI");
      } catch {
        toast.info("Upload successful. Manual entry may be needed.");
      }

      setUploadOpen(false);
      setSelectedFile(null);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  // Group lines by type and calculate totals
  const grouped = useMemo(() => {
    if (!lines) return {};
    const groups: Record<string, typeof lines> = {};
    for (const line of lines) {
      if (!groups[line.lineType]) groups[line.lineType] = [];
      groups[line.lineType].push(line);
    }
    return groups;
  }, [lines]);

  const totalRevenue = (grouped["revenue"] ?? []).reduce((s, l) => s + parseFloat(l.amount), 0)
    + (grouped["other_income"] ?? []).reduce((s, l) => s + parseFloat(l.amount), 0);
  const totalExpenses = (grouped["cost_of_goods"] ?? []).reduce((s, l) => s + parseFloat(l.amount), 0)
    + (grouped["operating_expense"] ?? []).reduce((s, l) => s + parseFloat(l.amount), 0)
    + (grouped["other_expense"] ?? []).reduce((s, l) => s + parseFloat(l.amount), 0);
  const totalTax = (grouped["tax"] ?? []).reduce((s, l) => s + parseFloat(l.amount), 0);
  const netIncome = totalRevenue - totalExpenses - totalTax;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Income Statement</h1>
          <p className="text-muted-foreground">Upload or manually input income statement line items</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Upload className="w-4 h-4 mr-2" />Upload</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Upload Income Statement</DialogTitle>
                <DialogDescription>Upload an existing income statement document</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
                  <input ref={fileInputRef} type="file" accept="image/*,.pdf,.csv,.xlsx" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
                  <Button variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />Select File
                  </Button>
                </div>
                <Button onClick={handleUploadStatement} className="w-full" disabled={!selectedFile || uploading}>
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Upload & Process
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" />Add Line Item</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Line Item</DialogTitle>
                <DialogDescription>Manually add an income statement entry</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Period</Label>
                  <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={lineType} onValueChange={setLineType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(LINE_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Product Sales" />
                </div>
                <div className="space-y-2">
                  <Label>Amount (RM)</Label>
                  <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <Button onClick={handleAddLine} className="w-full" disabled={addLineMutation.isPending}>
                  {addLineMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Add Line Item
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Period Selector */}
      <div className="flex items-center gap-3">
        <Label className="shrink-0">Period:</Label>
        <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="w-48" />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Total Revenue</p>
            <p className="text-xl font-bold text-green-600 mt-1">RM {totalRevenue.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Total Expenses</p>
            <p className="text-xl font-bold text-red-500 mt-1">RM {totalExpenses.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Tax</p>
            <p className="text-xl font-bold text-orange-500 mt-1">RM {totalTax.toLocaleString("en-MY", { minimumFractionDigits: 2 })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-muted-foreground">Net Income</p>
            <p className={`text-xl font-bold mt-1 ${netIncome >= 0 ? "text-green-600" : "text-red-500"}`}>
              RM {netIncome.toLocaleString("en-MY", { minimumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted animate-pulse rounded" />)}
            </div>
          ) : lines && lines.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount (RM)</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map(line => (
                  <TableRow key={line.id}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">{LINE_TYPE_LABELS[line.lineType] ?? line.lineType}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{line.description}</TableCell>
                    <TableCell className={`text-right font-mono text-sm ${LINE_TYPE_COLORS[line.lineType] ?? ""}`}>
                      {parseFloat(line.amount).toLocaleString("en-MY", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(line.id)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <TrendingUp className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-muted-foreground">No line items for this period</p>
              <p className="text-sm text-muted-foreground mt-1">Add items manually or upload a statement</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
