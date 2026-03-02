import { trpc } from "@/lib/trpc";
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

type CompanyWithRole = {
  id: number;
  name: string;
  companyType: string;
  ssmNumber: string;
  taxNumber: string | null;
  memberRole: string;
  accessLevel: string;
  permissions: any;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

type CompanyContextType = {
  companies: CompanyWithRole[];
  activeCompany: CompanyWithRole | null;
  setActiveCompanyId: (id: number) => void;
  isLoading: boolean;
};

const CompanyContext = createContext<CompanyContextType>({
  companies: [],
  activeCompany: null,
  setActiveCompanyId: () => {},
  isLoading: true,
});

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { data: companies, isLoading } = trpc.company.list.useQuery();
  const [activeCompanyId, setActiveCompanyId] = useState<number | null>(() => {
    const saved = localStorage.getItem("bizbooks_active_company");
    return saved ? parseInt(saved, 10) : null;
  });

  useEffect(() => {
    if (companies && companies.length > 0 && !activeCompanyId) {
      setActiveCompanyId(companies[0].id);
    }
  }, [companies, activeCompanyId]);

  useEffect(() => {
    if (activeCompanyId) {
      localStorage.setItem("bizbooks_active_company", activeCompanyId.toString());
    }
  }, [activeCompanyId]);

  const activeCompany = companies?.find(c => c.id === activeCompanyId) ?? companies?.[0] ?? null;

  return (
    <CompanyContext.Provider value={{
      companies: (companies ?? []) as CompanyWithRole[],
      activeCompany: activeCompany as CompanyWithRole | null,
      setActiveCompanyId,
      isLoading,
    }}>
      {children}
    </CompanyContext.Provider>
  );
}

export function useCompany() {
  return useContext(CompanyContext);
}
