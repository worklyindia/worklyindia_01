import CopyPageButton from "@/components/docs/CopyPageButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, CheckCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const PostmanDocs = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDownload = () => {
    fetch('/postman/wfh-india-api-collection-updated.json')
      .then(response => response.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'WFH-India-API-Collection.json';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Collection Downloaded",
          description: "Import the JSON file in Postman to get started",
        });
      })
      .catch(error => {
        console.error('Download error:', error);
        toast({
          title: "Download Failed",
          description: "Please try again or contact support",
          variant: "destructive",
        });
      });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-purple-50 p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/owner-portal/api-docs')}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to API Documentation
        </Button>
          <CopyPageButton title="Postman Docs" />
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Download className="w-8 h-8 text-orange-600" />
              <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                Postman Collection
              </h1>
            </div>
            <p className="text-muted-foreground text-lg">
              Pre-configured Postman collection for easy API testing
            </p>
          </div>

          <Separator />

          {/* Download Collection */}
          <Card>
            <CardHeader>
              <CardTitle>Download Collection</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Get the complete Workly India API collection with pre-configured requests for all endpoints including job boost, extend, and application features:
              </p>
              <Button className="gap-2" onClick={handleDownload}>
                <Download className="w-4 h-4" />
                Download Postman Collection
              </Button>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-xs text-green-800">
                  <strong>Ready to Use:</strong> Download the collection and import it into Postman to instantly test all API endpoints including job search, boost (wallet & API key), extend (wallet & API key), and applications with pre-configured authentication.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Import Steps */}
          <Card>
            <CardHeader>
              <CardTitle>Import to Postman</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3">
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                    1
                  </span>
                  <div>
                    <p className="font-semibold">Open Postman</p>
                    <p className="text-sm text-muted-foreground">
                      Launch the Postman application on your computer
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                    2
                  </span>
                  <div>
                    <p className="font-semibold">Click Import Button</p>
                    <p className="text-sm text-muted-foreground">
                      Find and click the "Import" button in the top left corner
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                    3
                  </span>
                  <div>
                    <p className="font-semibold">Select Collection File</p>
                    <p className="text-sm text-muted-foreground">
                      Choose the downloaded "WFH-India-API-Collection.json" file and click import
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                    4
                  </span>
                  <div>
                    <p className="font-semibold">Configure Environment</p>
                    <p className="text-sm text-muted-foreground">
                      Set up your API key in environment variables
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex-shrink-0">
                    5
                  </span>
                  <div>
                    <p className="font-semibold">Start Testing</p>
                    <p className="text-sm text-muted-foreground">
                      All endpoints are ready to test!
                    </p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>

          {/* Environment Setup */}
          <Card>
            <CardHeader>
              <CardTitle>Environment Variables</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Configure these variables in your Postman environment:
              </p>
              <div className="space-y-3">
                <div className="p-3 border rounded-lg">
                  <p className="font-mono text-sm font-semibold mb-1">api_key</p>
                  <p className="text-xs text-muted-foreground">
                    Your Workly India API key (required for authentication)
                  </p>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-mono text-sm font-semibold mb-1">base_url</p>
                  <p className="text-xs text-muted-foreground mb-2">
                    API base URL (already configured in collection)
                  </p>
                  <pre className="bg-muted p-2 rounded mt-2 text-xs overflow-x-auto break-all whitespace-pre-wrap">
https://YOUR_PROJECT_ID.supabase.co/functions/v1/
                  </pre>
                </div>
                <div className="p-3 border rounded-lg">
                  <p className="font-mono text-sm font-semibold mb-1">job_id</p>
                  <p className="text-xs text-muted-foreground">
                    Optional: Store job ID for testing specific jobs
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Collection Contents */}
          <Card>
            <CardHeader>
              <CardTitle>What's Included</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Job Search</p>
                    <p className="text-xs text-muted-foreground">Search jobs with filters (query, location, limit)</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Get Job Details by ID</p>
                    <p className="text-xs text-muted-foreground">Fetch complete job details with all company info, skills, requirements, and metadata</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Job Boost - Wallet</p>
                    <p className="text-xs text-muted-foreground">Boost jobs using wallet points (100/200/300 pts per week)</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Job Boost - API Key</p>
                    <p className="text-xs text-muted-foreground">Boost jobs via API (levels 1-3, 7/14/30 days)</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Job Extension - Wallet</p>
                    <p className="text-xs text-muted-foreground">Extend job duration with wallet (50 pts/month)</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Job Extension - API Key</p>
                    <p className="text-xs text-muted-foreground">Extend job duration via API (1/2/3/6 months)</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Job Applications</p>
                    <p className="text-xs text-muted-foreground">Submit applications with resume and details</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Pre-configured Headers</p>
                    <p className="text-xs text-muted-foreground">Authorization and content-type headers ready to use</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Example Request Bodies</p>
                    <p className="text-xs text-muted-foreground">Sample data for POST/PUT requests</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2">
                  <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-sm">Tests & Scripts</p>
                    <p className="text-xs text-muted-foreground">Automated tests and variable extraction</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tips */}
          <Card>
            <CardHeader>
              <CardTitle>Pro Tips</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Use Postman's environment switcher to toggle between dev and production</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Enable auto-sync to share collection updates with your team</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Use collection runner to test multiple requests in sequence</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Monitor API health by scheduling collection runs</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  <span>Generate code snippets in any language from Postman requests</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PostmanDocs;
