import { confirmDialog } from '@/lib/confirmDialog';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useAIChatPlansManagement } from '@/hooks/useAIChatPlansManagement';
import { PackageDataTable } from '@/components/package-management/PackageDataTable';
import { AIChatPlanForm } from '@/components/ai-chat/AIChatPlanForm';

interface AIChatPlan {
  id: string;
  name: string;
  price_inr: number;
  messages_per_month: number;
  voice_playback_per_month: number;
  voice_input_per_month: number;
  image_analysis_per_month: number;
  ai_image_generation_per_month: number;
  ai_model_tier: string;
  priority_support: boolean;
  features: string[];
  is_active: boolean;
  display_order: number;
  sort_order: number; // Alias for display_order to match Package interface
}

export default function AIChatPlansManagement() {
  const navigate = useNavigate();
  const { plans, loading, createPlan, updatePlan, deletePlan } = useAIChatPlansManagement();
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<AIChatPlan | null>(null);

  // Transform plans to include sort_order alias
  const transformedPlans = plans.map(plan => ({
    ...plan,
    ai_image_generation_per_month: (plan as any).ai_image_generation_per_month || 5,
    sort_order: plan.display_order
  }));

  const columns = [
    { key: 'name', label: 'Plan Name' },
    { 
      key: 'price_inr', 
      label: 'Price (INR)',
      render: (value: number) => value === 0 ? 'Free' : `₹${value.toLocaleString()}`
    },
    { 
      key: 'messages_per_month', 
      label: 'Messages/Month',
      render: (value: number) => value >= 999999 ? 'Unlimited' : value.toLocaleString()
    },
    { 
      key: 'voice_playback_per_month', 
      label: 'Voice Playback',
      render: (value: number) => value >= 999999 ? 'Unlimited' : value.toLocaleString()
    },
    { 
      key: 'voice_input_per_month', 
      label: 'Voice Input',
      render: (value: number) => value >= 999999 ? 'Unlimited' : value.toLocaleString()
    },
    { 
      key: 'image_analysis_per_month', 
      label: 'Image Analysis',
      render: (value: number) => value >= 999999 ? 'Unlimited' : value.toLocaleString()
    },
    { 
      key: 'ai_image_generation_per_month', 
      label: 'AI Image Gen',
      render: (value: number) => value >= 999999 ? 'Unlimited' : value.toLocaleString()
    },
    { 
      key: 'ai_model_tier', 
      label: 'AI Model Tier',
      render: (value: string) => value.charAt(0).toUpperCase() + value.slice(1)
    },
    { 
      key: 'priority_support', 
      label: 'Priority Support',
      render: (value: boolean) => value ? '✅' : '❌'
    },
    { key: 'display_order', label: 'Display Order' }
  ];

  const handleEdit = (plan: AIChatPlan) => {
    setEditingPlan(plan);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (await confirmDialog('Are you sure you want to delete this AI chat plan?')) {
      await deletePlan(id);
    }
  };

  const handleFormSubmit = async (data: Omit<AIChatPlan, 'id'>) => {
    if (editingPlan) {
      await updatePlan(editingPlan.id, data);
    } else {
      await createPlan(data);
    }
    setShowForm(false);
    setEditingPlan(null);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingPlan(null);
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
              <h1 className="text-2xl font-bold text-foreground">AI Chat Plans Management</h1>
              <p className="text-sm text-muted-foreground">Manage AI Career Chat subscription plans</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <PackageDataTable
          packages={transformedPlans}
          loading={loading}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onCreate={() => setShowForm(true)}
          title="AI Chat Subscription Plans"
          columns={columns}
        />
      </main>

      {/* Form Modal */}
      <AIChatPlanForm
        open={showForm}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={editingPlan || undefined}
        isEdit={!!editingPlan}
      />
    </div>
  );
}
