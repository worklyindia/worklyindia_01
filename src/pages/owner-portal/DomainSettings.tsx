import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Helmet } from 'react-helmet-async';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { Globe, Loader2, Pencil, Save, X, ExternalLink } from 'lucide-react';
import {
  CANONICAL_DOMAIN,
  CANONICAL_DOMAIN_STORAGE_KEY,
  DEFAULT_CANONICAL_DOMAIN,
  isValidDomain,
  normalizeDomain,
} from '@/config/domainConfig';

const DomainSettings = () => {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');

  const { data: savedDomain, isLoading } = useQuery({
    queryKey: ['canonical-domain-setting'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', CANONICAL_DOMAIN_STORAGE_KEY)
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value || '';
    },
  });

  useEffect(() => {
    setValue(savedDomain || CANONICAL_DOMAIN);
  }, [savedDomain]);

  const saveMutation = useMutation({
    mutationFn: async (domain: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            setting_key: CANONICAL_DOMAIN_STORAGE_KEY,
            setting_value: domain,
            description: 'Primary website domain used for links, sharing and SEO',
            updated_by: user?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'setting_key' },
        );
      if (error) throw error;
      return domain;
    },
    onSuccess: (domain) => {
      localStorage.setItem(CANONICAL_DOMAIN_STORAGE_KEY, domain);
      queryClient.invalidateQueries({ queryKey: ['canonical-domain-setting'] });
      setEditing(false);
      toast.success('Domain saved. Reloading to apply everywhere…');
      setTimeout(() => window.location.reload(), 800);
    },
    onError: (error: Error) => toast.error(error.message || 'Could not save domain'),
  });

  const handleSave = () => {
    const domain = normalizeDomain(value);
    if (!isValidDomain(domain)) {
      toast.error('Please enter a valid domain, e.g. worklyindia.devs.surf');
      return;
    }
    saveMutation.mutate(domain);
  };

  const activeDomain = CANONICAL_DOMAIN;

  return (
    <>
      <Helmet>
        <title>Domain Settings | Workly India Owner Portal</title>
        <meta name="description" content="View and update the primary website domain used across links, sharing and SEO." />
      </Helmet>

      <main className="mx-auto w-full max-w-3xl px-3 py-6 sm:px-6">
        <header className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">Domain Settings</h1>
            <p className="text-sm text-muted-foreground">
              One place to change the website domain used everywhere.
            </p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Primary domain</CardTitle>
            <CardDescription>
              Used for share links, sitemaps, canonical URLs and notification footers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Currently active</Label>
                  <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-3">
                    <span className="font-mono text-sm break-all">https://{activeDomain}</span>
                    <a
                      href={`https://${activeDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      Open <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                  {!savedDomain && (
                    <p className="text-xs text-muted-foreground">
                      No saved domain yet — using default <span className="font-mono">{DEFAULT_CANONICAL_DOMAIN}</span>.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="domain">Saved domain</Label>
                  <Input
                    id="domain"
                    value={value}
                    disabled={!editing || saveMutation.isPending}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="worklyindia.devs.surf"
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter the domain without https:// — for example worklyindia.devs.surf
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {editing ? (
                    <>
                      <Button onClick={handleSave} disabled={saveMutation.isPending}>
                        {saveMutation.isPending ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save domain
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setValue(savedDomain || CANONICAL_DOMAIN);
                          setEditing(false);
                        }}
                        disabled={saveMutation.isPending}
                      >
                        <X className="mr-2 h-4 w-4" /> Cancel
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => setEditing(true)}>
                      <Pencil className="mr-2 h-4 w-4" /> Edit domain
                    </Button>
                  )}
                </div>

                <Alert>
                  <AlertDescription className="text-xs">
                    After saving, the app reloads so every link uses the new domain. Server-side
                    emails and sitemaps still read the domain configured for backend functions.
                  </AlertDescription>
                </Alert>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </>
  );
};

export default DomainSettings;
