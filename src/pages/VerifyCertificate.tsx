import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  XCircle,
  Award,
  Download,
  Share2,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { downloadCertificate } from "@/utils/certificateGenerator";
import type { UserCertificate } from "@/types/assessment";
import { Helmet } from "react-helmet-async";

const VerifyCertificate = () => {
  const { certificateNumber } = useParams<{ certificateNumber: string }>();
  const [certificate, setCertificate] = useState<UserCertificate | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    fetchCertificate();
  }, [certificateNumber]);

  const fetchCertificate = async () => {
    if (!certificateNumber) return;

    try {
      const { data: certData, error: certError } = await supabase
        .from("user_certificates")
        .select("*")
        .eq("certificate_number", certificateNumber)
        .single();

      if (certError || !certData) {
        setIsValid(false);
        setLoading(false);
        return;
      }

      setCertificate(certData as UserCertificate);

      // Fetch user name
      const { data: userData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", certData.user_id)
        .single();

      setUserName(userData?.full_name || "User");

      // Check if certificate is expired
      if (certData.expires_at) {
        const expiryDate = new Date(certData.expires_at);
        const now = new Date();
        setIsValid(now < expiryDate);
      } else {
        setIsValid(true);
      }
    } catch (error) {
      console.error("Error fetching certificate:", error);
      setIsValid(false);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!certificate) return;
    try {
      await downloadCertificate(certificate, userName);
      toast.success("Certificate downloaded successfully!");
    } catch (error) {
      toast.error("Failed to download certificate");
    }
  };

  const handleShare = () => {
    const url = window.location.href;
    const text = `I've earned a ${certificate?.level} level certification in ${certificate?.skill_name} from Workly India with a score of ${certificate?.score}%!`;

    if (navigator.share) {
      navigator
        .share({
          title: "My Workly India Certificate",
          text,
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard.writeText(`${text}\n${url}`);
      toast.success("Certificate link copied to clipboard!");
    }
  };

  const handleLinkedInShare = () => {
    const url = window.location.href;
    const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
      url
    )}`;
    window.open(linkedInUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying certificate...</p>
        </div>
      </div>
    );
  }

  if (!certificate || !isValid) {
    return (
      <>
        <Helmet>
          <title>Certificate Not Found | Workly India</title>
          <meta name="description" content="Certificate verification failed" />
        </Helmet>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Card className="p-8 max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Certificate Not Found
            </h1>
            <p className="text-muted-foreground mb-4">
              {!certificate
                ? "The certificate number you entered is invalid."
                : "This certificate has expired."}
            </p>
            <p className="text-sm text-muted-foreground">
              Certificate Number: <code className="bg-muted px-2 py-1 rounded">{certificateNumber}</code>
            </p>
          </Card>
        </div>
      </>
    );
  }

  const getLevelBadgeColor = (level: string) => {
    const colors: Record<string, string> = {
      Expert: "bg-purple-100 text-purple-800",
      Advanced: "bg-blue-100 text-blue-800",
      Intermediate: "bg-yellow-100 text-yellow-800",
      Beginner: "bg-green-100 text-green-800",
    };
    return colors[level] || "bg-gray-100 text-gray-800";
  };

  const issueDate = new Date(certificate.issued_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      <Helmet>
        <title>Verify Certificate - {certificate.skill_name} | Workly India</title>
        <meta
          name="description"
          content={`Certificate verification for ${userName} - ${certificate.skill_name} ${certificate.level} certification`}
        />
      </Helmet>
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="container mx-auto max-w-3xl">
          {/* Verification Status */}
          <Card className="p-8 text-center mb-6">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              Certificate Verified
            </h1>
            <p className="text-muted-foreground mb-4">
              This is an authentic certificate issued by Workly India
            </p>
            <div className="inline-flex items-center px-4 py-2 bg-muted rounded-lg">
              <Award className="w-5 h-5 text-primary mr-2" />
              <code className="font-mono text-sm">{certificate.certificate_number}</code>
            </div>
          </Card>

          {/* Certificate Details */}
          <Card className="p-8 mb-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-foreground mb-2">
                {userName}
              </h2>
              <p className="text-muted-foreground text-sm mb-4">
                has successfully completed
              </p>
              <h3 className="text-3xl font-bold text-primary mb-4">
                {certificate.skill_name}
              </h3>
              <Badge className={`text-lg px-4 py-1 ${getLevelBadgeColor(certificate.level)}`}>
                {certificate.level}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-primary mb-1">
                  {certificate.score}%
                </div>
                <div className="text-sm text-muted-foreground">Score</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-foreground mb-1">
                  {issueDate}
                </div>
                <div className="text-sm text-muted-foreground">Issue Date</div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-green-600 mb-1">
                  Valid
                </div>
                <div className="text-sm text-muted-foreground">Status</div>
              </div>
            </div>

            {certificate.expires_at && (
              <p className="text-sm text-center text-muted-foreground">
                Expires on:{" "}
                {new Date(certificate.expires_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            )}
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              onClick={handleDownload}
              className="rounded-xl"
              size="lg"
            >
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={handleLinkedInShare}
              variant="outline"
              className="rounded-xl"
              size="lg"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              Share on LinkedIn
            </Button>
            <Button
              onClick={handleShare}
              variant="outline"
              className="rounded-xl"
              size="lg"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>

          {/* About Section */}
          <Card className="p-6 mt-6">
            <h4 className="font-semibold text-foreground mb-2">About Workly India</h4>
            <p className="text-sm text-muted-foreground">
              Workly India is India's leading platform for Workly India opportunities and
              professional skill development. Our skill assessments are designed by
              industry experts and are recognized by employers across the country.
            </p>
          </Card>
        </div>
      </div>
    </>
  );
};

export default VerifyCertificate;
