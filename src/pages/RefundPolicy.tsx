import PageHeader from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, DollarSign, Clock, CheckCircle, XCircle, AlertCircle, Shield } from "lucide-react";
import { getUpdatedTimestamp } from "@/utils/timestampUtils";
import { useContactInfo } from "@/hooks/useContactInfo";

const RefundPolicy = () => {
  const lastUpdated = getUpdatedTimestamp('refund');
  const { data: contactInfo } = useContactInfo('support');

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="Refund & Cancellation" />
      
      <main className="container mx-auto px-4 py-6 pb-24 md:pb-8 max-w-4xl">
        {/* Header Section */}
        <div className="text-center mb-12">
          <Badge variant="secondary" className="mb-4">Refund Policy</Badge>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Cancellation & Refund Policy
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Workly India (Vishalbhai Muljibhai Gohil) believes in helping its customers as far as possible, and has therefore a liberal cancellation policy.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Last updated: {lastUpdated}
          </p>
        </div>

        {/* Policy Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-4 bg-gradient-to-br from-green-500/5 to-green-600/5 border border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <h3 className="font-semibold text-foreground">Liberal Policy</h3>
                <p className="text-xs text-muted-foreground">Customer-friendly approach</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-blue-500/5 to-blue-600/5 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-3">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <div>
                <h3 className="font-semibold text-foreground">30 Days</h3>
                <p className="text-xs text-muted-foreground">Reporting timeframe</p>
              </div>
            </div>
          </Card>
          
          <Card className="p-4 bg-gradient-to-br from-purple-500/5 to-purple-600/5 border border-purple-200 dark:border-purple-800">
            <div className="flex items-center space-x-3">
              <RefreshCw className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              <div>
                <h3 className="font-semibold text-foreground">9–15 working days</h3>
                <p className="text-xs text-muted-foreground">Refund processing</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Policy Content */}
        <div className="space-y-6">
          {/* Introduction */}
          <Card className="p-6 bg-gradient-to-br from-card to-muted/40 border border-border/50">
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                <strong>Workly India (Proprietorship of Vishalbhai Muljibhai Gohil)</strong> believes in helping its customers as far as possible, and has therefore a liberal cancellation policy. Under this policy:
              </p>
            </div>
          </Card>

          {/* Cancellation Conditions */}
          <Card className="p-6 bg-gradient-to-br from-card to-muted/40 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <XCircle className="w-5 h-5 mr-2 text-primary" />
              Cancellation Conditions
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                • Cancellations will be considered only if the request is made immediately after placing the order. However, the cancellation request may not be entertained if the orders have been communicated to the vendors/merchants and they have initiated the process of shipping them.
              </p>
              <p>
                • <strong>Workly India (Vishalbhai Muljibhai Gohil)</strong> does not accept cancellation requests for perishable items like flowers, eatables etc. However, refund/replacement can be made if the customer establishes that the quality of product delivered is not good.
              </p>
            </div>
          </Card>

          {/* Damaged or Defective Items */}
          <Card className="p-6 bg-gradient-to-br from-card to-muted/40 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <AlertCircle className="w-5 h-5 mr-2 text-primary" />
              Damaged or Defective Items
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                • In case of receipt of damaged or defective items please report the same to our Customer Service team. The request will, however, be entertained once the merchant has checked and determined the same at his own end. This should be reported within 30 days of receipt of the products.
              </p>
              <p>
                • In case you feel that the product received is not as shown on the site or as per your expectations, you must bring it to the notice of our customer service within 30 days of receiving the product. The Customer Service Team after looking into your complaint will take an appropriate decision.
              </p>
            </div>
          </Card>

          {/* Digital Services */}
          <Card className="p-6 bg-gradient-to-br from-card to-muted/40 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <DollarSign className="w-5 h-5 mr-2 text-primary" />
              Digital Services
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                • For digital services (such as job listing subscriptions), refunds will only be processed if the service has not been availed or activated after purchase.
              </p>
            </div>
          </Card>

           <Card className="p-6 bg-gradient-to-br from-card to-muted/40 border border-border/50">
             <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
               <Shield className="w-5 h-5 mr-2 text-primary" />
               ChatWork AI Plans
             </h2>
             <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
               <p>ChatWork AI plans are digital subscriptions. Once a paid plan is activated or its features are used, it is generally non-refundable.</p>
               <p>If a verified technical problem prevents activation or delivery, contact us promptly with the payment reference and registered email address. We will review the request and, when approved, return the amount to the original payment method within 9–15 working days.</p>
               <p>Payment gateway processing delays, bank timelines, taxes, and any deductions required by law may affect the final credit date.</p>
             </div>
           </Card>

          {/* Warranty Items */}
          <Card className="p-6 bg-gradient-to-br from-card to-muted/40 border border-border/50">
            <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-primary" />
              Warranty Items
            </h2>
            <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
              <p>
                • In case of complaints regarding products that come with a warranty from manufacturers, please refer the issue directly to them.
              </p>
            </div>
          </Card>

          {/* Refund Processing */}
          <Card className="p-6 bg-gradient-to-br from-card to-muted/40 border border-border/50">
  <h2 className="text-xl font-semibold text-foreground mb-4 flex items-center">
    <Clock className="w-5 h-5 mr-2 text-primary" />
    Refund Processing Timeline
  </h2>
  <div className="prose prose-sm max-w-none text-muted-foreground space-y-4">
    <p>
      • Subscriptions purchased for job postings or related services on our platform are
      generally <strong>non-refundable</strong> once activated.
    </p>
    <p>
      • A refund will only be issued in cases where the service could not be activated or
      delivered due to a verified <strong>technical issue</strong> from our side.
    </p>
    <p>
      • Any approved refund will be processed within <strong>9–15 working days</strong> to
      the original payment method, depending on your bank or payment provider.
    </p>
    <p>
      • Refunds are applicable only as per our published Terms & Conditions.
    </p>
  </div>
</Card>
          {/* Contact Information */}
          <Card className="p-6 bg-gradient-to-r from-primary/5 to-secondary/5 border border-border/50">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-6 h-6 text-primary shrink-0 mt-1" />
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-4">Customer Service Contact</h2>
                <div className="prose prose-sm max-w-none text-muted-foreground">
                  <p>
                    For cancellation requests or refund inquiries, please contact our Customer Service team:
                  </p>
                  <ul className="list-none space-y-1 mt-2">
                    <li>Email: <a href={`mailto:${contactInfo?.email || 'worklyindia@outlook.com'}`} className="text-primary hover:underline">{contactInfo?.email || 'worklyindia@outlook.com'}</a></li>
                    <li>Phone: <a href={`tel:${contactInfo?.phone || '+919904923067'}`} className="text-primary hover:underline">{contactInfo?.phone || '+91 9904923067'}</a></li>
                    <li>Address: {contactInfo?.address || 'Workly India (Vishalbhai Muljibhai Gohil), Sankhewsar, Patan, Gujarat, India - 384246'}</li>
                  </ul>
                  <div className="mt-4">
                    <Button variant="outline" size="sm">
                      Contact Customer Service
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

    </div>
  );
};

export default RefundPolicy;
