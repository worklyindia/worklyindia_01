import { confirmDialog } from '@/lib/confirmDialog';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useBoostPackages } from '@/hooks/useBoostPackages';
import { PackageDataTable } from '@/components/package-management/PackageDataTable';
import { BoostPackageForm } from '@/components/package-management/BoostPackageForm';

interface BoostPackage {
  id: string;
  name: string;
  price_inr: number;
  boost_days: number;
  boost_level: number;
  is_active: boolean;
  sort_order: number;
  most_popular: boolean;
}

export default function BoostPackagesManagement() {
  const navigate = useNavigate();
  const { packages, loading, createPackage, updatePackage, deletePackage } = useBoostPackages();
  const [showForm, setShowForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<BoostPackage | null>(null);

  const columns = [
    { key: 'name', label: 'Package Name' },
    { 
      key: 'price_inr', 
      label: 'Price (INR)',
      render: (value: number) => `₹${value.toLocaleString()}`
    },
    { 
      key: 'boost_days', 
      label: 'Boost Days',
      render: (value: number) => `${value} days`
    },
    { 
      key: 'boost_level', 
      label: 'Boost Level',
      render: (value: number) => `Level ${value}`
    },
    { 
      key: 'most_popular', 
      label: 'Most Popular',
      render: (value: boolean) => value ? '✅' : '❌'
    },
    { key: 'sort_order', label: 'Sort Order' }
  ];

  const handleEdit = (pkg: BoostPackage) => {
    setEditingPackage(pkg);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (await confirmDialog('Are you sure you want to delete this package?')) {
      await deletePackage(id);
    }
  };

  const handleFormSubmit = async (data: Omit<BoostPackage, 'id'>) => {
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
              <h1 className="text-2xl font-bold text-foreground">Boost Package Management</h1>
              <p className="text-sm text-muted-foreground">Manage job boost packages for employers</p>
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
          title="Boost Packages"
          columns={columns}
        />
      </main>

      {/* Form Modal */}
      <BoostPackageForm
        open={showForm}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={editingPackage || undefined}
        isEdit={!!editingPackage}
      />
    </div>
  );
}