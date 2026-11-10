import { useLocation, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEmployerAuth } from '@/contexts/EmployerAuthContext';
import { ChangeEmailDialog } from '@/components/ChangeEmailDialog';
import { ChangePasswordDialog } from '@/components/ChangePasswordDialog';
import { ChangeMobileNumberDialog } from '@/components/ChangeMobileNumberDialog';
import usePhoneVerifySetting from '@/hooks/usePhoneVerifySetting';
import { AccountChangeFrame } from '@/components/auth/AccountChangeFrame';

export default function AccountChangePage() {
  const employer = useLocation().pathname.startsWith('/employer');
  const { field } = useParams();
  const jobSeeker = useAuth();
  const companyAuth = useEmployerAuth();
  const auth = employer ? companyAuth : jobSeeker;
  const { phoneVerifyEnabled } = usePhoneVerifySetting(employer ? 'phone_verify_employer_profile' : 'phone_verify_jobseeker_profile');
  if (field === 'email') return <ChangeEmailDialog standalone currentEmail={auth.user?.email || ''} onEmailChange={auth.changeEmail} />;
  if (field === 'password') return <ChangePasswordDialog standalone />;
  if (field === 'mobile' && phoneVerifyEnabled) return <ChangeMobileNumberDialog standalone currentPhone={auth.user?.phone} userId={auth.user?.id} companyId={employer ? companyAuth.company?.id : undefined} />;
  return <AccountChangeFrame standalone title="Mobile Number" fallback={employer ? '/employer-settings' : '/settings'} open onOpenChange={() => {}}><p className="text-sm text-muted-foreground">Mobile number changes are currently locked.</p></AccountChangeFrame>;
}