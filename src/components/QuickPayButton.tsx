import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Coins, Zap, Shield } from 'lucide-react';

interface QuickPayButtonProps {
  package: {
    id: string;
    name: string;
    price_inr: number;
    points_amount?: number;
  };
  type: 'points' | 'boost' | 'verification';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
  children?: React.ReactNode;
}

const QuickPayButton: React.FC<QuickPayButtonProps> = ({
  package: pkg,
  type,
  variant = 'default',
  size = 'default',
  className,
  children
}) => {
  const navigate = useNavigate();

  const handleClick = () => {
    // Navigate to guest checkout with package details
    const params = new URLSearchParams({
      package: pkg.id,
      type: type
    });
    
    navigate(`/guest-checkout?${params.toString()}`);
  };

  const getIcon = () => {
    switch (type) {
      case 'points':
        return <Coins className="w-4 h-4" />;
      case 'boost':
        return <Zap className="w-4 h-4" />;
      case 'verification':
        return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
    >
      {children || (
        <>
          {getIcon()}
          <span className="ml-2">Pay ₹{pkg.price_inr}</span>
        </>
      )}
    </Button>
  );
};

export default QuickPayButton;