import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Mail, Send, Settings, Upload, X } from 'lucide-react';

const EmailManagement = () => {
  const [emailConfig, setEmailConfig] = useState({
    service: 'emailjs',
    publicKey: '',
    serviceId: '',
    templateId: '',
    fromName: '',
    fromEmail: ''
  });

  const [emailForm, setEmailForm] = useState({
    to: '',
    subject: '',
    message: '',
    attachments: [] as File[]
  });

  const [isConfigured, setIsConfigured] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const handleConfigSave = () => {
    if (emailConfig.publicKey && emailConfig.serviceId && emailConfig.templateId) {
      setIsConfigured(true);
      toast.success('Email configuration saved successfully!');
      
      // Store config in localStorage for persistence
      localStorage.setItem('emailConfig', JSON.stringify(emailConfig));
    } else {
      toast.error('Please fill all required configuration fields');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setEmailForm(prev => ({
        ...prev,
        attachments: [...prev.attachments, ...newFiles]
      }));
    }
  };

  const removeAttachment = (index: number) => {
    setEmailForm(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== index)
    }));
  };

  const sendEmail = async () => {
    if (!emailForm.to || !emailForm.subject || !emailForm.message) {
      toast.error('Please fill all required fields');
      return;
    }

    setIsSending(true);
    
    try {
      // EmailJS integration (requires EmailJS library to be loaded)
      if (window.emailjs && isConfigured) {
        const templateParams = {
          to_email: emailForm.to,
          subject: emailForm.subject,
          message: emailForm.message,
          from_name: emailConfig.fromName,
          from_email: emailConfig.fromEmail
        };

        await window.emailjs.send(
          emailConfig.serviceId,
          emailConfig.templateId,
          templateParams,
          emailConfig.publicKey
        );

        toast.success('Email sent successfully!');
        setEmailForm({ to: '', subject: '', message: '', attachments: [] });
      } else {
        // Fallback: Create mailto link
        const mailtoLink = `mailto:${emailForm.to}?subject=${encodeURIComponent(emailForm.subject)}&body=${encodeURIComponent(emailForm.message)}`;
        window.open(mailtoLink);
        toast.success('Email client opened. Please send the email manually.');
      }
    } catch (error) {
      console.error('Email sending failed:', error);
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  // Load saved config on component mount
  React.useEffect(() => {
    const savedConfig = localStorage.getItem('emailConfig');
    if (savedConfig) {
      const config = JSON.parse(savedConfig);
      setEmailConfig(config);
      if (config.publicKey && config.serviceId && config.templateId) {
        setIsConfigured(true);
      }
    }
  }, []);

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Mail className="h-8 w-8 text-primary" />
          Email Management
        </h1>
        <p className="text-muted-foreground mt-2">
          Configure and send emails without server dependencies
        </p>
      </div>

      <Tabs defaultValue="setup" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="setup" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Setup
          </TabsTrigger>
          <TabsTrigger value="compose" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Compose
          </TabsTrigger>
        </TabsList>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle>Email Service Configuration</CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure EmailJS for client-side email sending. 
                <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline ml-1">
                  Get free EmailJS account
                </a>
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="publicKey">Public Key *</Label>
                  <Input
                    id="publicKey"
                    value={emailConfig.publicKey}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, publicKey: e.target.value }))}
                    placeholder="Your EmailJS public key"
                  />
                </div>
                <div>
                  <Label htmlFor="serviceId">Service ID *</Label>
                  <Input
                    id="serviceId"
                    value={emailConfig.serviceId}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, serviceId: e.target.value }))}
                    placeholder="Your EmailJS service ID"
                  />
                </div>
                <div>
                  <Label htmlFor="templateId">Template ID *</Label>
                  <Input
                    id="templateId"
                    value={emailConfig.templateId}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, templateId: e.target.value }))}
                    placeholder="Your EmailJS template ID"
                  />
                </div>
                <div>
                  <Label htmlFor="fromName">From Name</Label>
                  <Input
                    id="fromName"
                    value={emailConfig.fromName}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, fromName: e.target.value }))}
                    placeholder="Your name or company"
                  />
                </div>
                <div>
                  <Label htmlFor="fromEmail">From Email</Label>
                  <Input
                    id="fromEmail"
                    type="email"
                    value={emailConfig.fromEmail}
                    onChange={(e) => setEmailConfig(prev => ({ ...prev, fromEmail: e.target.value }))}
                    placeholder="your-email@domain.com"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <div className="flex items-center gap-2">
                  {isConfigured && (
                    <div className="flex items-center gap-2 text-green-600">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span className="text-sm">Configured</span>
                    </div>
                  )}
                </div>
                <Button onClick={handleConfigSave}>
                  Save Configuration
                </Button>
              </div>

              <div className="mt-6 p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Setup Instructions:</h4>
                <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
                  <li>Create a free account at <a href="https://www.emailjs.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">EmailJS.com</a></li>
                  <li>Add an email service (Gmail, Outlook, etc.)</li>
                  <li>Create an email template</li>
                  <li>Copy the Public Key, Service ID, and Template ID here</li>
                  <li>Add this script to your HTML: <code className="bg-background px-1 rounded">&lt;script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js"&gt;&lt;/script&gt;</code></li>
                </ol>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compose">
          <Card>
            <CardHeader>
              <CardTitle>Compose Email</CardTitle>
              {!isConfigured && (
                <p className="text-sm text-amber-600">
                  ⚠️ Email service not configured. Please configure EmailJS in the Setup tab first.
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="to">To *</Label>
                <Input
                  id="to"
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  placeholder="recipient@example.com"
                />
              </div>

              <div>
                <Label htmlFor="subject">Subject *</Label>
                <Input
                  id="subject"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  placeholder="Email subject"
                />
              </div>

              <div>
                <Label htmlFor="message">Message *</Label>
                <Textarea
                  id="message"
                  value={emailForm.message}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                  placeholder="Write your message here..."
                  className="min-h-[150px]"
                />
              </div>

              <div>
                <Label htmlFor="attachments">Attachments</Label>
                <div className="space-y-2">
                  <Input
                    id="attachments"
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="cursor-pointer"
                  />
                  {emailForm.attachments.length > 0 && (
                    <div className="space-y-2">
                      {emailForm.attachments.map((file, index) => (
                        <div key={index} className="flex items-center justify-between bg-muted p-2 rounded">
                          <span className="text-sm flex items-center gap-2">
                            <Upload className="h-4 w-4" />
                            {file.name} ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeAttachment(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end">
                <Button 
                  onClick={sendEmail} 
                  disabled={isSending}
                  className="flex items-center gap-2"
                >
                  <Send className="h-4 w-4" />
                  {isSending ? 'Sending...' : 'Send Email'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Add EmailJS type declaration
declare global {
  interface Window {
    emailjs: any;
  }
}

export default EmailManagement;