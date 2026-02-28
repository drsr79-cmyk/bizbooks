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
import { TRANSACTION_CATEGORIES } from "@shared/types";
import { Plus, Loader2, CreditCard, Edit2, CheckCircle2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Transactions() {
  const { activeCompany } = useCompany();
  const [addOpen, setAddOpen] = useState(false);
  const [editingTxn, setEditingTxn] = useState<number | null>(null);
  const [editCategory, setEditCategory] = useState("");

  // Form state
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [txnType, setTxnType] = useState<"debit" | "credit">("debit");
  const [category, setCategory] = useState("");

  const utils = trpc.useUtils();
  const { data: transactions, isLoading } = trpc.transaction.list.useQuery(
    { companyId: activeCompany?.id ?? 0, limit: 200 },
    { enabled: !!activeCompany }
  );

  const createMutation = trpc.transaction.create.useMutation();
  const updateCategoryMutation = trpc.transaction.updateCategory.useMutation();

  const handleCreate = async () => {
    if (!description || !amount || !activeCompany) {
      toast.error("Please fill in all required fields");
      return;
    }
    try {
      await createMutation.mutateAsync({
        companyId: activeCompany.id,
        date,
        description,
        amount,
        transactionType: txnType,
        category: category || undefined,
      });
      toast.success("Transaction added");
      setAddOpen(false);
      setDescription("");
      setAmount("");
      setCategory("");
      await utils.transaction.list.invalidate();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdateCategory = async (txnId: number) => {
    if (!editCategory) return;
    try {
      await updateCategoryMutation.mutateAsync({ transactionId: txnId, category: editCategory });
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
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">View and manage all financial transactions</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Transaction</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Add Transaction</DialogTitle>
              <DialogDescription>Manually record a financial transaction</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="e.g. Office supplies purchase" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Amount (RM)</Label>
                  <Input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={txnType} onValueChange={v => setTxnType(v as "debit" | "credit")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debit">Debit (Expense)</SelectItem>
                      <SelectItem value="credit">Credit (Income)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_CATEGORIES.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Add Transaction
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? (
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
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map(tx => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-sm max-w-[250px] truncate">{tx.description}</TableCell>
                      <TableCell>
                        {editingTxn === tx.id ? (
                          <div className="flex items-center gap-1">
                            <Select value={editCategory} onValueChange={setEditCategory}>
                              <SelectTrigger className="h-8 text-xs w-[160px]"><SelectValue placeholder="Select" /></SelectTrigger>
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
                          <Badge variant={tx.manualOverride ? "default" : "secondary"} className="text-xs cursor-pointer"
                            onClick={() => { setEditingTxn(tx.id); setEditCategory(tx.category ?? ""); }}>
                            {tx.category ?? "Uncategorized"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className={`text-right font-mono text-sm ${tx.transactionType === "credit" ? "text-green-600" : "text-red-500"}`}>
                        {tx.transactionType === "credit" ? "+" : "-"}{parseFloat(tx.amount).toLocaleString("en-MY", { minimumFractionDigits: 2 })}
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
              <p className="text-sm text-muted-foreground mt-1">Add transactions manually or upload a bank statement</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
