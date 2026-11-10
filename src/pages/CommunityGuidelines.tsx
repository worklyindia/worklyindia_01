import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Heart, XCircle, MessageCircle } from "lucide-react";
import SEO from "@/components/SEO";

const CommunityGuidelines = () => (
  <>
    <SEO
      title="Community Guidelines - Workly India"
      description="Rules that keep the Workly India community respectful, safe, and helpful for everyone."
      keywords="community guidelines, code of conduct, community rules"
    />
    <div className="min-h-screen bg-background">
      <PageHeader title="Community Guidelines" />
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-4">Community</Badge>
          <h1 className="text-4xl font-bold mb-4">Community Guidelines</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Simple rules that make Workly India a welcoming space for job seekers and employers.
          </p>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><Heart className="w-5 h-5 mr-2 text-primary" />Be Respectful</h2>
            <p className="text-sm text-muted-foreground">
              Treat everyone with kindness. No discrimination based on gender, caste, religion, disability, age, or background is tolerated.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><MessageCircle className="w-5 h-5 mr-2 text-primary" />Communicate Honestly</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Provide truthful information in profiles and job posts</li>
              <li>• Keep conversations professional</li>
              <li>• Do not share misleading offers or fake claims</li>
            </ul>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><Users className="w-5 h-5 mr-2 text-primary" />Support Each Other</h2>
            <p className="text-sm text-muted-foreground">
              Share knowledge, refer opportunities, and give constructive feedback. A helpful community benefits everyone.
            </p>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-3 flex items-center"><XCircle className="w-5 h-5 mr-2 text-destructive" />Not Allowed</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Harassment, threats, hate speech, or bullying</li>
              <li>• Spam, scams, or misleading content</li>
              <li>• Sharing private information without consent</li>
              <li>• Adult, illegal, or violent content</li>
            </ul>
            <p className="mt-3 text-sm text-muted-foreground">
              Violations may result in warnings, content removal, or permanent account suspension.
            </p>
          </Card>
        </div>
      </main>
    </div>
  </>
);

export default CommunityGuidelines;
