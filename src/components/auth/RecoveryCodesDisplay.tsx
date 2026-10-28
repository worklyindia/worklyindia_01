import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Download, Check, AlertTriangle, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { BRAND_CONFIG } from '@/config/brandConfig';

interface RecoveryCodesDisplayProps {
  open: boolean;
  onClose: () => void;
  codes: string[];
  onConfirmed: () => void;
}

export const RecoveryCodesDisplay: React.FC<RecoveryCodesDisplayProps> = ({
  open,
  onClose,
  codes,
  onConfirmed,
}) => {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const copyAllCodes = async () => {
    try {
      const codesText = codes.join('\n');
      await navigator.clipboard.writeText(codesText);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "All recovery codes copied to clipboard",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadCodes = () => {
    const codesText = `${BRAND_CONFIG.name} - Recovery Codes
================================
Generated: ${new Date().toLocaleString()}

IMPORTANT: Keep these codes safe!
Each code can only be used once.
If you lose access to your authenticator app, 
use one of these codes to login.

Recovery Codes:
${codes.map((code, i) => `${i + 1}. ${code}`).join('\n')}

================================
DO NOT SHARE THESE CODES WITH ANYONE!`;

    const blob = new Blob([codesText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workly-india-recovery-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded!",
      description: "Recovery codes saved to file",
    });
  };

  const handleConfirm = () => {
    setConfirmed(true);
    onConfirmed();
  };

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={onClose}
      title="Save Recovery Codes"
      height="auto"
    >
      <div className="space-y-6 pb-4">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
          <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-medium text-amber-800 dark:text-amber-200 text-sm">
              These codes will only be shown once!
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Save them now. If you lose your authenticator app, you can use these to login.
            </p>
          </div>
        </div>

        {/* Codes Grid */}
        <div className="grid grid-cols-2 gap-2">
          {codes.map((code, index) => (
            <div 
              key={index}
              className="p-3 bg-muted rounded-lg text-center font-mono text-sm border"
            >
              {code}
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button 
            variant="outline" 
            className="flex-1 h-12 rounded-xl"
            onClick={copyAllCodes}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 mr-2 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 mr-2" />
                Copy All
              </>
            )}
          </Button>
          <Button 
            variant="outline"
            className="flex-1 h-12 rounded-xl"
            onClick={downloadCodes}
          >
            <Download className="w-4 h-4 mr-2" />
            Download
          </Button>
        </div>

        {/* Confirmation */}
        <div className="p-4 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl">
          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-sm text-green-800 dark:text-green-200">
              2FA successfully enabled! Your account is now more secure.
            </p>
          </div>
        </div>

        <Button 
          className="w-full h-12 rounded-xl"
          onClick={handleConfirm}
        >
          I've Saved My Codes
        </Button>
      </div>
    </NativeBottomSheet>
  );
};

export default RecoveryCodesDisplay;
