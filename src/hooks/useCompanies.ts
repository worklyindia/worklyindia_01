import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Company {
  id: string;
  name: string;
  industry: string;
  location: string;
  employees: string;
  rating: number;
  openJobs: number;
  description: string;
  founded: number;
  website: string;
  verified: boolean;
  trending: boolean;
  logo_url?: string;
  badge_color?: string;
  instagram_link?: string;
  facebook_link?: string;
  youtube_link?: string;
  linkedin_link?: string;
  slug?: string;
  short_id?: string;
}

export const useCompanies = (searchTerm: string = "", selectedIndustry: string = "All") => {
  return useQuery({
    queryKey: ["companies", searchTerm, selectedIndustry],
    queryFn: async (): Promise<Company[]> => {
      console.log("🔍 Starting companies query...");
      
      // Build the basic company query without nested relationships
      let query = supabase
        .from("companies")
        .select(`
          id,
          company_name,
          industry,
          location,
          city,
          state,
          country,
          precise_address,
          company_size,
          description,
          website,
          logo_url,
          is_verified,
          verified_plan_end,
          badge_color,
          incorporation_date,
          instagram_link,
          facebook_link,
          youtube_link,
          linkedin_link,
          created_at,
          trending_score,
          account_status,
          slug,
          short_id
        `)
        .eq("is_profile_complete", true)
        .eq("account_status", "active");

      // Apply search filter
      if (searchTerm.trim()) {
        query = query.or(`company_name.ilike.%${searchTerm}%,industry.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`);
      }

      // Apply industry filter
      if (selectedIndustry !== "All") {
        query = query.ilike("industry", selectedIndustry);
      }

      // Order: verified first, then trending_score, then recency
      query = query
        .order("is_verified", { ascending: false })
        .order("trending_score", { ascending: false })
        .order("created_at", { ascending: false });

      console.log("🔍 Executing companies query...");
      const { data, error } = await query;

      console.log("🔍 Query result:", { data, error });

      if (error) {
        console.error("❌ Companies query error:", error);
        throw error;
      }

      if (!data || data.length === 0) {
        console.log("🔍 No companies found with complete profiles");
        return [];
      }

      // Fetch additional data for each company separately to avoid nested query issues
      const companiesWithData = await Promise.all(
        data.map(async (company: any) => {
          let openJobs = 0;
          let rating = 0;

          try {
            // Get active jobs count
            const { data: jobsData } = await supabase
              .from("jobs")
              .select("id")
              .eq("company_id", company.id)
              .eq("status", "active");
            
            openJobs = jobsData?.length || 0;
          } catch (error) {
            console.warn(`Failed to fetch jobs for company ${company.id}:`, error);
          }

          try {
            // Get company reviews for rating
            const { data: reviewsData } = await supabase
              .from("company_reviews")
              .select("rating")
              .eq("company_id", company.id);
            
            if (reviewsData && reviewsData.length > 0) {
              const ratings = reviewsData
                .map((review: any) => review.rating)
                .filter((r: number) => r && r > 0);
              
              if (ratings.length > 0) {
                rating = Math.round((ratings.reduce((sum: number, r: number) => sum + r, 0) / ratings.length) * 10) / 10;
              }
            }
          } catch (error) {
            console.warn(`Failed to fetch reviews for company ${company.id}:`, error);
          }

          const foundedYear = company.incorporation_date 
            ? new Date(company.incorporation_date).getFullYear()
            : new Date(company.created_at).getFullYear();

          // Fix location logic
          const getLocation = () => {
            if (company.precise_address) {
              return company.precise_address;
            }
            
            const addressParts = [
              company.city,
              company.state, 
              company.country
            ].filter(part => part && part.trim() && part.toLowerCase() !== 'mu');
            
            if (addressParts.length > 0) {
              return addressParts.join(', ');
            }
            
            if (company.location && company.location.trim() && company.location.toLowerCase() !== 'mu') {
              return company.location;
            }
            
            return "India";
          };

          return {
            id: company.id,
            name: company.company_name || "Company",
            industry: company.industry || "Other",
            location: getLocation(),
            employees: company.company_size || "Not specified",
            rating,
            openJobs,
            description: company.description || "No description available",
            founded: foundedYear,
            website: company.website || "",
            verified: company.is_verified || false,
            trending: openJobs > 0,
            logo_url: company.logo_url,
            badge_color: company.badge_color,
            instagram_link: company.instagram_link,
            facebook_link: company.facebook_link,
            youtube_link: company.youtube_link,
            linkedin_link: company.linkedin_link,
            slug: company.slug,
            short_id: company.short_id,
          };
        })
      );

      // Sort companies: Verified first, then by total jobs count (descending)
      const sortedCompanies = companiesWithData.sort((a, b) => {
        // Priority 1: Verified companies first
        if (a.verified !== b.verified) {
          return a.verified ? -1 : 1;
        }
        
        // Priority 2: Sort by openJobs count (descending - more jobs = higher rank)
        return b.openJobs - a.openJobs;
      });

      console.log("🔍 Final sorted companies data:", sortedCompanies);
      return sortedCompanies;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};