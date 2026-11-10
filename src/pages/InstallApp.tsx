import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Download, 
  Smartphone, 
  Zap, 
  Wifi, 
  Bell, 
  CheckCircle2,
  Share2,
  MoreVertical,
  Plus,
  ArrowLeft
} from 'lucide-react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function InstallApp() {
  const { isInstallable, isInstalled, platform, promptInstall, canShowPrompt } = useInstallPrompt();
  const [installing, setInstalling] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If already installed, redirect to home
    if (isInstalled) {
      setTimeout(() => navigate('/'), 2000);
    }
  }, [isInstalled, navigate]);

  const handleInstall = async () => {
    if (canShowPrompt) {
      setInstalling(true);
      await promptInstall();
      setInstalling(false);
    }
  };

  if (isInstalled) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-primary/5">
        <Card className="max-w-md w-full p-8 text-center">
          <div className="mb-6">
            <div className="mx-auto w-20 h-20 rounded-full bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold mb-2">App Installed Successfully!</h1>
          <p className="text-muted-foreground mb-6">
            Workly India app is now installed on your device
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5">
      {/* Header */}
      <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="mb-6 inline-flex items-center justify-center p-4 rounded-2xl bg-primary/10">
            <Smartphone className="h-12 w-12 text-primary" />
          </div>
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Install Workly India App
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Get the best remote job search experience. Install our app for faster access and offline support.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <Card className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Zap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Lightning Fast</h3>
            <p className="text-sm text-muted-foreground">Instant loading</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Wifi className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Works Offline</h3>
            <p className="text-sm text-muted-foreground">No internet? No problem</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Bell className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Push Notifications</h3>
            <p className="text-sm text-muted-foreground">Never miss a job</p>
          </Card>
          <Card className="p-6 text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <h3 className="font-semibold mb-1">Native Feel</h3>
            <p className="text-sm text-muted-foreground">App-like experience</p>
          </Card>
        </div>

        {/* Install Button for Android/Desktop */}
        {canShowPrompt && platform !== 'ios' && (
          <Card className="p-8 mb-8 text-center bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <h2 className="text-2xl font-bold mb-4">Ready to Install</h2>
            <p className="text-muted-foreground mb-6">
              Click the button below to install Workly India on your device
            </p>
            <Button 
              onClick={handleInstall}
              size="lg"
              disabled={installing}
              className="text-lg px-8"
            >
              <Download className="h-5 w-5 mr-2" />
              {installing ? 'Installing...' : 'Install Now'}
            </Button>
          </Card>
        )}

        {/* Platform-specific Instructions */}
        <div className="space-y-6">
          {/* Android Instructions */}
          {(platform === 'android' || platform === 'unknown') && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-green-500" />
                </div>
                <h2 className="text-xl font-bold">Android Installation</h2>
              </div>
              <ol className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</span>
                  <span>Tap the <MoreVertical className="inline h-4 w-4 mx-1" /> menu icon in your browser</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</span>
                  <span>Select "Add to Home screen" or "Install app"</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</span>
                  <span>Tap "Install" when prompted</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</span>
                  <span>App icon will appear on your home screen</span>
                </li>
              </ol>
            </Card>
          )}

          {/* iOS Instructions */}
          {(platform === 'ios' || platform === 'unknown') && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                  <Smartphone className="h-5 w-5 text-blue-500" />
                </div>
                <h2 className="text-xl font-bold">iPhone/iPad Installation</h2>
              </div>
              <ol className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</span>
                  <span>Open this page in Safari browser (required for iOS)</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</span>
                  <span>Tap the <Share2 className="inline h-4 w-4 mx-1" /> Share button at the bottom</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</span>
                  <span>Scroll and tap "Add to Home Screen" <Plus className="inline h-4 w-4 mx-1" /></span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</span>
                  <span>Tap "Add" in the top right corner</span>
                </li>
              </ol>
            </Card>
          )}

          {/* Desktop Instructions */}
          {(platform === 'desktop' || platform === 'unknown') && (
            <Card className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center">
                  <Download className="h-5 w-5 text-purple-500" />
                </div>
                <h2 className="text-xl font-bold">Desktop Installation</h2>
              </div>
              <ol className="space-y-3 text-muted-foreground">
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">1</span>
                  <span>Look for the <Download className="inline h-4 w-4 mx-1" /> install icon in your browser's address bar</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">2</span>
                  <span>Click the install button</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">3</span>
                  <span>Confirm installation when prompted</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">4</span>
                  <span>App will open in a new window</span>
                </li>
              </ol>
            </Card>
          )}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <p className="text-sm text-muted-foreground mb-4">
            Need help? Contact us at worklyindia@outlook.com
          </p>
          <Button variant="outline" onClick={() => navigate('/')}>
            Continue to Website
          </Button>
        </div>
      </div>
    </div>
  );
}
