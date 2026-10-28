import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Copyright, FileText, ShieldAlert, Mail } from "lucide-react";
import SEO from "@/components/SEO";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";
import { useContactInfo } from "@/hooks/useSiteSettings";

const DMCA = () => {
  const lastUpdated = getUpdatedTimestamp("dmca");
  const { data: contactInfo } = useContactInfo();
  const supportEmail = contactInfo?.email?.trim() || "worklyindia@outlook.com";

  return (
    <>
      <SEO
        title="DMCA / Copyright Policy - Workly India Jobs"
        description="Workly India respects intellectual property rights. Learn how to submit a DMCA takedown notice or counter-notice for copyright infringement claims."
        keywords="DMCA, copyright policy, takedown notice, intellectual property, Workly India"
      />

      <div className="min-h-screen bg-background">
        <PageHeader title="DMCA / Copyright Policy" />

        <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-4">Legal</Badge>
            <h1 className="text-4xl font-bold text-foreground mb-4">
              DMCA / Copyright Policy
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Workly India respects the intellectual property rights of others and expects users of
              our platform to do the same. This policy explains how to submit copyright
              infringement notices and counter-notices.
            </p>
            <p className="text-sm text-muted-foreground mt-2">Last updated: {lastUpdated}</p>
          </div>

          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Copyright className="w-5 h-5 text-primary" /> Copyright Ownership
              </h2>
              <p className="text-sm text-muted-foreground">
                All original content on Workly India — including logos, design, code, and editorial
                material — is the property of Workly India or its licensors and is protected by
                Indian and international copyright laws. Job listings and company details are
                provided by third-party employers and recruiters and remain the property of their
                respective owners.
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" /> Filing a Takedown Notice
              </h2>
              <p className="text-sm text-muted-foreground mb-3">
                If you believe content on our platform infringes your copyright, please send a
                written notice that includes:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground list-disc pl-5">
                <li>A description of the copyrighted work you claim has been infringed.</li>
                <li>The URL(s) or exact location of the allegedly infringing material on our site.</li>
                <li>Your full name, address, phone number, and email address.</li>
                <li>
                  A statement that you have a good faith belief that the disputed use is not
                  authorized by the copyright owner, its agent, or the law.
                </li>
                <li>
                  A statement, under penalty of perjury, that the information is accurate and that
                  you are the copyright owner or authorized to act on the owner's behalf.
                </li>
                <li>Your physical or electronic signature.</li>
              </ul>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Counter-Notice
              </h2>
              <p className="text-sm text-muted-foreground">
                If you believe content you posted was removed by mistake, you may submit a
                counter-notice with your contact information, identification of the removed
                content, and a statement under penalty of perjury that the removal was in error.
              </p>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-primary" /> Where to Send Notices
              </h2>
              <p className="text-sm text-muted-foreground">
                Send all DMCA / copyright notices to our designated agent at{" "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-primary underline underline-offset-4"
                >
                  {supportEmail}
                </a>
                . We will review and respond to valid notices in accordance with applicable law and
                may remove or disable access to reported material.
              </p>
              <p className="text-xs text-muted-foreground mt-3">
                Repeat infringers may have their accounts suspended or terminated.
              </p>
            </Card>
          </div>
        </main>

      </div>
    </>
  );
};

export default DMCA;
