import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Loader2 } from "lucide-react";

export function AdminConsole() {
  const [activeTab, setActiveTab] = useState("overview");

  // Admin stats
  const { data: stats, isLoading: statsLoading } = trpc.admin.stats.useQuery();
  const { data: docStats, isLoading: docStatsLoading } = trpc.admin.documentStats.useQuery();

  // Users and companies
  const { data: users, isLoading: usersLoading } = trpc.admin.users.useQuery({
    limit: 50,
    offset: 0,
  });
  const { data: companies, isLoading: companiesLoading } = trpc.admin.companies.useQuery({
    limit: 50,
    offset: 0,
  });

  // Transactions
  const { data: transactions, isLoading: txnsLoading } = trpc.admin.transactions.useQuery({
    limit: 50,
    offset: 0,
  });

  // Audit logs
  const { data: auditLogs, isLoading: auditLoading } = trpc.admin.auditLogs.useQuery({
    limit: 100,
    offset: 0,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Admin Console</h1>
        <p className="text-muted-foreground mt-2">Platform overview and management</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="audit">Audit Logs</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          {statsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Users
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalUsers}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Companies
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalCompanies}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Documents
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalDocuments}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Total Transactions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalTransactions}</div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Advisor Conversations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stats.totalAdvisorConversations}</div>
                  </CardContent>
                </Card>
              </div>

              {/* Document Status Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle>Document Processing Status</CardTitle>
                  <CardDescription>Current document processing statistics</CardDescription>
                </CardHeader>
                <CardContent>
                  {docStatsLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : docStats ? (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{docStats.processed}</div>
                        <div className="text-sm text-muted-foreground">Processed</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-yellow-600">{docStats.pending}</div>
                        <div className="text-sm text-muted-foreground">Pending</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{docStats.processing}</div>
                        <div className="text-sm text-muted-foreground">Processing</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-orange-600">
                          {docStats.needsClarification}
                        </div>
                        <div className="text-sm text-muted-foreground">Clarification</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-600">{docStats.failed}</div>
                        <div className="text-sm text-muted-foreground">Failed</div>
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </>
          ) : null}
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Users</CardTitle>
              <CardDescription>Total: {stats?.totalUsers || 0}</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : users && users.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Name</th>
                        <th className="text-left py-2 px-2">Email</th>
                        <th className="text-left py-2 px-2">Role</th>
                        <th className="text-left py-2 px-2">IC Number</th>
                        <th className="text-left py-2 px-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => (
                        <tr key={user.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2">{user.name || "—"}</td>
                          <td className="py-2 px-2">{user.email || "—"}</td>
                          <td className="py-2 px-2">
                            <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                              {user.role}
                            </Badge>
                          </td>
                          <td className="py-2 px-2">{user.icNumber || "—"}</td>
                          <td className="py-2 px-2 text-xs text-muted-foreground">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No users found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Companies Tab */}
        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Companies</CardTitle>
              <CardDescription>Total: {stats?.totalCompanies || 0}</CardDescription>
            </CardHeader>
            <CardContent>
              {companiesLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : companies && companies.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Company Name</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">SSM Number</th>
                        <th className="text-left py-2 px-2">Tax Number</th>
                        <th className="text-left py-2 px-2">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((company) => (
                        <tr key={company.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 font-medium">{company.name}</td>
                          <td className="py-2 px-2">
                            <Badge variant="outline">{company.companyType}</Badge>
                          </td>
                          <td className="py-2 px-2">{company.ssmNumber}</td>
                          <td className="py-2 px-2">{company.taxNumber || "—"}</td>
                          <td className="py-2 px-2 text-xs text-muted-foreground">
                            {new Date(company.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No companies found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Processing Status</CardTitle>
              <CardDescription>Total: {stats?.totalDocuments || 0}</CardDescription>
            </CardHeader>
            <CardContent>
              {docStatsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : docStats ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-green-600">{docStats.processed}</div>
                      <div className="text-sm text-muted-foreground">Processed</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-yellow-600">{docStats.pending}</div>
                      <div className="text-sm text-muted-foreground">Pending</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-blue-600">{docStats.processing}</div>
                      <div className="text-sm text-muted-foreground">Processing</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-orange-600">
                        {docStats.needsClarification}
                      </div>
                      <div className="text-sm text-muted-foreground">Clarification</div>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <div className="text-2xl font-bold text-red-600">{docStats.failed}</div>
                      <div className="text-sm text-muted-foreground">Failed</div>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Total: {stats?.totalTransactions || 0}</CardDescription>
            </CardHeader>
            <CardContent>
              {txnsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : transactions && transactions.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-2">Date</th>
                        <th className="text-left py-2 px-2">Description</th>
                        <th className="text-left py-2 px-2">Amount</th>
                        <th className="text-left py-2 px-2">Type</th>
                        <th className="text-left py-2 px-2">Category</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn) => (
                        <tr key={txn.id} className="border-b hover:bg-muted/50">
                          <td className="py-2 px-2 text-xs">
                            {new Date(txn.date).toLocaleDateString()}
                          </td>
                          <td className="py-2 px-2">{txn.description}</td>
                          <td className="py-2 px-2 font-medium">
                            {txn.transactionType === "credit" ? "+" : "-"}
                            {parseFloat(txn.amount).toFixed(2)}
                          </td>
                          <td className="py-2 px-2">
                            <Badge variant="outline">{txn.transactionType}</Badge>
                          </td>
                          <td className="py-2 px-2">{txn.category || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No transactions found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Audit Logs Tab */}
        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Audit Logs</CardTitle>
              <CardDescription>Recent system activity</CardDescription>
            </CardHeader>
            <CardContent>
              {auditLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : auditLogs && auditLogs.length > 0 ? (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="p-3 border rounded-lg text-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-medium">
                            {log.action} ({log.resourceType})
                          </div>
                          <div className="text-xs text-muted-foreground">
                            User: {log.userId || "—"} | Company: {log.companyId || "—"}
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(log.createdAt).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">No audit logs found</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
