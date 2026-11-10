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

interface LocationData {
  country: string;
  state: string;
  city: string;
  total_members: number;
  active_members: number;
  profile_complete_members: number;
}

interface LocationDistributionTableProps {
  data?: LocationData[];
  isLoading?: boolean;
}

export const LocationDistributionTable = ({ data, isLoading }: LocationDistributionTableProps) => {
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
  }, {} as Record<string, Record<string, LocationData[]>>);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Geographic Distribution</CardTitle>
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
                <TableHead className="text-right whitespace-nowrap">Complete</TableHead>
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
                  </TableRow>
                ))
              ) : groupedData && Object.keys(groupedData).length > 0 ? (
                Object.entries(groupedData).map(([country, states]) => {
                  // Calculate country totals
                  const countryTotal = Object.values(states).reduce(
                    (sum, cities) => ({
                      total: sum.total + cities.reduce((s, c) => s + c.total_members, 0),
                      active: sum.active + cities.reduce((s, c) => s + c.active_members, 0),
                      complete: sum.complete + cities.reduce((s, c) => s + c.profile_complete_members, 0),
                    }),
                    { total: 0, active: 0, complete: 0 }
                  );

                  return (
                    <>
                      {/* Country Row */}
                      <TableRow key={country} className="bg-muted/50 font-semibold">
                        <TableCell className="font-bold">{country}</TableCell>
                        <TableCell className="text-right font-bold">{countryTotal.total}</TableCell>
                        <TableCell className="text-right font-bold">{countryTotal.active}</TableCell>
                        <TableCell className="text-right font-bold">{countryTotal.complete}</TableCell>
                      </TableRow>
                      {/* State and City Rows */}
                      {Object.entries(states).map(([state, cities]) => {
                        // Calculate state totals
                        const stateTotal = cities.reduce(
                          (sum, c) => ({
                            total: sum.total + c.total_members,
                            active: sum.active + c.active_members,
                            complete: sum.complete + c.profile_complete_members,
                          }),
                          { total: 0, active: 0, complete: 0 }
                        );

                        return (
                          <>
                            {/* State Row */}
                            <TableRow key={`${country}-${state}`} className="bg-muted/20 font-medium">
                              <TableCell className="pl-6">└ {state}</TableCell>
                              <TableCell className="text-right">{stateTotal.total}</TableCell>
                              <TableCell className="text-right">{stateTotal.active}</TableCell>
                              <TableCell className="text-right">{stateTotal.complete}</TableCell>
                            </TableRow>
                            {/* City Rows */}
                            {cities.map((city, idx) => (
                              <TableRow key={`${country}-${state}-${city.city}-${idx}`}>
                                <TableCell className="pl-12 text-sm">└ {city.city}</TableCell>
                                <TableCell className="text-right">{city.total_members}</TableCell>
                                <TableCell className="text-right">{city.active_members}</TableCell>
                                <TableCell className="text-right">{city.profile_complete_members}</TableCell>
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
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
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
