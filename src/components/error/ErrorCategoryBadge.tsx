import { Database, Wifi, Lock, Code } from 'lucide-react';
import { CategorizedError } from '@/utils/errorCategorizer';

interface ErrorCategoryBadgeProps {
  category: CategorizedError;
  size?: 'sm' | 'lg';
}

const iconMap = {
  Database,
  Wifi,
  Lock,
  Code,
};

export const ErrorCategoryBadge = ({ category, size = 'lg' }: ErrorCategoryBadgeProps) => {
  const Icon = iconMap[category.icon as keyof typeof iconMap];
  const isLarge = size === 'lg';

  return (
    <div className="flex flex-col items-center gap-1.5 animate-fade-in">
      <div
        className={`rounded-xl flex items-center justify-center relative ${
          isLarge ? 'w-12 h-12' : 'w-9 h-9'
        }`}
        style={{
          background: `linear-gradient(135deg, ${category.color}20, ${category.color}10)`,
          boxShadow: `0 8px 24px ${category.color}40`,
          animation: 'icon-pulse 2s ease-in-out infinite',
        }}
      >
        {/* Animated glow ring */}
        <div 
          className="absolute inset-0 rounded-xl animate-ping opacity-20"
          style={{ background: category.color }}
        />
        
        {/* Icon with color and glow animation */}
        <Icon 
          className={`${isLarge ? 'w-6 h-6' : 'w-4 h-4'} relative z-10`}
          style={{ 
            color: category.color,
            filter: 'drop-shadow(0 0 8px currentColor)',
            animation: 'icon-glow 2s ease-in-out infinite',
          }}
        />
      </div>
      
      <div className="text-center">
        <div
          className={`font-semibold ${isLarge ? 'text-sm' : 'text-xs'}`}
          style={{ color: category.color }}
        >
          {category.title}
        </div>
        {category.details.type && (
          <div className="text-[10px] text-muted-foreground mt-0.5">
            {category.details.type}
          </div>
        )}
      </div>
      
      <style>{`
        @keyframes icon-pulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 8px 24px ${category.color}40;
          }
          50% {
            transform: scale(1.05);
            box-shadow: 0 8px 32px ${category.color}60, 0 0 40px ${category.color}30;
          }
        }

        @keyframes icon-glow {
          0%, 100% {
            filter: drop-shadow(0 0 8px currentColor);
          }
          50% {
            filter: drop-shadow(0 0 16px currentColor) brightness(1.2);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            animation-duration: 0.01ms !important;
          }
        }
      `}</style>
    </div>
  );
};
