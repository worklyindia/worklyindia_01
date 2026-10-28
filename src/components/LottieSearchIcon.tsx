import Lottie from "lottie-react";
import searchAnimation from "@/assets/lottie/search.json";

interface LottieSearchIconProps {
  size?: number;
  className?: string;
}

const LottieSearchIcon = ({ size = 22, className }: LottieSearchIconProps) => (
  <div className={className} style={{ width: size, height: size }} aria-hidden>
    <Lottie animationData={searchAnimation} loop autoplay style={{ width: size, height: size }} />
  </div>
);

export default LottieSearchIcon;
