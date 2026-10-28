import professional from '@/assets/resume-templates/professional.webp';
import atsSimple from '@/assets/resume-templates/ats-simple.webp';
import modern from '@/assets/resume-templates/modern.webp';
import minimal from '@/assets/resume-templates/minimal.webp';
import executive from '@/assets/resume-templates/executive.webp';
import fresher from '@/assets/resume-templates/fresher.webp';
import twoColumn from '@/assets/resume-templates/two-column.webp';
import oneColumn from '@/assets/resume-templates/one-column.webp';
import compact from '@/assets/resume-templates/compact.webp';
import creative from '@/assets/resume-templates/creative.webp';

import clAts from '@/assets/cover-templates/ats.webp';
import clModern from '@/assets/cover-templates/modern.webp';
import clMinimal from '@/assets/cover-templates/minimal.webp';
import clExecutive from '@/assets/cover-templates/executive.webp';
import clCorporate from '@/assets/cover-templates/corporate.webp';
import clElegant from '@/assets/cover-templates/elegant.webp';
import clClassic from '@/assets/cover-templates/classic.webp';
import clCreative from '@/assets/cover-templates/creative.webp';
import clSimple from '@/assets/cover-templates/simple.webp';
import clPremium from '@/assets/cover-templates/premium.webp';

export const RESUME_TEMPLATE_THUMBS: Record<string, string> = {
  Professional: professional,
  'ATS Simple': atsSimple,
  Modern: modern,
  Minimal: minimal,
  Executive: executive,
  Fresher: fresher,
  'Two Column': twoColumn,
  'One Column': oneColumn,
  Compact: compact,
  Creative: creative,
};

export const COVER_LETTER_TEMPLATE_THUMBS: Record<string, string> = {
  Professional: clPremium,
  'ATS Simple': clAts,
  Fresher: clElegant,
  Formal: clClassic,
  'ATS Professional': clAts,
  Modern: clModern,
  Minimal: clMinimal,
  Executive: clExecutive,
  Corporate: clCorporate,
  Elegant: clElegant,
  Classic: clClassic,
  Creative: clCreative,
  Simple: clSimple,
  Premium: clPremium,
};
