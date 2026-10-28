import { ArrowLeft, Phone, Mail, Clock, MessageCircle, Shield, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import VerificationBadge from '@/components/VerificationBadge';
import { useContactInfo } from '@/hooks/useContactInfo';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useAIChatSettings } from '@/hooks/useAIChatSettings';
import { SafeImg } from '@/components/ui/safe-image';

interface AISupportProfileProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AISupportProfile({ open, onOpenChange }: AISupportProfileProps) {
  const { data: contactInfo, isLoading } = useContactInfo('support');
  const { data: chatSettings } = useAIChatSettings();
  
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-white animate-in slide-in-from-right duration-300"
    >
      {/* WhatsApp-Style Header - Sticky */}
      <div className="sticky top-0 z-10 bg-[#075E54] px-4 py-3 flex items-center gap-4 shadow-md">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="text-white hover:bg-white/10 h-10 w-10 -ml-2"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h2 className="text-white text-lg font-medium">Contact Info</h2>
      </div>

      {/* Profile Content - Full Screen Scrollable */}
      <div className="h-[calc(100vh-58px)] overflow-y-auto">
        {/* Profile Picture Section */}
        <div className="bg-[#075E54] px-6 pb-8 pt-6 flex flex-col items-center">
          <div className="relative">
            <SafeImg
              loading="lazy"
              decoding="async"
              src={chatSettings.avatar_url}
              alt={chatSettings.name}
              className="w-52 h-52 rounded-full object-cover border-4 border-white shadow-lg bg-muted"
            />
            {chatSettings.verification_enabled && (
              <div className="absolute bottom-2 right-2 shadow-lg">
                <VerificationBadge color={chatSettings.verification_color} size={32} />
              </div>
            )}
          </div>
        </div>

        {/* Name Section */}
        <div className="bg-white px-6 py-5 border-b border-gray-200">
          <h3 className="text-2xl font-semibold text-gray-900 text-center">{chatSettings.name}</h3>
          <p className="text-sm text-gray-500 text-center mt-1">{chatSettings.tagline}</p>
        </div>

        {/* About Section */}
        <div className="bg-white px-6 py-5 border-b border-gray-200">
          <p className="text-xs text-gray-500 mb-2 flex items-center gap-2 uppercase tracking-wider">
            <MessageCircle className="w-4 h-4" />
            About
          </p>
          <p className="text-sm text-gray-900 leading-relaxed">
            🤖 Your 24/7 AI-powered career companion for Workly India platform.
            I can help you with job search, career advice, interview preparation, and more!
          </p>
        </div>

        {/* Capabilities Section */}
        <div className="bg-white px-6 py-5 border-b border-gray-200">
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <Award className="w-4 h-4" />
            What I Can Do
          </p>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#25D366] mt-2 flex-shrink-0" />
              <p className="text-sm text-gray-900">Find remote job opportunities across India</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#25D366] mt-2 flex-shrink-0" />
              <p className="text-sm text-gray-900">Provide personalized career guidance</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#25D366] mt-2 flex-shrink-0" />
              <p className="text-sm text-gray-900">Help with resume and interview tips</p>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#25D366] mt-2 flex-shrink-0" />
              <p className="text-sm text-gray-900">Answer questions about Workly India platform</p>
            </div>
          </div>
        </div>

        {/* Availability Section */}
        <div className="bg-white px-6 py-5 border-b border-gray-200">
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <Clock className="w-4 h-4" />
            Availability
          </p>
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-[#25D366] animate-pulse flex-shrink-0" />
            <p className="text-sm text-gray-900 font-medium">Always Online - 24/7 Support</p>
          </div>
          <p className="text-xs text-gray-500 mt-2 ml-6">
            I'm here to help you anytime, anywhere!
          </p>
        </div>

        {/* Contact Options */}
        <div className="bg-white px-6 py-5 border-b border-gray-200">
          <p className="text-xs text-gray-500 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <Phone className="w-4 h-4" />
            Quick Actions
          </p>
          <div className="space-y-3">
            <button 
              onClick={() => onOpenChange(false)}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors active:bg-gray-100"
            >
              <div className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center flex-shrink-0">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">Start Chat</p>
                <p className="text-xs text-gray-500">Begin conversation now</p>
              </div>
            </button>
            
            <a 
              href={`mailto:${contactInfo?.email || 'worklyindia@outlook.com'}`}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors active:bg-gray-100"
            >
              <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">Email Support</p>
                <p className="text-xs text-gray-500">
                  {isLoading ? <LoadingSpinner size="sm" /> : (contactInfo?.email || 'worklyindia@outlook.com')}
                </p>
              </div>
            </a>

            <a 
              href={`tel:${contactInfo?.phone || '+919904923067'}`}
              className="w-full flex items-center gap-4 p-4 rounded-xl hover:bg-gray-50 transition-colors active:bg-gray-100"
            >
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                <Phone className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">Call Support</p>
                <p className="text-xs text-gray-500">
                  {isLoading ? <LoadingSpinner size="sm" /> : (contactInfo?.phone || '+91 9904923067')}
                </p>
              </div>
            </a>
          </div>
        </div>

        {/* Security Badge */}
        <div className="bg-gray-50 px-6 py-6">
          <div className="flex items-center gap-3 justify-center">
            <Shield className="w-5 h-5 text-[#075E54]" />
            <p className="text-xs text-gray-600">
              Verified Official AI Assistant • Powered by Advanced AI
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
