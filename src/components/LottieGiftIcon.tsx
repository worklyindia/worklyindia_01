import Lottie from "lottie-react";
import giftAnimation from "@/assets/lottie/gift.json";

interface LottieGiftIconProps {
  size?: number;
  className?: string;
}

const LottieGiftIcon = ({ size = 22, className }: LottieGiftIconProps) => (
  <div className={className} style={{ width: size, height: size }} aria-hidden>
    <Lottie animationData={giftAnimation} loop autoplay style={{ width: size, height: size }} />
  </div>
);

export default LottieGiftIcon;
