import Lottie from "lottie-react";
import cameraAnimation from "@/assets/lottie/camera.json";

interface LottieCameraIconProps {
  size?: number;
  className?: string;
}

const LottieCameraIcon = ({ size = 22, className }: LottieCameraIconProps) => (
  <div className={className} style={{ width: size, height: size }} aria-hidden>
    <Lottie animationData={cameraAnimation} loop autoplay style={{ width: size, height: size }} />
  </div>
);

export default LottieCameraIcon;
