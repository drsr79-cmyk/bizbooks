import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Loader2, RefreshCw, BarChart3, TrendingUp, Scale } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Financials() {
  const { activeCompany } = useCompany();
  const now = new Date();
  const defaultPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [period, setPeriod] = useState(defaultPeriod);
  const [activeTab, setActiveTab] = useState("profit_loss");
  const [generatedData, setGeneratedData] = useState<Record<string, any>>({});

  const generateMutation = trpc.financial.generateStatement.useMutation();
  const { data: snapshots } = trpc.financial.getSnapshots.useQuery(
    { companyId: activeCompany?.id ?? 0 },
    { enabled: !!activeCompany }
  );

  const handleGenerate = async (type: "profit_loss" | "balance_sheet" | "cash_flow") => {
    if (!activeCompany) return;
    try {
      const result = await generateMutation.mutateAsync({
        companyId: activeCompany.id,
        statementType: type,
        period,
      });
      setGeneratedData(prev => ({ ...prev, [type]: result.data }));
      toast.success("Statement generated successfully");
    } catch (e: any) {
      toast.error(e.message || "Failed to generate statement");
    }
  };

  const formatRM = (amount: number) => `RM ${amount.toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;

  const renderProfitLoss = (data: any) => {
    if (!data || data.error) return <p className="text-muted-foreground text-center py-8">No data available. Generate a statement first.</p>;
    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">{data.title || "Profit & Loss Statement"}</h3>
          <p className="text-sm text-muted-foreground">Period: {data.period || period}</p>
        </div>
        {(data.sections || []).map((section: any, i: number) => (
          <div key={i}>
            <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">{section.name}</h4>
            <Table>
              <TableBody>
                {(section.items || []).map((item: any, j: number) => (
                  <TableRow key={j}>
                    <TableCell className="text-sm pl-4">{item.description}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatRM(item.amount || 0)}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell className="text-sm">Total {section.name}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{formatRM(section.total || 0)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        ))}
        <Separator />
        <div className="flex justify-between items-center px-4 py-3 bg-muted rounded-lg">
          <span className="font-bold text-lg">Net Profit / (Loss)</span>
          <span className={`font-bold text-lg font-mono ${(data.netProfit || 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
            {formatRM(data.netProfit || 0)}
          </span>
        </div>
      </div>
    );
  };

  const renderBalanceSheet = (data: any) => {
    if (!data || data.error) return <p className="text-muted-foreground text-center py-8">No data available. Generate a statement first.</p>;
    const renderSection = (title: string, items: any[], total: number) => (
      <div>
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
        <Table>
          <TableBody>
            {(items || []).map((item: any, j: number) => (
              <TableRow key={j}>
                <TableCell className="text-sm pl-4">{item.description}</TableCell>
                <TableCell className="text-right font-mono text-sm">{formatRM(item.amount || 0)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold border-t-2">
              <TableCell className="text-sm">Total {title}</TableCell>
              <TableCell className="text-right font-mono text-sm">{formatRM(total || 0)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">{data.title || "Balance Sheet"}</h3>
          <p className="text-sm text-muted-foreground">As at: {data.period || period}</p>
        </div>
        <h3 className="font-bold text-base">ASSETS</h3>
        {renderSection("Current Assets", data.assets?.current, 0)}
        {renderSection("Non-Current Assets", data.assets?.nonCurrent, 0)}
        <div className="flex justify-between items-center px-4 py-2 bg-primary/5 rounded-lg">
          <span className="font-bold">Total Assets</span>
          <span className="font-bold font-mono">{formatRM(data.assets?.totalAssets || 0)}</span>
        </div>
        <Separator />
        <h3 className="font-bold text-base">LIABILITIES</h3>
        {renderSection("Current Liabilities", data.liabilities?.current, 0)}
        {renderSection("Non-Current Liabilities", data.liabilities?.nonCurrent, 0)}
        <div className="flex justify-between items-center px-4 py-2 bg-muted rounded-lg">
          <span className="font-bold">Total Liabilities</span>
          <span className="font-bold font-mono">{formatRM(data.liabilities?.totalLiabilities || 0)}</span>
        </div>
        <Separator />
        <h3 className="font-bold text-base">EQUITY</h3>
        {renderSection("Equity", data.equity?.items, data.equity?.totalEquity)}
        <div className="flex justify-between items-center px-4 py-3 bg-muted rounded-lg">
          <span className="font-bold text-lg">Total Liabilities + Equity</span>
          <span className="font-bold text-lg font-mono">
            {formatRM((data.liabilities?.totalLiabilities || 0) + (data.equity?.totalEquity || 0))}
          </span>
        </div>
      </div>
    );
  };

  const renderCashFlow = (data: any) => {
    if (!data || data.error) return <p className="text-muted-foreground text-center py-8">No data available. Generate a statement first.</p>;
    const renderActivity = (title: string, activity: any) => (
      <div>
        <h4 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mb-2">{title}</h4>
        <Table>
          <TableBody>
            {(activity?.items || []).map((item: any, j: number) => (
              <TableRow key={j}>
                <TableCell className="text-sm pl-4">{item.description}</TableCell>
                <TableCell className={`text-right font-mono text-sm ${(item.amount || 0) >= 0 ? "text-green-600" : "text-red-500"}`}>
                  {formatRM(item.amount || 0)}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold border-t-2">
              <TableCell className="text-sm">Net {title}</TableCell>
              <TableCell className="text-right font-mono text-sm">{formatRM(activity?.total || 0)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="text-center mb-4">
          <h3 className="text-lg font-semibold">{data.title || "Cash Flow Statement"}</h3>
          <p className="text-sm text-muted-foreground">Period: {data.period || period}</p>
        </div>
        {renderActivity("Operating Activities", data.operating)}
        {renderActivity("Investing Activities", data.investing)}
        {renderActivity("Financing Activities", data.financing)}
        <Separator />
        <div className="space-y-2 px-4">
          <div className="flex justify-between"><span className="text-sm">Net Cash Flow</span><span className="font-mono text-sm">{formatRM(data.netCashFlow || 0)}</span></div>
          <div className="flex justify-between"><span className="text-sm">Opening Balance</span><span className="font-mono text-sm">{formatRM(data.openingBalance || 0)}</span></div>
          <div className="flex justify-between items-center py-2 bg-muted rounded-lg px-3">
            <span className="font-bold">Closing Balance</span>
            <span className="font-bold font-mono">{formatRM(data.closingBalance || 0)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financial Statements</h1>
        <p className="text-muted-foreground">Generate and view Profit & Loss, Balance Sheet, and Cash Flow statements</p>
      </div>

      <div className="flex items-center gap-3">
        <Label className="shrink-0">Period:</Label>
        <Input type="month" value={period} onChange={e => setPeriod(e.target.value)} className="w-48" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profit_loss" className="gap-2">
            <TrendingUp className="w-4 h-4" />
            <span className="hidden sm:inline">Profit & Loss</span>
            <span className="sm:hidden">P&L</span>
          </TabsTrigger>
          <TabsTrigger value="balance_sheet" className="gap-2">
            <Scale className="w-4 h-4" />
            <span className="hidden sm:inline">Balance Sheet</span>
            <span className="sm:hidden">BS</span>
          </TabsTrigger>
          <TabsTrigger value="cash_flow" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">Cash Flow</span>
            <span className="sm:hidden">CF</span>
          </TabsTrigger>
        </TabsList>

        {(["profit_loss", "balance_sheet", "cash_flow"] as const).map(type => (
          <TabsContent key={type} value={type}>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {type === "profit_loss" ? "Profit & Loss" : type === "balance_sheet" ? "Balance Sheet" : "Cash Flow Statement"}
                  </CardTitle>
                  <CardDescription>
                    {type === "profit_loss" ? "Revenue, expenses, and net profit for the period" :
                     type === "balance_sheet" ? "Assets, liabilities, and equity at period end" :
                     "Cash movements from operations, investing, and financing"}
                  </CardDescription>
                </div>
                <Button onClick={() => handleGenerate(type)} disabled={generateMutation.isPending}>
                  {generateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                  Generate
                </Button>
              </CardHeader>
              <CardContent>
                {type === "profit_loss" && renderProfitLoss(generatedData.profit_loss)}
                {type === "balance_sheet" && renderBalanceSheet(generatedData.balance_sheet)}
                {type === "cash_flow" && renderCashFlow(generatedData.cash_flow)}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Previous Snapshots */}
      {snapshots && snapshots.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Previous Statements</CardTitle>
            <CardDescription>Previously generated financial statements</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {snapshots.slice(0, 10).map(snap => (
                <div key={snap.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">
                        {snap.statementType === "profit_loss" ? "Profit & Loss" :
                         snap.statementType === "balance_sheet" ? "Balance Sheet" : "Cash Flow"}
                      </p>
                      <p className="text-xs text-muted-foreground">Period: {snap.period}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(snap.createdAt).toLocaleDateString("en-MY")}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => {
                      setGeneratedData(prev => ({ ...prev, [snap.statementType]: snap.data }));
                      setActiveTab(snap.statementType);
                    }}>
                      View
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
