import Lottie from "lottie-react";

interface LottieIconProps {
  animationData: unknown;
  size?: number;
  loop?: boolean;
  className?: string;
}

const LottieIcon = ({ animationData, size = 28, loop = true, className }: LottieIconProps) => {
  return (
    <Lottie
      animationData={animationData as object}
      loop={loop}
      autoplay
      style={{ width: size, height: size }}
      className={className}
    />
  );
};

export default LottieIcon;
