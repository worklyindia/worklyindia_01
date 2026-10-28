import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  User, Building2, Phone, Mail, MapPin, Briefcase, 
  ExternalLink, X, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";

interface ContactSidebarProps {
  phoneNumber: string;
  contactType: string;
  linkedUserId?: string | null;
  onClose: () => void;
}

export function ContactSidebar({ phoneNumber, contactType, linkedUserId, onClose }: ContactSidebarProps) {
  // Fetch profile data for jobseeker
  const { data: profile } = useQuery<any>({
    queryKey: ['contact-profile', linkedUserId],
    queryFn: async () => {
      if (!linkedUserId || contactType !== 'jobseeker') return null;
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', linkedUserId)
        .single();
      return data;
    },
    enabled: !!linkedUserId && contactType === 'jobseeker',
  });

  // Fetch company data for employer
  const { data: company } = useQuery<any>({
    queryKey: ['contact-company', linkedUserId],
    queryFn: async () => {
      if (!linkedUserId || contactType !== 'employer') return null;
      const { data } = await supabase
        .from('companies')
        .select('*')
        .eq('user_id', linkedUserId)
        .single();
      return data;
    },
    enabled: !!linkedUserId && contactType === 'employer',
  });
  type AppliedJob = { id: string; created_at: string; status: string; job_id: string };
  
  // Fetch applied jobs for jobseeker
  const { data: appliedJobs = [] } = useQuery<AppliedJob[]>({
    queryKey: ['contact-applied-jobs', linkedUserId],
    queryFn: async (): Promise<AppliedJob[]> => {
      if (!linkedUserId || contactType !== 'jobseeker') {
        return [];
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from('job_applications')
        .select('id, created_at, status, job_id')
        .eq('user_id', linkedUserId)
        .order('created_at', { ascending: false })
        .limit(5);
      return (data ?? []) as AppliedJob[];
    },
    enabled: !!linkedUserId && contactType === 'jobseeker',
  });

  // Fetch posted jobs for employer
  const { data: postedJobs = [] } = useQuery<any[]>({
    queryKey: ['contact-posted-jobs', linkedUserId, company?.id],
    queryFn: async () => {
      if (!linkedUserId || contactType !== 'employer' || !company?.id) return [];
      const { data } = await supabase
        .from('jobs')
        .select('id, title, created_at, status')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!linkedUserId && contactType === 'employer' && !!company?.id,
  });

  const renderJobseekerContent = () => (
    <>
      {profile ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16">
              <AvatarImage src={profile.profile_image_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                <User className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{profile.full_name || 'Unknown'}</h3>
              <p className="text-sm text-muted-foreground">{profile.current_position || 'Job Seeker'}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{phoneNumber}</span>
            </div>
            {profile.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{profile.email}</span>
              </div>
            )}
            {(profile.city || profile.state) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{[profile.city, profile.state].filter(Boolean).join(', ')}</span>
              </div>
            )}
            {profile.experience_years && (
              <div className="flex items-center gap-2 text-sm">
                <Briefcase className="h-4 w-4 text-muted-foreground" />
                <span>{profile.experience_years} years experience</span>
              </div>
            )}
          </div>

          {profile.skills?.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Skills</h4>
                <div className="flex flex-wrap gap-1">
                  {profile.skills.slice(0, 6).map((skill: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {appliedJobs.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Recent Applications</h4>
                <div className="space-y-2">
                  {appliedJobs.map((app) => (
                    <div key={app.id} className="p-2 bg-muted rounded-lg">
                      <Badge variant={app.status === 'accepted' ? 'default' : 'secondary'} className="text-xs">
                        {app.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground ml-2">
                        {format(new Date(app.created_at), 'MMMM d')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button variant="outline" className="w-full" asChild>
            <a href={`/profile/${linkedUserId}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Profile
            </a>
          </Button>
        </div>
      ) : (
        <div className="text-center py-8">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Profile not linked</p>
          <p className="text-xs text-muted-foreground mt-1">Phone: {phoneNumber}</p>
        </div>
      )}
    </>
  );

  const renderEmployerContent = () => (
    <>
      {company ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16">
              <AvatarImage src={company.logo_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                <Building2 className="h-8 w-8" />
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="font-semibold">{company.company_name}</h3>
              <div className="flex items-center gap-1">
                {company.is_verified && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                <p className="text-sm text-muted-foreground">{company.industry || 'Company'}</p>
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span>{phoneNumber}</span>
            </div>
            {company.email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{company.email}</span>
              </div>
            )}
            {(company.city || company.state) && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{[company.city, company.state].filter(Boolean).join(', ')}</span>
              </div>
            )}
          </div>

          {postedJobs.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Posted Jobs</h4>
                <div className="space-y-2">
                  {postedJobs.map((job) => (
                    <div key={job.id} className="p-2 bg-muted rounded-lg">
                      <p className="text-sm font-medium">{job.title}</p>
                      <Badge variant={job.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                        {job.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <Button variant="outline" className="w-full" asChild>
            <a href={`/company/${company.id}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              View Company Profile
            </a>
          </Button>
        </div>
      ) : (
        <div className="text-center py-8">
          <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">Company not linked</p>
          <p className="text-xs text-muted-foreground mt-1">Phone: {phoneNumber}</p>
        </div>
      )}
    </>
  );

  const renderUnknownContent = () => (
    <div className="text-center py-8">
      <Phone className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
      <p className="font-medium">{phoneNumber}</p>
      <p className="text-sm text-muted-foreground mt-1">Unknown contact type</p>
    </div>
  );

  return (
    <div className="w-80 border-l bg-background flex flex-col h-full">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Contact Info</h3>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4">
        {contactType === 'jobseeker' && renderJobseekerContent()}
        {contactType === 'employer' && renderEmployerContent()}
        {contactType === 'unknown' && renderUnknownContent()}
      </ScrollArea>
    </div>
  );
}
