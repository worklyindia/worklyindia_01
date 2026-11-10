import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLoginActivity, useNewAccounts } from "@/hooks/useOwnerAnalytics";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

export const ActivityTimeline = () => {
  const [period, setPeriod] = useState("today");
  const { data: loginData, isLoading: loginLoading } = useLoginActivity(period);
  const { data: accountsData, isLoading: accountsLoading } = useNewAccounts(period);

  const periods = [
    { value: "today", label: "Today" },
    { value: "7days", label: "7 Days" },
    { value: "30days", label: "30 Days" },
    { value: "6months", label: "6 Months" },
    { value: "1year", label: "1 Year" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Activity Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={period} onValueChange={setPeriod}>
          <TabsList className="grid grid-cols-5 w-full mb-4 overflow-x-auto">
            {periods.map((p) => (
              <TabsTrigger key={p.value} value={p.value} className="text-xs sm:text-sm whitespace-nowrap">
                {p.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {periods.map((p) => (
            <TabsContent key={p.value} value={p.value} className="space-y-4">
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[100px]">Date</TableHead>
                      <TableHead className="text-right whitespace-nowrap min-w-[100px]">Job Seekers</TableHead>
                      <TableHead className="text-right whitespace-nowrap min-w-[100px]">Employers</TableHead>
                      <TableHead className="text-right whitespace-nowrap min-w-[100px]">Total</TableHead>
                      <TableHead className="text-right whitespace-nowrap min-w-[80px]">Logins</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accountsLoading || loginLoading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                          <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                        </TableRow>
                      ))
                    ) : accountsData && accountsData.length > 0 ? (
                      accountsData.map((account) => {
                        const login = loginData?.find(
                          (l) => l.period_date === account.period_date
                        );
                        return (
                          <TableRow key={account.period_date}>
                            <TableCell>
                              {format(new Date(account.period_date), "MMMM dd, yyyy")}
                            </TableCell>
                            <TableCell className="text-right">
                              {account.jobseeker_accounts}
                            </TableCell>
                            <TableCell className="text-right">
                              {account.employer_accounts}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {account.total_new_accounts}
                            </TableCell>
                            <TableCell className="text-right">
                              {login?.unique_users || 0}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground">
                          No activity data for this period
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
};
