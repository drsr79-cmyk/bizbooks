import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      // Check if user is onboarded
      const u = user as any;
      if (u && !u.onboarded) {
        setLocation("/onboarding");
      } else {
        setLocation("/dashboard");
      }
    }
  }, [loading, isAuthenticated, user, setLocation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading BizBooks...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="flex flex-col items-center justify-center min-h-screen px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Smart Accounting for Malaysian Businesses
            </div>
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
              Your Complete<br />
              <span className="text-primary">Accounting Platform</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg mx-auto leading-relaxed">
              Upload receipts, auto-categorize bank statements, generate financial reports, and get expert AI advice — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <a
                href={getLoginUrl()}
                className="inline-flex items-center justify-center rounded-lg bg-primary text-primary-foreground px-8 py-3 font-medium hover:bg-primary/90 transition-colors"
              >
                Get Started
              </a>
            </div>
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              {[
                { label: "Receipt OCR", desc: "Snap & upload" },
                { label: "Auto-Categorize", desc: "Bank statements" },
                { label: "Financial Reports", desc: "P&L, BS, CF" },
                { label: "AI Advisors", desc: "5 experts" },
              ].map(item => (
                <div key={item.label}>
                  <p className="font-semibold text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  );
}
