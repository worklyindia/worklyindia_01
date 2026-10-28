import { Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const EmailLink = () => {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link to="/email-management">
        <Button size="lg" className="rounded-full shadow-lg">
          <Mail className="h-5 w-5 mr-2" />
          Email
        </Button>
      </Link>
    </div>
  );
};

export default EmailLink;