import { ReactNode } from 'react';
import { Link, LinkProps } from 'react-router-dom';
import { useNativeFeel } from '@/hooks/useNativeFeel';

interface NativeLinkProps extends LinkProps {
  children: ReactNode;
  className?: string;
}

export const NativeLink = ({ children, className = '', ...props }: NativeLinkProps) => {
  const { tapFeedback } = useNativeFeel();

  const handleClick = () => {
    tapFeedback();
  };

  return (
    <Link
      {...props}
      className={`active:scale-95 transition-transform ${className}`}
      onClick={handleClick}
    >
      {children}
    </Link>
  );
};
