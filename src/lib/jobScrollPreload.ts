/** Keep several screens of jobs ahead without downloading the entire feed. */
export function jobPreloadDistance(viewportHeight: number, threshold = 300, speed = 0): number {
  return Math.max(threshold, Math.min(8000, Math.max(2400, viewportHeight * 4, speed * 2500)));
}

export function shouldLoadJobPage(scrollTop: number, viewportHeight: number, scrollHeight: number, distance: number): boolean {
  return scrollTop + viewportHeight >= scrollHeight - distance;
}