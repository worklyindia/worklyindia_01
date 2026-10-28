import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge, Plus, X, Award, ExternalLink } from 'lucide-react';

interface Certification {
  id?: string;
  certification_name: string;
  issuing_organization: string;
  issue_date: string;
  expiry_date: string;
  credential_id: string;
  credential_url: string;
  description: string;
}

interface MultipleCertificationsInputProps {
  certifications: Certification[];
  onChange: (certifications: Certification[]) => void;
}

const MultipleCertificationsInput: React.FC<MultipleCertificationsInputProps> = ({
  certifications,
  onChange
}) => {
  const addCertification = () => {
    const newCertification: Certification = {
      certification_name: '',
      issuing_organization: '',
      issue_date: '',
      expiry_date: '',
      credential_id: '',
      credential_url: '',
      description: ''
    };
    onChange([...certifications, newCertification]);
  };

  const removeCertification = (index: number) => {
    const updatedCertifications = certifications.filter((_, i) => i !== index);
    onChange(updatedCertifications);
  };

  const updateCertification = (index: number, field: keyof Certification, value: string) => {
    const updatedCertifications = certifications.map((cert, i) => 
      i === index ? { ...cert, [field]: value } : cert
    );
    onChange(updatedCertifications);
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <Award className="mx-auto w-12 h-12 text-primary mb-2" />
        <h3 className="text-lg font-semibold">Certifications</h3>
        <p className="text-muted-foreground">Add your professional certifications</p>
      </div>

      {certifications.map((certification, index) => (
        <Card key={index} className="relative">
          <CardContent className="pt-6">
            {certifications.length > 1 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute top-2 right-2 h-8 w-8 p-0"
                onClick={() => removeCertification(index)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Certification Name *</Label>
                  <Input
                    value={certification.certification_name}
                    onChange={(e) => updateCertification(index, 'certification_name', e.target.value)}
                    placeholder="e.g., AWS Certified Solutions Architect"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Issuing Organization *</Label>
                  <Input
                    value={certification.issuing_organization}
                    onChange={(e) => updateCertification(index, 'issuing_organization', e.target.value)}
                    placeholder="e.g., Amazon Web Services"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Issue Date</Label>
                  <Input
                    type="date"
                    value={certification.issue_date}
                    onChange={(e) => updateCertification(index, 'issue_date', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Expiry Date</Label>
                  <Input
                    type="date"
                    value={certification.expiry_date}
                    onChange={(e) => updateCertification(index, 'expiry_date', e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Credential ID</Label>
                  <Input
                    value={certification.credential_id}
                    onChange={(e) => updateCertification(index, 'credential_id', e.target.value)}
                    placeholder="e.g., ABC123456"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Credential URL</Label>
                  <Input
                    type="url"
                    value={certification.credential_url}
                    onChange={(e) => updateCertification(index, 'credential_url', e.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={certification.description}
                  onChange={(e) => updateCertification(index, 'description', e.target.value)}
                  placeholder="Brief description of the certification and skills gained..."
                  rows={3}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addCertification}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-2" />
        Add Certification
      </Button>
    </div>
  );
};

export default MultipleCertificationsInput;