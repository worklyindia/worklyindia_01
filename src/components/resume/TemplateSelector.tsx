import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TemplateType } from './ResumeTemplates';
import { Eye, Palette, Minimize, Briefcase } from 'lucide-react';

interface TemplateSelectorProps {
  selectedTemplate: TemplateType;
  onTemplateChange: (template: TemplateType) => void;
  className?: string;
}

const TemplateSelector: React.FC<TemplateSelectorProps> = ({
  selectedTemplate,
  onTemplateChange,
  className = ""
}) => {
  const templates = [
    {
      id: 'professional' as TemplateType,
      name: 'Professional',
      description: 'Clean corporate design with Workly India branding',
      icon: Briefcase,
      color: 'bg-gradient-primary',
      preview: 'https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/template-professional-preview.png',
      features: ['Corporate Design', 'Timeline Layout', 'Brand Colors', 'Professional Icons']
    },
    {
      id: 'creative' as TemplateType,
      name: 'Creative',
      description: 'Modern colorful design with gradient elements',
      icon: Palette,
      color: 'bg-gradient-hero',
      preview: 'https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/template-creative-preview.png',
      features: ['Rainbow Gradients', 'Creative Layout', 'Visual Progress', 'Modern Typography']
    },
    {
      id: 'minimalist' as TemplateType,
      name: 'Minimalist',
      description: 'Clean and simple design focusing on content',
      icon: Minimize,
      color: 'bg-gradient-card',
      preview: 'https://jubwzelupbntbetpajqb.supabase.co/storage/v1/object/public/brand-assets/site/template-minimalist-preview.png',
      features: ['Clean Lines', 'Typography Focus', 'Simple Layout', 'Elegant Design']
    }
  ];

  return (
    <div className={`space-y-4 ${className}`}>
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <Eye className="w-5 h-5 text-primary" />
        Choose Template
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {templates.map((template) => {
          const IconComponent = template.icon;
          const isSelected = selectedTemplate === template.id;
          
          return (
            <Card 
              key={template.id}
              className={`relative cursor-pointer transition-all duration-300 hover:shadow-soft ${
                isSelected 
                  ? 'ring-2 ring-primary shadow-glow scale-[1.02]' 
                  : 'hover:scale-[1.01]'
              }`}
              onClick={() => onTemplateChange(template.id)}
            >
              {/* Template Preview */}
              <div className={`h-32 rounded-t-lg ${template.color} flex items-center justify-center relative overflow-hidden`}>
                <div className="absolute inset-0 bg-white/10 backdrop-blur-sm"></div>
                <IconComponent className="w-12 h-12 text-white relative z-10" />
                {isSelected && (
                  <Badge className="absolute top-2 right-2 bg-white/20 text-white border-white/30">
                    Selected
                  </Badge>
                )}
              </div>
              
              {/* Template Info */}
              <div className="p-4">
                <h4 className="font-semibold text-foreground mb-1">{template.name}</h4>
                <p className="text-sm text-muted-foreground mb-3">{template.description}</p>
                
                {/* Features */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Features:</p>
                  <div className="flex flex-wrap gap-1">
                    {template.features.slice(0, 2).map((feature, index) => (
                      <Badge key={index} variant="outline" className="text-xs">
                        {feature}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                {/* Action Button */}
                <Button
                  size="sm"
                  className={`w-full mt-3 transition-smooth ${
                    isSelected 
                      ? 'bg-primary hover:bg-primary/90' 
                      : 'bg-muted hover:bg-muted/80'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onTemplateChange(template.id);
                  }}
                >
                  {isSelected ? 'Using Template' : 'Use Template'}
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
      
      {/* Template Info */}
      <div className="bg-muted/30 rounded-lg p-4 border border-border">
        <h4 className="font-medium text-foreground mb-2">Template Features:</h4>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Professional Workly India branding and colors</li>
          <li>• High-quality PDF generation</li>
          <li>• Mobile responsive preview</li>
          <li>• ATS-friendly format</li>
        </ul>
      </div>
    </div>
  );
};

export default TemplateSelector;