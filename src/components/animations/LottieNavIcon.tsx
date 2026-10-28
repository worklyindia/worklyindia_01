import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";

interface LottieNavIconProps {
  animationData: unknown;
  isActive: boolean;
  size?: number;
}

/**
 * Lottie-powered bottom nav icon.
 * - Plays animation once on mount so the icon settles at its final drawn state
 *   (many of these animations trim-in from empty, so frame 0 shows nothing).
 * - Replays whenever the tab becomes active.
 */
export const LottieNavIcon = ({ animationData, isActive, size = 22 }: LottieNavIconProps) => {
  const ref = useRef<LottieRefCurrentProps>(null);
  const wasActive = useRef(false);
  const didInitialPlay = useRef(false);

  // Initial play so we land on the final frame instead of an empty frame 0.
  useEffect(() => {
    const lottie = ref.current;
    if (!lottie || didInitialPlay.current) return;
    didInitialPlay.current = true;
    lottie.stop();
    lottie.play();
  }, []);

  useEffect(() => {
    const lottie = ref.current;
    if (!lottie) return;
    if (isActive && !wasActive.current) {
      lottie.stop();
      lottie.play();
    }
    wasActive.current = isActive;
  }, [isActive]);

  return (
    <Lottie
      lottieRef={ref}
      animationData={animationData}
      loop={true}
      autoplay={true}
      style={{ width: size, height: size }}
    />
  );
};

export default LottieNavIcon;
