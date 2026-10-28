import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Edit, Trash2, Search, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LottieSearchIcon from "@/components/LottieSearchIcon";

interface Package {
  id: string;
  name: string;
  is_active: boolean;
  sort_order: number;
  [key: string]: any;
}

interface PackageDataTableProps<T extends Package> {
  packages: T[];
  loading: boolean;
  onEdit: (pkg: T) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
  title: string;
  columns: Array<{
    key: string;
    label: string;
    render?: (value: any, pkg: T) => React.ReactNode;
  }>;
}

export function PackageDataTable<T extends Package>({
  packages,
  loading,
  onEdit,
  onDelete,
  onCreate,
  title,
  columns
}: PackageDataTableProps<T>) {
  const [search, setSearch] = useState('');

  const filteredPackages = packages.filter(pkg =>
    pkg.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">Loading packages...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          <Button onClick={onCreate} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Add Package
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="relative flex-1 max-w-sm">
            <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none"><LottieSearchIcon size={16} /></div>
            <Input
              placeholder="Search packages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                {columns.map(col => (
                  <TableHead key={col.key}>{col.label}</TableHead>
                ))}
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPackages.map((pkg) => (
                <TableRow key={pkg.id}>
                  {columns.map(col => (
                    <TableCell key={col.key}>
                      {col.render ? col.render(pkg[col.key], pkg) : pkg[col.key]}
                    </TableCell>
                  ))}
                  <TableCell>
                    <Badge variant={pkg.is_active ? "default" : "secondary"}>
                      {pkg.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onEdit(pkg)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(pkg.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredPackages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={columns.length + 2} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {search ? 'No packages found matching your search.' : 'No packages created yet.'}
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}