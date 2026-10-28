import React from 'react';

interface VerificationBadgeProps {
  color?: 'gold' | 'blue' | 'green' | 'silver';
  size?: number;
  className?: string;
}

const VerificationBadge: React.FC<VerificationBadgeProps> = ({ 
  color = 'gold', 
  size = 16,
  className = '' 
}) => {
  const gradientId = `${color}Gradient_${Math.random().toString(36).substr(2, 9)}`;
  const shadowId = `${color}Shadow_${Math.random().toString(36).substr(2, 9)}`;
  
  const goldColors = {
    start: "#FFD700",
    middle: "#FFC300", 
    end: "#FF8C00",
    stroke: "#B8860B"
  };
  
  const blueColors = {
    start: "#3B82F6",
    middle: "#2563EB",
    end: "#1D4ED8", 
    stroke: "#1E40AF"
  };
  
  const greenColors = {
    start: "#10B981",
    middle: "#059669",
    end: "#047857",
    stroke: "#065F46"
  };
  
  const silverColors = {
    start: "#E5E7EB",
    middle: "#D1D5DB",
    end: "#9CA3AF",
    stroke: "#6B7280"
  };
  
  const getColors = () => {
    switch (color) {
      case 'gold': return goldColors;
      case 'blue': return blueColors;
      case 'green': return greenColors;
      case 'silver': return silverColors;
      default: return goldColors;
    }
  };
  
  const colors = getColors();
  
  // Generate scalloped path
  const generateScallopedPath = () => {
    const centerX = 12;
    const centerY = 12;
    const outerRadius = 10;
    const innerRadius = 8.5;
    const scallops = 18;
    
    let path = '';
    
    for (let i = 0; i < scallops; i++) {
      const angle1 = (i * 2 * Math.PI) / scallops;
      const angle2 = ((i + 0.5) * 2 * Math.PI) / scallops;
      const angle3 = ((i + 1) * 2 * Math.PI) / scallops;
      
      // Outer point
      const x1 = centerX + outerRadius * Math.cos(angle1);
      const y1 = centerY + outerRadius * Math.sin(angle1);
      
      // Control point for the curve
      const controlX = centerX + innerRadius * Math.cos(angle2);
      const controlY = centerY + innerRadius * Math.sin(angle2);
      
      // Next outer point
      const x2 = centerX + outerRadius * Math.cos(angle3);
      const y2 = centerY + outerRadius * Math.sin(angle3);
      
      if (i === 0) {
        path += `M ${x1} ${y1}`;
      }
      
      // Create a quadratic curve for each scallop
      path += ` Q ${controlX} ${controlY} ${x2} ${y2}`;
    }
    
    path += ' Z';
    return path;
  };
  
  return (
    <div className={`inline-flex items-center ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 24 24" 
        fill="none"
        className={`${color}-badge drop-shadow-sm`}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={colors.start}/>
            <stop offset="50%" stopColor={colors.middle}/>
            <stop offset="100%" stopColor={colors.end}/>
          </linearGradient>
          <filter id={shadowId} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor={colors.stroke} floodOpacity="0.3"/>
          </filter>
        </defs>
        
        {/* Rotating border */}
        <g className="animate-spin-slow" style={{transformOrigin: '12px 12px'}}>
          <path 
            d={generateScallopedPath()}
            fill={`url(#${gradientId})`} 
            stroke={colors.stroke} 
            strokeWidth="1.5"
            filter={`url(#${shadowId})`}
          />
        </g>
        
        {/* Static checkmark */}
        <path 
          d="M8 12.5L11 15.5L16 9.5" 
          stroke="white" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
};

export default VerificationBadge;