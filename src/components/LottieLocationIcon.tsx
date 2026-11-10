import Lottie from "lottie-react";
import locationAnimation from "@/assets/lottie/location.json";

interface LottieLocationIconProps {
  size?: number;
  className?: string;
}

const LottieLocationIcon = ({ size = 22, className }: LottieLocationIconProps) => (
  <div className={className} style={{ width: size, height: size }} aria-hidden>
    <Lottie animationData={locationAnimation} loop autoplay style={{ width: size, height: size }} />
  </div>
);

export default LottieLocationIcon;
