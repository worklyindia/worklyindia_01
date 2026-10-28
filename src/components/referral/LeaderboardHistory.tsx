import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { History } from 'lucide-react';

export const LeaderboardHistory = () => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isEmployer = pathname.startsWith('/employer/');

  return (
    <Button variant="outline" className="gap-2" onClick={() => navigate(isEmployer ? '/employer/monthly-competition/history' : '/monthly-competition/history')}>
      <History className="h-4 w-4" />
      View Past Competitions
    </Button>
  );
};
