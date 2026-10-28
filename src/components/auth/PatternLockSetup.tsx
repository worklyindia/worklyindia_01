import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Grid3X3, Loader2, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { NativeBottomSheet } from '@/components/NativeBottomSheet';
import { PatternLockGrid } from './PatternLockGrid';
import { supabase } from '@/integrations/supabase/client';
import { RecoveryCodesDisplay } from './RecoveryCodesDisplay';

interface PatternLockSetupProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  userId: string;
  userType: 'job_seeker' | 'employer';
}

type SetupStep = 'draw' | 'confirm' | 'saving' | 'recovery' | 'success';

export const PatternLockSetup: React.FC<PatternLockSetupProps> = ({
  open,
  onClose,
  onSuccess,
  userId,
  userType,
}) => {
  const { toast } = useToast();
  const [step, setStep] = useState<SetupStep>('draw');
  const [firstPattern, setFirstPattern] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const resetSetup = useCallback(() => {
    setStep('draw');
    setFirstPattern('');
    setError(null);
    setIsLoading(false);
  }, []);

  const handleClose = () => {
    if (!isLoading) {
      resetSetup();
      onClose();
    }
  };

  const validatePattern = (pattern: string): string | null => {
    const dots = pattern.split(',').map(Number);
    
    if (dots.length < 4) {
      return 'Pattern too short. Connect at least 4 dots.';
    }

    // Check for unique dots
    const uniqueDots = new Set(dots);
    if (uniqueDots.size !== dots.length) {
      return 'Each dot can only be used once.';
    }

    return null;
  };

  const handleFirstPatternComplete = (pattern: string) => {
    const validationError = validatePattern(pattern);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFirstPattern(pattern);
    setError(null);
    setStep('confirm');
  };

  const handleConfirmPatternComplete = async (pattern: string) => {
    const validationError = validatePattern(pattern);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (pattern !== firstPattern) {
      setError("Patterns don't match. Try again.");
      return;
    }

    // Patterns match - save to database
    setStep('saving');
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: setupError } = await supabase.functions.invoke('unified-2fa', {
        body: {
          action: 'pattern-setup',
          userId,
          userType,
          patternSequence: pattern,
        },
      });

      if (setupError) throw setupError;

      if (data?.success) {
        if (data.recoveryCodes && data.recoveryCodes.length > 0) {
          setRecoveryCodes(data.recoveryCodes);
          setStep('recovery');
        } else {
          setStep('success');
          toast({
            title: 'Pattern Lock Enabled',
            description: 'Your pattern has been set successfully.',
          });
          setTimeout(() => {
            onSuccess();
            handleClose();
          }, 1500);
        }
      } else {
        throw new Error(data?.error || 'Failed to setup pattern lock');
      }
    } catch (err: any) {
      console.error('Pattern lock setup error:', err);
      setError(err.message || 'Failed to save pattern. Please try again.');
      setStep('confirm');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecoveryCodesConfirmed = () => {
    setStep('success');
    toast({
      title: 'Pattern Lock Enabled',
      description: 'Your pattern and recovery codes have been saved.',
    });
    setTimeout(() => {
      onSuccess();
      handleClose();
    }, 1000);
  };

  const getStepContent = () => {
    switch (step) {
      case 'draw':
        return {
          title: 'Draw Your Pattern',
          description: 'Connect at least 4 dots to create your pattern',
          showGrid: true,
        };
      case 'confirm':
        return {
          title: 'Confirm Your Pattern',
          description: 'Draw the same pattern again to confirm',
          showGrid: true,
        };
      case 'saving':
        return {
          title: 'Setting Up...',
          description: 'Saving your pattern securely',
          showGrid: false,
        };
      case 'recovery':
        return {
          title: 'Save Recovery Codes',
          description: 'Keep these codes safe for account recovery',
          showGrid: false,
        };
      case 'success':
        return {
          title: 'Pattern Lock Enabled!',
          description: 'You can now use pattern to verify login',
          showGrid: false,
        };
    }
  };

  const content = getStepContent();

  // Show recovery codes in separate component
  if (step === 'recovery') {
    return (
      <RecoveryCodesDisplay
        open={open}
        onClose={handleClose}
        codes={recoveryCodes}
        onConfirmed={handleRecoveryCodesConfirmed}
      />
    );
  }

  return (
    <NativeBottomSheet
      isOpen={open}
      onClose={handleClose}
      title="Pattern Lock Setup"
      height="auto"
    >
      <div className="flex flex-col items-center animate-fade-in pb-4">
        {/* Icon */}
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-2 transition-all duration-300 ${
          step === 'success'
            ? 'bg-green-500'
            : step === 'saving'
              ? 'bg-orange-500/80 animate-pulse'
              : 'bg-orange-500'
        }`}>
          {step === 'success' ? (
            <CheckCircle className="w-7 h-7 text-white animate-scale-in" />
          ) : step === 'saving' ? (
            <Loader2 className="w-7 h-7 text-white animate-spin" />
          ) : (
            <Grid3X3 className="w-7 h-7 text-white" />
          )}
        </div>

        {/* Title */}
        <h2 className="text-lg font-bold mb-1">{content.title}</h2>

        {/* Description */}
        <p className="text-center text-muted-foreground text-sm mb-3">
          {content.description}
        </p>

        {/* Step indicator */}
        {(step === 'draw' || step === 'confirm') && (
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-2 h-2 rounded-full ${step === 'draw' ? 'bg-orange-500' : 'bg-green-500'}`} />
            <div className={`w-6 h-0.5 ${step === 'confirm' ? 'bg-orange-500' : 'bg-muted'}`} />
            <div className={`w-2 h-2 rounded-full ${step === 'confirm' ? 'bg-orange-500' : 'bg-muted'}`} />
          </div>
        )}

        {/* Pattern Grid */}
        {content.showGrid && (
          <div className="mb-4">
            <PatternLockGrid
              key={step}
              onPatternComplete={step === 'draw' ? handleFirstPatternComplete : handleConfirmPatternComplete}
              disabled={isLoading}
              error={!!error}
              size="sm"
            />
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="flex items-center gap-2 p-2 mb-3 bg-destructive/10 rounded-lg text-destructive w-full max-w-xs animate-fade-in">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <p className="text-xs">{error}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 w-full max-w-xs">
          {step === 'confirm' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep('draw');
                setFirstPattern('');
                setError(null);
              }}
              className="text-muted-foreground flex-1"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Restart
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isLoading}
            className="text-muted-foreground flex-1"
          >
            Cancel
          </Button>
        </div>

        {/* Instructions - compact */}
        {content.showGrid && (
          <p className="mt-3 text-xs text-muted-foreground text-center max-w-xs">
            {step === 'draw' 
              ? 'Connect at least 4 dots'
              : 'Re-draw to confirm'
            }
          </p>
        )}
      </div>
    </NativeBottomSheet>
  );
};
