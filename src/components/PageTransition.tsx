import { ReactNode, useEffect, useState } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  type?: 'fade' | 'slide' | 'scale';
}

export const PageTransition = ({ children, type = 'fade' }: PageTransitionProps) => {
  return (
    <div className="page-enter">
      {children}
    </div>
  );
};
