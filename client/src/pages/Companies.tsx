import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { COMPANY_TYPE_LABELS } from "@shared/types";
import type { CompanyType } from "@shared/types";
import { Building2, Plus, Loader2, CheckCircle2, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Companies() {
  const { companies, activeCompany, setActiveCompanyId, isLoading } = useCompany();
  const [addOpen, setAddOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType | "">("");
  const [ssmNumber, setSsmNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerIc, setOwnerIc] = useState("");
  const [address, setAddress] = useState("");

  const utils = trpc.useUtils();
  const createCompany = trpc.company.create.useMutation();

  const handleCreate = async () => {
    if (!companyName || !companyType || !ssmNumber) {
      toast.error("Please fill in company name, type, and SSM number");
      return;
    }
    try {
      const result = await createCompany.mutateAsync({
        name: companyName,
        companyType: companyType as CompanyType,
        ssmNumber,
        taxNumber: taxNumber || undefined,
        ownerName: ownerName || undefined,
        ownerIc: ownerIc || undefined,
        address: address || undefined,
      });
      toast.success("Company registered successfully");
      setAddOpen(false);
      setCompanyName("");
      setCompanyType("");
      setSsmNumber("");
      setTaxNumber("");
      setOwnerName("");
      setOwnerIc("");
      setAddress("");
      await utils.company.list.invalidate();
      setActiveCompanyId(result.id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">Manage all your companies under one platform</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Add Company</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Register New Company</DialogTitle>
              <DialogDescription>Enter company details as registered with SSM</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              <div className="space-y-2">
                <Label>Company Name</Label>
                <Input value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Enter company name" />
              </div>
              <div className="space-y-2">
                <Label>Company Type</Label>
                <Select value={companyType} onValueChange={v => setCompanyType(v as CompanyType)}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(COMPANY_TYPE_LABELS) as [CompanyType, string][]).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>SSM Registration Number</Label>
                <Input value={ssmNumber} onChange={e => setSsmNumber(e.target.value)} placeholder="e.g. 202301012345" />
              </div>
              <div className="space-y-2">
                <Label>Tax Number (optional)</Label>
                <Input value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="e.g. C-1234-5678" />
              </div>
              <div className="space-y-2">
                <Label>Owner Name</Label>
                <Input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Owner's full name" />
              </div>
              <div className="space-y-2">
                <Label>Owner IC Number</Label>
                <Input value={ownerIc} onChange={e => setOwnerIc(e.target.value)} placeholder="e.g. 900101-01-1234" />
              </div>
              <div className="space-y-2">
                <Label>Business Address (optional)</Label>
                <Textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter address" rows={2} />
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={createCompany.isPending}>
                {createCompany.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Register Company
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2].map(i => <div key={i} className="h-40 bg-muted animate-pulse rounded-lg" />)}
        </div>
      ) : companies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
            <h3 className="text-lg font-semibold mb-1">No companies yet</h3>
            <p className="text-muted-foreground mb-4">Register your first company to get started</p>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />Register Company
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {companies.map(company => (
            <Card
              key={company.id}
              className={`cursor-pointer transition-all hover:shadow-md ${
                activeCompany?.id === company.id ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => setActiveCompanyId(company.id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{company.name}</CardTitle>
                      <CardDescription className="text-xs">
                        {COMPANY_TYPE_LABELS[company.companyType as CompanyType] ?? company.companyType}
                      </CardDescription>
                    </div>
                  </div>
                  {activeCompany?.id === company.id && (
                    <Badge className="bg-primary/10 text-primary border-0">
                      <CheckCircle2 className="w-3 h-3 mr-1" />Active
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs block">SSM Number</span>
                    <span className="font-mono block">{company.ssmNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Your Role</span>
                    <Badge variant="outline" className="capitalize">{company.memberRole}</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
