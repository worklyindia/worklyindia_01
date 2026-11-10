
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Eye, Database, ExternalLink } from 'lucide-react';
import LocationPrivacySettings from './LocationPrivacySettings';

const PrivacySection = () => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Privacy & Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-blue-500 mt-1" />
              <div>
                <h4 className="font-medium">What We Track</h4>
                <p className="text-sm text-muted-foreground">
                  Basic analytics, job preferences, and optional location
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <Database className="w-5 h-5 text-green-500 mt-1" />
              <div>
                <h4 className="font-medium">Data Storage</h4>
                <p className="text-sm text-muted-foreground">
                  Encrypted, secure servers with regular backups
                </p>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <ExternalLink className="w-5 h-5 text-purple-500 mt-1" />
              <div>
                <h4 className="font-medium">Third Parties</h4>
                <p className="text-sm text-muted-foreground">
                  Analytics only, no personal data sharing
                </p>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <h4 className="font-medium mb-2">External Services We Use:</h4>
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Google Analytics:</strong> Website usage patterns (anonymized)</p>
              <p><strong>Microsoft Clarity:</strong> User experience insights (anonymized)</p>
              <p><strong>geojs.io:</strong> IP-based location detection</p>
              <p><strong>OpenStreetMap:</strong> Address lookup services</p>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <LocationPrivacySettings />
    </div>
  );
};

export default PrivacySection;
