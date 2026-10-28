import { confirmDialog } from '@/lib/confirmDialog';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { useVerificationPackages } from '@/hooks/useVerificationPackages';
import { PackageDataTable } from '@/components/package-management/PackageDataTable';
import { VerificationPackageForm } from '@/components/package-management/VerificationPackageForm';

interface VerificationPackage {
  id: string;
  name: string;
  price_inr: number;
  validity_days: number;
  badge_color: string;
  is_active: boolean;
  sort_order: number;
  most_popular: boolean;
}

export default function VerificationPackagesManagement() {
  const navigate = useNavigate();
  const { packages, loading, createPackage, updatePackage, deletePackage } = useVerificationPackages();
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<VerificationPackage | null>(null);

  const columns = [
    { key: 'name', label: 'Package Name' },
    { 
      key: 'price_inr', 
      label: 'Price (INR)',
      render: (value: number) => `₹${value.toLocaleString()}`
    },
    { 
      key: 'validity_days', 
      label: 'Validity',
      render: (value: number) => `${value} days`
    },
    { 
      key: 'badge_color', 
      label: 'Badge Color',
      render: (value: string) => (
        <Badge 
          variant="outline" 
          style={{ 
            backgroundColor: value === 'gold' ? '#ffd700' : 
                           value === 'blue' ? '#3b82f6' : 
                           value === 'silver' ? '#c0c0c0' : 
                           value === 'green' ? '#10b981' : value,
            color: value === 'gold' || value === 'silver' ? '#000' : '#fff'
          }}
        >
          {value}
        </Badge>
      )
    },
    { 
      key: 'most_popular', 
      label: 'Most Popular',
      render: (value: boolean) => value ? '✅' : '❌'
    },
    { key: 'sort_order', label: 'Sort Order' }
  ];

  const handleEdit = (pkg: VerificationPackage) => {
    setEditingPackage(pkg);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (await confirmDialog('Are you sure you want to delete this package?')) {
      await deletePackage(id);
    }
  };

  const handleFormSubmit = async (data: Omit<VerificationPackage, 'id'>) => {
    if (editingPackage) {
      await updatePackage(editingPackage.id, data);
    } else {
      await createPackage(data);
    }
    setShowForm(false);
    setEditingPackage(null);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPackage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-muted/80"
              onClick={() => navigate('/owner-portal')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Verification Package Management</h1>
              <p className="text-sm text-muted-foreground">Manage verification badge packages for companies</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <PackageDataTable
          packages={packages}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreate={() => setShowForm(true)}
          title="Verification Packages"
          columns={columns}
        />
      </main>

      {/* Form Modal */}
      <VerificationPackageForm
        open={showForm}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={editingPackage || undefined}
        isEdit={!!editingPackage}
      />
    </div>
  );
}