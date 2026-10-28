export interface SkillCategory {
  id: string;
  title: string;
  slug: string;
  description: string;
  icon_name: string;
  difficulty: string;
  duration: string;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SkillAssessment {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  description: string | null;
  difficulty: string;
  total_questions: number;
  passing_score: number;
  duration_minutes: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssessmentQuestion {
  id: string;
  assessment_id: string;
  question_text: string;
  question_type: string;
  options: Array<{ text: string; value: string }>;
  correct_answer_index: number;
  explanation: string | null;
  difficulty: string;
  points: number;
  display_order: number;
  created_at: string;
}

export interface UserAnswer {
  question_id: string;
  selected_index: number;
  is_correct: boolean;
  time_spent_seconds: number;
}

export interface UserAssessmentAttempt {
  id: string;
  user_id: string;
  assessment_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'in_progress' | 'completed' | 'abandoned';
  score: number | null;
  correct_answers: number | null;
  total_questions: number;
  time_taken_minutes: number | null;
  answers: UserAnswer[];
  certificate_issued: boolean;
  created_at: string;
}

export interface UserCertificate {
  id: string;
  user_id: string;
  assessment_id: string;
  attempt_id: string;
  certificate_number: string;
  skill_name: string;
  score: number;
  level: string;
  issued_at: string;
  expires_at: string | null;
  verification_url: string | null;
  created_at: string;
}

export interface AssessmentWithCategory extends SkillAssessment {
  category: SkillCategory;
}

export interface AttemptWithAssessment extends UserAssessmentAttempt {
  assessment: SkillAssessment;
}
