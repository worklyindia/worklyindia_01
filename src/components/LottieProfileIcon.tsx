import Lottie from "lottie-react";
import searchAnimation from "@/assets/lottie/search.json";

interface LottieProfileIconProps {
  size?: number;
  className?: string;
  onClick?: () => void;
}

const LottieProfileIcon = ({ size = 40, className, onClick }: LottieProfileIconProps) => (
  <div
    className={className}
    style={{ width: size, height: size }}
    onClick={onClick}
    aria-hidden
  >
    <Lottie
      animationData={searchAnimation}
      loop
      autoplay
      style={{ width: size, height: size }}
    />
  </div>
);

export default LottieProfileIcon;
