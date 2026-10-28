import { supabase } from "@/integrations/supabase/client";

/**
 * Safely fetches the latest company record for a user
 * Handles potential duplicate records by returning the most recent one
 */
export async function getLatestCompanyForUser(userId: string) {
  try {
    const { data: company, error } = await supabase
      .from('companies')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching company:', error);
      return { data: null, error };
    }

    return { data: company, error: null };
  } catch (error: any) {
    console.error('Unexpected error fetching company:', error);
    return { data: null, error };
  }
}

/**
 * Checks if a company profile is complete based on required fields
 */
export function isCompanyProfileComplete(company: any): boolean {
  if (!company) return false;
  
  // Required fields: Company Name, Legal Name, Phone, WhatsApp Number, HR Contact Name
  const hasCompanyName = !!(company.company_name?.toString().trim());
  const hasLegalName = !!(company.legal_name?.toString().trim());
  const hasPhone = !!(company.phone?.toString().trim());
  const hasWhatsAppNumber = !!(company.whatsapp_number?.toString().trim());
  const hasHrContactName = !!(company.hr_contact_name?.toString().trim());

  const isComplete = hasCompanyName && hasLegalName && hasPhone && hasWhatsAppNumber && hasHrContactName;
  
  console.log('Company profile completion check:', {
    companyId: company.id,
    fieldChecks: {
      hasCompanyName,
      hasLegalName,
      hasPhone,
      hasWhatsAppNumber,
      hasHrContactName
    },
    isComplete,
    dbFlag: company.is_profile_complete
  });

  return isComplete;
}