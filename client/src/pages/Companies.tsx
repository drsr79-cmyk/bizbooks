import { useCompany } from "@/contexts/CompanyContext";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { COMPANY_TYPE_LABELS } from "@shared/types";
import type { CompanyType } from "@shared/types";
import { Building2, Plus, Loader2, CheckCircle2, Users, UserPlus, Shield, ShieldCheck, Trash2, Crown, Eye, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function Companies() {
  const { companies, activeCompany, setActiveCompanyId, isLoading } = useCompany();
  const [addOpen, setAddOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<number | null>(null);

  // Add company form
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType | "">("");
  const [ssmNumber, setSsmNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerIc, setOwnerIc] = useState("");
  const [address, setAddress] = useState("");

  // Invite member form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"owner" | "staff">("staff");
  const [inviteAccess, setInviteAccess] = useState<"full" | "limited">("full");

  const utils = trpc.useUtils();
  const createCompany = trpc.company.create.useMutation();
  const addMember = trpc.company.addMember.useMutation();
  const updateMember = trpc.company.updateMember.useMutation();
  const removeMember = trpc.company.removeMember.useMutation();

  const membersQuery = trpc.company.getMembers.useQuery(
    { companyId: selectedCompanyId! },
    { enabled: !!selectedCompanyId && memberOpen }
  );

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
      setCompanyName(""); setCompanyType(""); setSsmNumber(""); setTaxNumber(""); setOwnerName(""); setOwnerIc(""); setAddress("");
      await utils.company.list.invalidate();
      setActiveCompanyId(result.id);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !selectedCompanyId) {
      toast.error("Please enter an email address");
      return;
    }
    try {
      const result = await addMember.mutateAsync({
        companyId: selectedCompanyId,
        userEmail: inviteEmail,
        memberRole: inviteRole,
        accessLevel: inviteAccess,
      });
      toast.success(`${result.userName || "User"} added to the company`);
      setInviteOpen(false);
      setInviteEmail(""); setInviteRole("staff"); setInviteAccess("full");
      await membersQuery.refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleUpdateMember = async (memberId: number, field: "memberRole" | "accessLevel", value: string) => {
    if (!selectedCompanyId) return;
    try {
      const data: any = { memberId, companyId: selectedCompanyId };
      data[field] = value;
      await updateMember.mutateAsync(data);
      toast.success("Member updated");
      await membersQuery.refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!selectedCompanyId) return;
    try {
      await removeMember.mutateAsync({ memberId, companyId: selectedCompanyId });
      toast.success("Member removed");
      await membersQuery.refetch();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const openMemberPanel = (companyId: number) => {
    setSelectedCompanyId(companyId);
    setMemberOpen(true);
  };

  const isOwnerOfSelected = companies.find(c => c.id === selectedCompanyId)?.memberRole === "owner";

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
              className={`transition-all hover:shadow-md ${
                activeCompany?.id === company.id ? "ring-2 ring-primary" : ""
              }`}
            >
              <CardHeader className="pb-3 cursor-pointer" onClick={() => setActiveCompanyId(company.id)}>
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
                <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                  <div>
                    <span className="text-muted-foreground text-xs block">SSM Number</span>
                    <span className="font-mono block">{company.ssmNumber}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs block">Your Role</span>
                    <Badge variant="outline" className="capitalize">
                      {company.memberRole === "owner" ? <Crown className="w-3 h-3 mr-1" /> : null}
                      {company.memberRole}
                    </Badge>
                  </div>
                </div>
                <Separator className="my-3" />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={(e) => { e.stopPropagation(); openMemberPanel(company.id); }}
                >
                  <Users className="w-4 h-4 mr-2" />Manage Members
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Member Management Dialog */}
      <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Team Members
            </DialogTitle>
            <DialogDescription>
              Manage who has access to this company and what they can do
            </DialogDescription>
          </DialogHeader>

          {isOwnerOfSelected && (
            <div className="flex justify-end">
              <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
                <DialogTrigger asChild>
                  <Button size="sm"><UserPlus className="w-4 h-4 mr-2" />Add Member</Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Add Team Member</DialogTitle>
                    <DialogDescription>
                      The person must have already signed up on BizBooks. Enter their registered email.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        value={inviteEmail}
                        onChange={e => setInviteEmail(e.target.value)}
                        placeholder="colleague@company.com"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={inviteRole} onValueChange={v => setInviteRole(v as "owner" | "staff")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="owner">
                              <div className="flex items-center gap-2">
                                <Crown className="w-3 h-3" />Owner
                              </div>
                            </SelectItem>
                            <SelectItem value="staff">
                              <div className="flex items-center gap-2">
                                <Users className="w-3 h-3" />Staff
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Access Level</Label>
                        <Select value={inviteAccess} onValueChange={v => setInviteAccess(v as "full" | "limited")}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="full">
                              <div className="flex items-center gap-2">
                                <ShieldCheck className="w-3 h-3" />Full Access
                              </div>
                            </SelectItem>
                            <SelectItem value="limited">
                              <div className="flex items-center gap-2">
                                <Eye className="w-3 h-3" />Limited
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                      {inviteRole === "owner" ? (
                        <span><strong>Owner</strong> — Full access to all data, financial reports, income statements, and member management.</span>
                      ) : inviteAccess === "full" ? (
                        <span><strong>Staff (Full Access)</strong> — Can upload documents, view and edit transactions, but cannot access income statements or financial reports.</span>
                      ) : (
                        <span><strong>Staff (Limited)</strong> — Can only upload documents. Cannot edit or delete transactions.</span>
                      )}
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
                    <Button onClick={handleInvite} disabled={addMember.isPending}>
                      {addMember.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <UserPlus className="w-4 h-4 mr-2" />}
                      Add Member
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          )}

          <div className="space-y-3">
            {membersQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : membersQuery.data?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No members found</div>
            ) : (
              membersQuery.data?.map(member => (
                <Card key={member.id} className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-sm font-semibold text-primary">
                          {(member.userName || "?")[0]?.toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{member.userName || "Unknown User"}</div>
                        <div className="text-xs text-muted-foreground truncate">{member.userEmail || "No email"}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {isOwnerOfSelected ? (
                        <>
                          <Select
                            value={member.memberRole}
                            onValueChange={v => handleUpdateMember(member.id, "memberRole", v)}
                          >
                            <SelectTrigger className="w-[110px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">
                                <span className="flex items-center gap-1"><Crown className="w-3 h-3" />Owner</span>
                              </SelectItem>
                              <SelectItem value="staff">
                                <span className="flex items-center gap-1"><Users className="w-3 h-3" />Staff</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          <Select
                            value={member.accessLevel}
                            onValueChange={v => handleUpdateMember(member.id, "accessLevel", v)}
                          >
                            <SelectTrigger className="w-[120px] h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="full">
                                <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Full Access</span>
                              </SelectItem>
                              <SelectItem value="limited">
                                <span className="flex items-center gap-1"><Eye className="w-3 h-3" />Limited</span>
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Remove Member</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to remove {member.userName || "this user"} from the company? They will lose all access.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleRemoveMember(member.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                  Remove
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      ) : (
                        <>
                          <Badge variant="outline" className="capitalize text-xs">
                            {member.memberRole === "owner" ? <Crown className="w-3 h-3 mr-1" /> : null}
                            {member.memberRole}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {member.accessLevel === "full" ? "Full Access" : "Limited"}
                          </Badge>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
