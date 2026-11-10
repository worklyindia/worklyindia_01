import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

interface WhatsAppButtonProps {
  message?: string;
  className?: string;
  variant?: "floating" | "inline";
}

const WhatsAppButton = ({ 
  message = "Hi! I'm interested in Workly India opportunities on Workly India.", 
  className = "",
  variant = "inline"
}: WhatsAppButtonProps) => {
  const phoneNumber = "919904923067"; // Without + and spaces for WhatsApp URL
  
  const handleWhatsAppClick = () => {
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  if (variant === "floating") {
    return (
      <Button
        onClick={handleWhatsAppClick}
        className={`fixed bottom-20 right-4 md:bottom-6 md:right-6 bg-green-500 hover:bg-green-600 text-white w-14 h-14 rounded-full shadow-large hover:shadow-glow transition-smooth z-40 flex items-center justify-center ${className}`}
        size="icon"
        aria-label="Contact us on WhatsApp"
      >
        <MessageCircle className="w-6 h-6" />
      </Button>
    );
  }

  return (
    <Button
      onClick={handleWhatsAppClick}
      variant="outline"
      className={`bg-green-50 hover:bg-green-100 border-green-200 text-green-700 hover:text-green-800 ${className}`}
    >
      <MessageCircle className="w-4 h-4 mr-2" />
      WhatsApp Us
    </Button>
  );
};

export default WhatsAppButton;