import { useQuery } from "@tanstack/react-query";

// Static job categories (prefetch at build time)
export const JOB_CATEGORIES = [
  "Customer Support",
  "Data Entry",
  "Content Writing",
  "Software Development",
  "Digital Marketing",
  "Graphic Design",
  "Virtual Assistant",
  "Sales & Marketing",
  "Accounting & Finance",
  "Human Resources",
  "Teaching & Tutoring",
  "Transcription",
  "Translation",
  "Video Editing",
  "Social Media Management",
];

// Static skill list
export const COMMON_SKILLS = [
  "Communication",
  "Microsoft Excel",
  "Microsoft Word",
  "Data Entry",
  "Customer Service",
  "Email Management",
  "Time Management",
  "Problem Solving",
  "Attention to Detail",
  "Fast Typing",
  "English Proficiency",
  "Hindi Proficiency",
  "Computer Literacy",
  "Internet Research",
  "Multi-tasking",
];

// Hook for job categories with 24-hour cache
export const useJobCategories = () => {
  return useQuery({
    queryKey: ['job-categories'],
    queryFn: async () => JOB_CATEGORIES,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
};

// Hook for common skills with 24-hour cache
export const useCommonSkills = () => {
  return useQuery({
    queryKey: ['common-skills'],
    queryFn: async () => COMMON_SKILLS,
    staleTime: 1000 * 60 * 60 * 24, // 24 hours
    gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days
  });
};

// Prefetch function to call in main.tsx
export const prefetchStaticData = (queryClient: any) => {
  queryClient.prefetchQuery({
    queryKey: ['job-categories'],
    queryFn: async () => JOB_CATEGORIES,
  });
  
  queryClient.prefetchQuery({
    queryKey: ['common-skills'],
    queryFn: async () => COMMON_SKILLS,
  });
};
