export function AnimatedJobBackground() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
      <svg
        className="absolute inset-0 w-full h-full"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="line-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(210 80% 60%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(210 80% 60%)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="hsl(210 80% 60%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="line-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(270 60% 55%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(270 60% 55%)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="hsl(270 60% 55%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="line-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(180 60% 50%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(180 60% 50%)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(180 60% 50%)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="line-grad-4" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(230 70% 60%)" stopOpacity="0" />
            <stop offset="50%" stopColor="hsl(230 70% 60%)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(230 70% 60%)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Line set 1 - horizontal flowing */}
        <path d="M-100,120 Q200,80 400,130 T800,100 T1200,140 T1600,90 T2000,120" fill="none" stroke="url(#line-grad-1)" strokeWidth="1.5" className="animate-line-flow-1" />
        <path d="M-100,180 Q250,150 500,190 T900,160 T1300,200 T1700,150 T2000,180" fill="none" stroke="url(#line-grad-2)" strokeWidth="1" className="animate-line-flow-2" />
        <path d="M-100,260 Q300,230 550,270 T950,240 T1400,280 T1800,230 T2000,260" fill="none" stroke="url(#line-grad-3)" strokeWidth="1.2" className="animate-line-flow-3" />

        {/* Line set 2 - diagonal flowing */}
        <path d="M-50,350 Q200,310 450,360 T850,320 T1250,370 T1650,310 T2000,350" fill="none" stroke="url(#line-grad-4)" strokeWidth="1" className="animate-line-flow-4" />
        <path d="M-100,440 Q250,400 500,450 T900,410 T1350,460 T1750,400 T2000,440" fill="none" stroke="url(#line-grad-1)" strokeWidth="0.8" className="animate-line-flow-5" />
        <path d="M-100,530 Q200,490 450,540 T850,500 T1300,550 T1700,490 T2000,530" fill="none" stroke="url(#line-grad-2)" strokeWidth="1.3" className="animate-line-flow-6" />

        {/* Line set 3 - lower section */}
        <path d="M-50,620 Q300,580 550,630 T950,590 T1400,640 T1800,580 T2000,620" fill="none" stroke="url(#line-grad-3)" strokeWidth="1" className="animate-line-flow-7" />
        <path d="M-100,710 Q250,670 500,720 T900,680 T1350,730 T1750,670 T2000,710" fill="none" stroke="url(#line-grad-4)" strokeWidth="0.8" className="animate-line-flow-8" />
        <path d="M-50,800 Q200,760 450,810 T850,770 T1300,820 T1700,760 T2000,800" fill="none" stroke="url(#line-grad-1)" strokeWidth="1.1" className="animate-line-flow-1" />
      </svg>
    </div>
  );
}
