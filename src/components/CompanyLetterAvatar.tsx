import { getCompanyLetterAvatar } from '@/utils/companyLetterAvatar';
import { cn } from '@/lib/utils';

interface Props {
  company?: string | null;
  className?: string;
  textClassName?: string;
}

/**
 * Colorful letter tile used as a fallback when a company has no real logo.
 * Colors are derived from the company name hash so different companies look
 * visibly different.
 */
const CompanyLetterAvatar = ({ company, className, textClassName }: Props) => {
  const { letter, bg, fg } = getCompanyLetterAvatar(company);
  return (
    <div
      className={cn('flex items-center justify-center w-full h-full', bg, className)}
      aria-label={`${company || 'Company'} logo`}
    >
      <span className={cn('font-bold leading-none', fg, textClassName || 'text-base')}>
        {letter}
      </span>
    </div>
  );
};

export default CompanyLetterAvatar;
