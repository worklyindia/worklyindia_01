import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface JobLocationData {
  country: string;
  state: string;
  city: string;
  total_jobs: number;
  active_jobs: number;
  public_jobs: number;
  draft_jobs: number;
}

interface JobLocationDistributionTableProps {
  data?: JobLocationData[];
  isLoading?: boolean;
}

export const JobLocationDistributionTable = ({ data, isLoading }: JobLocationDistributionTableProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredData = data?.filter(
    (item) =>
      item.country.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.state.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group by country and state
  const groupedData = filteredData?.reduce((acc, item) => {
    const countryKey = item.country;
    if (!acc[countryKey]) {
      acc[countryKey] = {};
    }
    const stateKey = item.state;
    if (!acc[countryKey][stateKey]) {
      acc[countryKey][stateKey] = [];
    }
    acc[countryKey][stateKey].push(item);
    return acc;
  }, {} as Record<string, Record<string, JobLocationData[]>>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job Geographic Distribution</CardTitle>
        <div className="relative mt-4">
          <div className="absolute left-2 top-2.5 pointer-events-none"><LottieSearchIcon size={16} /></div>
          <Input
            placeholder="Search country, state, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border max-h-[500px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[200px]">Country / State / City</TableHead>
                <TableHead className="text-right whitespace-nowrap">Total</TableHead>
                <TableHead className="text-right whitespace-nowrap">Active</TableHead>
                <TableHead className="text-right whitespace-nowrap">Public</TableHead>
                <TableHead className="text-right whitespace-nowrap">Draft</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                    <TableCell><Skeleton className="h-4 w-16 ml-auto" /></TableCell>
                  </TableRow>
                ))
              ) : groupedData && Object.keys(groupedData).length > 0 ? (
                Object.entries(groupedData).map(([country, states]) => {
                  // Calculate country totals
                  const countryTotal = Object.values(states).reduce(
                    (sum, cities) => ({
                      total: sum.total + cities.reduce((s, c) => s + c.total_jobs, 0),
                      active: sum.active + cities.reduce((s, c) => s + c.active_jobs, 0),
                      public: sum.public + cities.reduce((s, c) => s + c.public_jobs, 0),
                      draft: sum.draft + cities.reduce((s, c) => s + c.draft_jobs, 0),
                    }),
                    { total: 0, active: 0, public: 0, draft: 0 }
                  );

                  return (
                    <>
                      {/* Country Row */}
                      <TableRow key={country} className="bg-muted/50 font-semibold">
                        <TableCell className="font-bold">{country}</TableCell>
                        <TableCell className="text-right font-bold">{countryTotal.total}</TableCell>
                        <TableCell className="text-right font-bold">{countryTotal.active}</TableCell>
                        <TableCell className="text-right font-bold">{countryTotal.public}</TableCell>
                        <TableCell className="text-right font-bold">{countryTotal.draft}</TableCell>
                      </TableRow>
                      {/* State and City Rows */}
                      {Object.entries(states).map(([state, cities]) => {
                        // Calculate state totals
                        const stateTotal = cities.reduce(
                          (sum, c) => ({
                            total: sum.total + c.total_jobs,
                            active: sum.active + c.active_jobs,
                            public: sum.public + c.public_jobs,
                            draft: sum.draft + c.draft_jobs,
                          }),
                          { total: 0, active: 0, public: 0, draft: 0 }
                        );

                        return (
                          <>
                            {/* State Row */}
                            <TableRow key={`${country}-${state}`} className="bg-muted/20 font-medium">
                              <TableCell className="pl-6">└ {state}</TableCell>
                              <TableCell className="text-right">{stateTotal.total}</TableCell>
                              <TableCell className="text-right">{stateTotal.active}</TableCell>
                              <TableCell className="text-right">{stateTotal.public}</TableCell>
                              <TableCell className="text-right">{stateTotal.draft}</TableCell>
                            </TableRow>
                            {/* City Rows */}
                            {cities.map((city, idx) => (
                              <TableRow key={`${country}-${state}-${city.city}-${idx}`}>
                                <TableCell className="pl-12 text-sm">└ {city.city}</TableCell>
                                <TableCell className="text-right">{city.total_jobs}</TableCell>
                                <TableCell className="text-right">{city.active_jobs}</TableCell>
                                <TableCell className="text-right">{city.public_jobs}</TableCell>
                                <TableCell className="text-right">{city.draft_jobs}</TableCell>
                              </TableRow>
                            ))}
                          </>
                        );
                      })}
                    </>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};
