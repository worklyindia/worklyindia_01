import { useContactInfo as useSiteContactInfo } from "@/hooks/useSiteSettings";

export interface ContactInfo {
  email: string;
  phone: string;
  address: string;
  additional_info?: Record<string, any>;
}

/**
 * All public pages read the single contact record saved by the owner
 * (site_settings.contact_info, same as the Contact Us page).
 * The infoType argument is kept for backward compatibility.
 */
export const useContactInfo = (_infoType: string = "general") => {
  const query = useSiteContactInfo();
  const v = query.data;
  const data: ContactInfo | undefined = v
    ? {
        email: v.email?.trim() || "",
        phone: v.phone?.trim() || "",
        address: v.office_address?.trim() || "",
      }
    : undefined;
  return { ...query, data };
};
