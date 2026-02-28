import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { COMPANY_TYPE_LABELS } from "@shared/types";
import type { CompanyType } from "@shared/types";
import { Building2, ChevronRight, User, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";

type Step = "profile" | "role" | "company" | "done";

export default function Onboarding() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState<Step>("profile");
  const [designation, setDesignation] = useState<"owner" | "staff" | "">("");

  // Profile fields
  const [fullName, setFullName] = useState(user?.name ?? "");
  const [icNumber, setIcNumber] = useState("");
  const [phone, setPhone] = useState("");

  // Company fields
  const [companyName, setCompanyName] = useState("");
  const [companyType, setCompanyType] = useState<CompanyType | "">("");
  const [ssmNumber, setSsmNumber] = useState("");
  const [taxNumber, setTaxNumber] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerIc, setOwnerIc] = useState("");
  const [address, setAddress] = useState("");

  const updateProfile = trpc.onboarding.updateProfile.useMutation();
  const createCompany = trpc.company.create.useMutation();
  const completeOnboarding = trpc.onboarding.completeOnboarding.useMutation();
  const utils = trpc.useUtils();

  const handleProfileSubmit = async () => {
    if (!fullName || !icNumber) {
      toast.error("Please fill in your name and IC number");
      return;
    }
    try {
      await updateProfile.mutateAsync({ name: fullName, icNumber, phone });
      setStep("role");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRoleSelect = (role: "owner" | "staff") => {
    setDesignation(role);
    if (role === "owner") {
      setOwnerName(fullName);
      setOwnerIc(icNumber);
      setStep("company");
    } else {
      // Staff flow — complete onboarding, they'll be added to companies by owners
      handleCompleteOnboarding();
    }
  };

  const handleCompanySubmit = async () => {
    if (!companyName || !companyType || !ssmNumber) {
      toast.error("Please fill in company name, type, and SSM number");
      return;
    }
    try {
      await createCompany.mutateAsync({
        name: companyName,
        companyType: companyType as CompanyType,
        ssmNumber,
        taxNumber: taxNumber || undefined,
        ownerName: ownerName || undefined,
        ownerIc: ownerIc || undefined,
        address: address || undefined,
      });
      await handleCompleteOnboarding();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleCompleteOnboarding = async () => {
    try {
      await completeOnboarding.mutateAsync();
      await utils.auth.me.invalidate();
      setStep("done");
      setTimeout(() => setLocation("/"), 1500);
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const isLoading = updateProfile.isPending || createCompany.isPending || completeOnboarding.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {["profile", "role", "company"].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                step === s ? "bg-primary text-primary-foreground" :
                ["profile", "role", "company"].indexOf(step) > i ? "bg-primary/20 text-primary" :
                "bg-muted text-muted-foreground"
              }`}>
                {["profile", "role", "company"].indexOf(step) > i ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : i + 1}
              </div>
              {i < 2 && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
            </div>
          ))}
        </div>

        {/* Step: Profile */}
        {step === "profile" && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <User className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Welcome to BizBooks</CardTitle>
              <CardDescription>Let's set up your profile to get started</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name (as per IC)</Label>
                <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Enter your full name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="icNumber">IC Number (MyKad)</Label>
                <Input id="icNumber" value={icNumber} onChange={e => setIcNumber(e.target.value)} placeholder="e.g. 900101-01-1234" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number (optional)</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 012-345 6789" />
              </div>
              <Button onClick={handleProfileSubmit} className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Role Selection */}
        {step === "role" && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">What's your role?</CardTitle>
              <CardDescription>This determines your access level on the platform</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <button
                onClick={() => handleRoleSelect("owner")}
                className="w-full p-4 rounded-lg border-2 border-border hover:border-primary transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Business Owner</p>
                    <p className="text-sm text-muted-foreground">Register your company and manage everything</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleRoleSelect("staff")}
                className="w-full p-4 rounded-lg border-2 border-border hover:border-primary transition-colors text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">Staff Member</p>
                    <p className="text-sm text-muted-foreground">Join an existing company (owner will grant access)</p>
                  </div>
                </div>
              </button>
            </CardContent>
          </Card>
        )}

        {/* Step: Company Registration */}
        {step === "company" && (
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-xl">Register Your Company</CardTitle>
              <CardDescription>Enter your company details as registered with SSM</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input id="companyName" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Enter company name" />
              </div>
              <div className="space-y-2">
                <Label>Company Type</Label>
                <Select value={companyType} onValueChange={v => setCompanyType(v as CompanyType)}>
                  <SelectTrigger><SelectValue placeholder="Select company type" /></SelectTrigger>
                  <SelectContent>
                    {(Object.entries(COMPANY_TYPE_LABELS) as [CompanyType, string][]).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ssmNumber">SSM Registration Number</Label>
                <Input id="ssmNumber" value={ssmNumber} onChange={e => setSsmNumber(e.target.value)} placeholder="e.g. 202301012345" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxNumber">Tax Number (optional)</Label>
                <Input id="taxNumber" value={taxNumber} onChange={e => setTaxNumber(e.target.value)} placeholder="e.g. C-1234-5678" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerNameField">Owner Name</Label>
                <Input id="ownerNameField" value={ownerName} onChange={e => setOwnerName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerIcField">Owner IC Number</Label>
                <Input id="ownerIcField" value={ownerIc} onChange={e => setOwnerIc(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Business Address (optional)</Label>
                <Textarea id="address" value={address} onChange={e => setAddress(e.target.value)} placeholder="Enter business address" rows={2} />
              </div>
              <Button onClick={handleCompanySubmit} className="w-full" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Register Company
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h2 className="text-xl font-semibold mb-2">You're all set!</h2>
              <p className="text-muted-foreground">Redirecting to your dashboard...</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
