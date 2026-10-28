import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { useReferralSystem } from "@/hooks/useReferralSystem";
import { cn } from "@/lib/utils";
import { savePendingReferralCode } from "@/utils/pendingReferral";

interface ReferralCodeInputProps {
  onValidCode?: (referrerId: string, companyName: string) => void;
  className?: string;
}

const ReferralCodeInput = ({ onValidCode, className }: ReferralCodeInputProps) => {
  const [searchParams] = useSearchParams();
  const [referralCode, setReferralCode] = useState("");
  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    message?: string;
    companyName?: string;
    referrerId?: string;
  } | null>(null);

  const { validateCode, isValidating } = useReferralSystem();

  // Auto-populate referral code from URL parameter
  useEffect(() => {
    const refParam = searchParams.get('ref');
    if (refParam && !referralCode) {
      setReferralCode(refParam.toUpperCase());
      // Auto-validate if code comes from URL
      setTimeout(() => {
        handleValidateCode(refParam.toUpperCase());
      }, 500);
    }
  }, [searchParams]);

  const handleValidateCode = async (codeToValidate?: string) => {
    const code = codeToValidate || referralCode;
    if (!code.trim()) {
      setValidationResult({
        valid: false,
        message: "Please enter a referral code",
      });
      return;
    }

    try {
      const result = await validateCode(code.trim().toUpperCase());
      
      if (result.valid) {
        setValidationResult({
          valid: true,
          companyName: result.company_name,
          referrerId: result.referrer_id,
        });

        // Remember the code so it is applied right after the account is created,
        // even if the page reloads or email confirmation is required.
        savePendingReferralCode(code.trim().toUpperCase());
        
        
        if (onValidCode) {
          onValidCode(result.referrer_id, result.company_name);
        }
      } else {
        setValidationResult({
          valid: false,
          message: result.message || "Invalid referral code",
        });
      }
    } catch (error) {
      setValidationResult({
        valid: false,
        message: "Error validating referral code",
      });
    }
  };

  const handleInputChange = (value: string) => {
    setReferralCode(value);
    setValidationResult(null);
    
    // Auto-validate when code reaches valid length
    if (value.trim().length >= 4) {
      setTimeout(() => {
        handleValidateCode(value.toUpperCase());
      }, 500);
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label htmlFor="referral-code">Referral Code (Optional)</Label>
      <div className="relative">
        <Input
          id="referral-code"
          value={referralCode}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Enter referral code"
          className="uppercase pr-10"
          maxLength={10}
        />
        {isValidating && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {validationResult && (
        <div
          className={cn(
            "flex items-center space-x-2 text-sm p-3 rounded-lg",
            validationResult.valid
              ? "bg-green-50 text-green-700 border border-green-200"
              : "bg-red-50 text-red-700 border border-red-200"
          )}
        >
          {validationResult.valid ? (
            <>
              <CheckCircle className="h-4 w-4" />
              <span>
                Valid referral code! Referred by{" "}
                <strong>{validationResult.companyName}</strong>
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              <span>{validationResult.message}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ReferralCodeInput;