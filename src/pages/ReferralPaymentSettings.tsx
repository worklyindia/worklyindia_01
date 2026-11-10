import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";
import { useAuth } from "@/contexts/AuthContext";
import { useEmployerAuth } from "@/contexts/EmployerAuthContext";

const ReferralPaymentSettings = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { user: employerUser } = useEmployerAuth();
  const currentUser = user || employerUser;
  const { paymentSettings, saveSettings, isSaving } = usePaymentSettings(currentUser?.id);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");
  const [upiId, setUpiId] = useState("");

  useEffect(() => {
    if (!paymentSettings) return;
    setName(paymentSettings.name || "");
    setMobile(paymentSettings.mobile || "");
    setEmail(paymentSettings.email || "");
    setBankName(paymentSettings.bank_name || "");
    setAccountNumber(paymentSettings.account_number || "");
    setIfscCode(paymentSettings.ifsc_code || "");
    setUpiId(paymentSettings.upi_id || "");
  }, [paymentSettings]);

  useEffect(() => {
    if (!name && currentUser?.user_metadata?.full_name) setName(currentUser.user_metadata.full_name);
  }, [currentUser, name]);

  const handleSave = () => {
    saveSettings({
      name,
      mobile,
      email,
      bank_name: bankName,
      account_number: accountNumber,
      ifsc_code: ifscCode,
      upi_id: upiId,
    });
    navigate(-1);
  };

  const complete = Boolean(name && mobile && email && bankName && accountNumber && ifscCode && upiId);

  return (
    <div className="min-h-screen bg-background pb-28">
      <PageHeader title="Payment Settings" />
      <main className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <div className="space-y-2"><Label htmlFor="payment-name">Name *</Label><Input id="payment-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Enter full name" /></div>
        <div className="space-y-2"><Label htmlFor="payment-mobile">Mobile Number *</Label><Input id="payment-mobile" type="tel" value={mobile} onChange={(event) => setMobile(event.target.value)} placeholder="Enter mobile number" /></div>
        <div className="space-y-2"><Label htmlFor="payment-email">Email *</Label><Input id="payment-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter email address" /></div>
        <div className="space-y-2"><Label htmlFor="payment-bank">Bank Name</Label><Input id="payment-bank" value={bankName} onChange={(event) => setBankName(event.target.value)} placeholder="Enter bank name" /></div>
        <div className="space-y-2"><Label htmlFor="payment-account">Account Number</Label><Input id="payment-account" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} placeholder="Enter account number" /></div>
        <div className="space-y-2"><Label htmlFor="payment-ifsc">IFSC Code</Label><Input id="payment-ifsc" value={ifscCode} onChange={(event) => setIfscCode(event.target.value.toUpperCase())} placeholder="Enter IFSC code" /></div>
        <div className="space-y-2"><Label htmlFor="payment-upi">UPI ID</Label><Input id="payment-upi" value={upiId} onChange={(event) => setUpiId(event.target.value)} placeholder="Enter UPI ID" /></div>
      </main>
      <footer className="fixed inset-x-0 bottom-0 border-t border-border bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
        <Button onClick={handleSave} disabled={isSaving || !complete} className="mx-auto flex h-12 w-full max-w-lg">
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isSaving ? "Saving..." : "Save"}
        </Button>
      </footer>
    </div>
  );
};

export default ReferralPaymentSettings;