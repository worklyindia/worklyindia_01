import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Key, Copy, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ApiKey {
  id: string;
  key_name: string;
  api_key: string;
  key_prefix: string;
  rate_limit_tier: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
  usage_count: number;
}

interface APIKeyGeneratorProps {
  onKeyGenerated?: () => void;
}

export const APIKeyGenerator = ({ onKeyGenerated }: APIKeyGeneratorProps) => {
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyTier, setNewKeyTier] = useState('free');
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateApiKey = async () => {
    if (!newKeyName.trim()) {
      toast.error('Please enter a key name');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('You must be logged in');
        return;
      }

      // Check existing keys
      const { data: existingKeys } = await supabase
        .from('api_keys')
        .select('rate_limit_tier, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const activeKeys = existingKeys || [];
      const freeKeys = activeKeys.filter(k => k.rate_limit_tier === 'free');
      const proKeys = activeKeys.filter(k => k.rate_limit_tier === 'pro');

      if (newKeyTier === 'free' && freeKeys.length >= 1) {
        toast.error('Free tier limit reached! You can only have 1 free API key.');
        setLoading(false);
        return;
      }

      if (newKeyTier === 'pro' && proKeys.length >= 2) {
        toast.error('Pro tier limit reached! You can only have 2 pro API keys.');
        setLoading(false);
        return;
      }

      // Generate secure API key
      const randomPart = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
      const apiKey = `wfh_${randomPart}`;
      const keyPrefix = `wfh_${randomPart.substring(0, 8)}...`;

      const { error } = await supabase
        .from('api_keys')
        .insert({
          user_id: user.id,
          key_name: newKeyName,
          api_key: apiKey,
          key_prefix: keyPrefix,
          rate_limit_tier: newKeyTier
        });

      if (error) throw error;

      setGeneratedKey(apiKey);
      setShowKey(true);
      toast.success('API Key generated successfully!');
      setNewKeyName('');
      setNewKeyTier('free');
      
      if (onKeyGenerated) {
        onKeyGenerated();
      }
    } catch (error: any) {
      console.error('Error generating API key:', error);
      toast.error('Failed to generate API key');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedKey) {
      navigator.clipboard.writeText(generatedKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('API key copied to clipboard!');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Generate New API Key
        </CardTitle>
        <CardDescription>
          Create a new API key to authenticate your requests
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {generatedKey ? (
          <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="space-y-4">
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100 mb-2">
                  API Key Generated Successfully!
                </p>
                <p className="text-sm text-green-800 dark:text-green-200 mb-3">
                  ⚠️ Copy this key now - you won't be able to see it again!
                </p>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 p-3 bg-white dark:bg-slate-900 rounded border font-mono text-sm break-all">
                    {showKey ? generatedKey : '•'.repeat(generatedKey.length)}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    size="sm"
                    onClick={copyToClipboard}
                    className="gap-2"
                  >
                    {copied ? <CheckCircle className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </Button>
                </div>
              </div>

              <Button
                onClick={() => {
                  setGeneratedKey(null);
                  setShowKey(false);
                  setCopied(false);
                }}
                variant="outline"
                size="sm"
              >
                Generate Another Key
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="key-name">Key Name</Label>
              <Input
                id="key-name"
                placeholder="e.g., Production API Key"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Give your key a descriptive name to identify its purpose
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="key-tier">Rate Limit Tier</Label>
              <Select value={newKeyTier} onValueChange={setNewKeyTier}>
                <SelectTrigger id="key-tier">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Free</Badge>
                      <span>1,000 requests/hour</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="pro">
                    <div className="flex items-center gap-2">
                      <Badge variant="default">Pro</Badge>
                      <span>10,000 requests/hour</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Limits:</strong> Free tier: 1 key max | Pro tier: 2 keys max
              </AlertDescription>
            </Alert>

            <Button
              onClick={generateApiKey}
              disabled={loading}
              className="w-full"
            >
              {loading ? 'Generating...' : 'Generate API Key'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
};
