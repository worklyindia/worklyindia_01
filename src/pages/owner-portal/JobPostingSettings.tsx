import { useState, useEffect } from 'react';
import { ArrowLeft, Save, Settings, Plus, Trash2, Edit2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEngagementVisibility, useUpdateEngagementVisibility } from '@/hooks/useSiteSettings';
import { normalizeForSave, sortPackagesByPrice } from '@/lib/jobPostingPackages';

interface DurationPackage {
  months: number;
  points: number;
  price?: number;
  is_default?: boolean;
  is_active?: boolean;
}

export default function JobPostingSettings() {
  const navigate = useNavigate();
  const { data: visibility } = useEngagementVisibility();
  const updateVisibility = useUpdateEngagementVisibility();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [settings, setSettings] = useState({
    points_required_per_job: 50,
    is_active: true,
    duration_packages: [] as DurationPackage[]
  });
  const [editingPackage, setEditingPackage] = useState<{index: number, package: DurationPackage} | null>(null);
  const [newPackage, setNewPackage] = useState<DurationPackage>({ months: 1, points: 50 });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('job_posting_settings')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(1);

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching job posting settings:', error);
        toast.error('Failed to load settings');
        return;
      }

      if (data && data.length > 0) {
        const settingsData = data[0];
        setSettingsId(settingsData.id);
        setSettings({
          points_required_per_job: settingsData.points_required_per_job || 50,
          is_active: settingsData.is_active || false,
          duration_packages: sortPackagesByPrice((settingsData.duration_packages as unknown as DurationPackage[]) || [])
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  // Every change is saved straight away to the live row, so public pages update instantly.
  const persist = async (next: typeof settings, successMsg = 'Saved — live on website') => {
    const packages = normalizeForSave(next.duration_packages);
    const nextSettings = { ...next, duration_packages: packages };
    setSettings(nextSettings);
    setSaving(true);
    try {
      const payload = {
        points_required_per_job: nextSettings.points_required_per_job,
        is_active: nextSettings.is_active,
        duration_packages: packages as any,
        updated_at: new Date().toISOString(),
      };
      if (settingsId) {
        const { error } = await supabase.from('job_posting_settings').update(payload).eq('id', settingsId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('job_posting_settings').insert(payload).select('id').single();
        if (error) throw error;
        setSettingsId(data.id);
      }
      toast.success(successMsg);
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save — please try again');
      fetchSettings();
    } finally {
      setSaving(false);
    }
  };

  const handleAddPackage = () => {
    if (newPackage.months <= 0 || newPackage.points <= 0) {
      toast.error('Please enter valid months and price values');
      return;
    }
    persist({ ...settings, duration_packages: [...settings.duration_packages, { ...newPackage, is_active: true }] }, 'Package added — live on website');
    setNewPackage({ months: 1, points: 50 });
  };

  const handleUpdatePackage = (index: number, updatedPackage: DurationPackage) => {
    const updatedPackages = [...settings.duration_packages];
    updatedPackages[index] = updatedPackage;
    setEditingPackage(null);
    persist({ ...settings, duration_packages: updatedPackages }, 'Package updated — live on website');
  };

  const handleDeletePackage = (index: number) => {
    persist({ ...settings, duration_packages: settings.duration_packages.filter((_, i) => i !== index) }, 'Package deleted');
  };

  const handleSetDefault = (index: number) => {
    persist({ ...settings, duration_packages: settings.duration_packages.map((pkg, i) => ({ ...pkg, is_default: i === index })) }, 'Default package updated');
  };

  const handleTogglePackageActive = (index: number) => {
    const updatedPackages = [...settings.duration_packages];
    updatedPackages[index] = { ...updatedPackages[index], is_active: updatedPackages[index].is_active === false };
    persist({ ...settings, duration_packages: updatedPackages });
  };

  const handleSave = () => persist(settings, 'Job posting settings updated successfully!');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-md border-b border-border/10">
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex items-center space-x-3 md:space-x-4">
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full hover:bg-muted/80 h-8 w-8 md:h-10 md:w-10"
              onClick={() => navigate('/owner-portal')}
            >
              <ArrowLeft className="w-4 h-4 md:w-5 md:h-5" />
            </Button>
            <div>
              <h1 className="text-lg md:text-2xl font-bold text-foreground">Job Posting Settings</h1>
              <p className="text-xs md:text-sm text-muted-foreground">Configure job posting pricing and duration packages</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 md:py-8">
        <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
          {/* General Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                General Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="defaultPoints">Default Price Per Job (₹)</Label>
                    <Input
                      id="defaultPoints"
                      type="number"
                      min="0"
                      value={settings.points_required_per_job}
                      onChange={(e) => setSettings(prev => ({
                        ...prev,
                        points_required_per_job: parseInt(e.target.value) || 0
                      }))}
                      className="max-w-xs"
                    />
                    <p className="text-sm text-muted-foreground">
                      Fallback ₹ price when duration packages are not used
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label htmlFor="active">Job Posting System</Label>
                      <p className="text-sm text-muted-foreground">
                        Master switch for the entire job posting system
                      </p>
                    </div>
                    <Switch
                      id="active"
                      checked={settings.is_active}
                      onCheckedChange={(checked) => setSettings(prev => ({
                        ...prev,
                        is_active: checked
                      }))}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Engagement Stats Visibility */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Engagement Stats Visibility
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Control whether views and applies counts are shown on job cards
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Show Views Count</Label>
                  <p className="text-sm text-muted-foreground">
                    Display view count (👁) on job cards
                  </p>
                </div>
                <Switch
                  checked={visibility?.showViews ?? true}
                  onCheckedChange={(checked) => updateVisibility.mutate({ key: 'show_views_count', value: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Show Applies Count</Label>
                  <p className="text-sm text-muted-foreground">
                    Display application count (📝) on job cards
                  </p>
                </div>
                <Switch
                  checked={visibility?.showApplies ?? true}
                  onCheckedChange={(checked) => updateVisibility.mutate({ key: 'show_applies_count', value: checked })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Duration Packages */}
          <Card>
            <CardHeader>
              <CardTitle>Duration Packages</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure different duration options with custom pricing for job postings
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {!loading && (
                <>
                  {/* Add New Package */}
                  <div className="border rounded-lg p-3 md:p-4 bg-muted/30">
                    <h4 className="font-medium mb-3 md:mb-4">Add New Package</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
                      <div>
                        <Label htmlFor="newMonths" className="text-sm">Duration (Months)</Label>
                        <Input
                          id="newMonths"
                          type="number"
                          min="1"
                          value={newPackage.months}
                          onChange={(e) => setNewPackage(prev => ({
                            ...prev,
                            months: parseInt(e.target.value) || 1
                          }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor="newPoints" className="text-sm">Price (₹)</Label>
                        <Input
                          id="newPoints"
                          type="number"
                          min="1"
                          value={newPackage.points}
                          onChange={(e) => setNewPackage(prev => ({
                            ...prev,
                            points: parseInt(e.target.value) || 1
                          }))}
                        />
                      </div>
                      <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                        <Button onClick={handleAddPackage} className="w-full">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Package
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Existing Packages */}
                  <div className="space-y-4">
                    <h4 className="font-medium">Current Packages</h4>
                    {settings.duration_packages.length === 0 ? (
                      <p className="text-muted-foreground text-center py-8">No duration packages configured</p>
                    ) : (
                      <div className="grid gap-4">
                        {settings.duration_packages.map((pkg, index) => (
                          <div key={index} className="border rounded-lg p-3 md:p-4 bg-background">
                            {editingPackage?.index === index ? (
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 md:gap-4">
                                <div>
                                  <Label className="text-sm">Duration (Months)</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={editingPackage.package.months}
                                    onChange={(e) => setEditingPackage({
                                      index,
                                      package: {
                                        ...editingPackage.package,
                                        months: parseInt(e.target.value) || 1
                                      }
                                    })}
                                  />
                                </div>
                                <div>
                                  <Label className="text-sm">Price (₹)</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={editingPackage.package.points}
                                    onChange={(e) => setEditingPackage({
                                      index,
                                      package: {
                                        ...editingPackage.package,
                                        points: parseInt(e.target.value) || 1
                                      }
                                    })}
                                  />
                                </div>
                                <div className="sm:col-span-2 lg:col-span-1 flex items-end gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleUpdatePackage(index, editingPackage.package)}
                                    className="flex-1"
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingPackage(null)}
                                    className="flex-1"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-medium text-base">
                                        {pkg.months} Month{pkg.months > 1 ? 's' : ''}
                                      </span>
                                      {pkg.is_default && (
                                        <Badge variant="secondary" className="text-xs">Default</Badge>
                                      )}
                                      {pkg.is_active === false && (
                                        <Badge variant="destructive" className="text-xs">Inactive</Badge>
                                      )}
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                      ₹{pkg.points} • paid via Razorpay
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <Switch
                                      checked={pkg.is_active !== false}
                                      onCheckedChange={() => handleTogglePackageActive(index)}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleSetDefault(index)}
                                      disabled={pkg.is_default}
                                      className="text-xs px-2 py-1"
                                    >
                                      {pkg.is_default ? 'Default' : 'Set Default'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setEditingPackage({ index, package: pkg })}
                                      className="p-2"
                                    >
                                      <Edit2 className="w-3 h-3" />
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleDeletePackage(index)}
                                      className="p-2"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Save Button */}
          <Card>
            <CardContent className="pt-4 md:pt-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Ready to save changes?</p>
                  <p className="text-sm text-muted-foreground">
                    Your changes will be applied immediately to all new job postings
                  </p>
                </div>
                <Button 
                  onClick={handleSave} 
                  disabled={saving || loading}
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save All Settings'}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Current Status */}
          {!loading && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4 md:pt-6">
                <h3 className="font-semibold mb-4">Current Configuration Summary</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                  <div>
                    <h4 className="font-medium text-xs md:text-sm text-muted-foreground mb-2">SYSTEM STATUS</h4>
                    <p className="text-sm md:text-lg">
                      {settings.is_active ? '✅ Active' : '❌ Disabled'}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-xs md:text-sm text-muted-foreground mb-2">DEFAULT POINTS</h4>
                    <p className="text-sm md:text-lg">{settings.points_required_per_job} points</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-xs md:text-sm text-muted-foreground mb-2">TOTAL PACKAGES</h4>
                    <p className="text-sm md:text-lg">{settings.duration_packages.length} packages</p>
                  </div>
                  <div>
                    <h4 className="font-medium text-xs md:text-sm text-muted-foreground mb-2">ACTIVE PACKAGES</h4>
                    <p className="text-sm md:text-lg">
                      {settings.duration_packages.filter(p => p.is_active !== false).length} active
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}