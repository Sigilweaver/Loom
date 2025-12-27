import React from 'react';

interface SigilweaverIconProps extends Omit<React.SVGProps<SVGSVGElement>, 'ref'> {
  size?: number | string;
  absoluteStrokeWidth?: boolean;
}

export const SigilweaverIcon = React.forwardRef<SVGSVGElement, SigilweaverIconProps>(
  ({ 
    className = '', 
    style = {}, 
    size = 24, 
    color = 'currentColor', 
    strokeWidth = 2,
    absoluteStrokeWidth,
    ...rest 
  }, ref) => {
    const sizeValue = typeof size === 'number' ? `${size}px` : size;
    
    return (
      <svg 
        ref={ref}
        width={sizeValue} 
        height={sizeValue} 
        viewBox="0 0 32 32" 
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        style={style}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...rest}
      >
        <defs>
          <mask id="nodeClearance">
            <rect width="32" height="32" fill="white"/>
            <circle cx="3" cy="10" r="2.3" fill="black"/>
            <circle cx="3" cy="22" r="2.3" fill="black"/>
            <circle cx="16" cy="16" r="3.4" fill="black"/>
            <circle cx="29" cy="6" r="2.3" fill="black"/>
            <circle cx="29" cy="16" r="2.3" fill="black"/>
            <circle cx="29" cy="26" r="2.3" fill="black"/>
          </mask>
        </defs>
        
        <g mask="url(#nodeClearance)">
          <path d="M5 10 L7 10 C10 10, 10 16, 14 16" strokeWidth="1.5" fill="none"/>
          <path d="M5 22 L7 22 C10 22, 10 16, 14 16" strokeWidth="1.5" fill="none"/>
          <path d="M18 16 C22 16, 22 6, 25 6 L27 6" strokeWidth="1.5" fill="none"/>
          <path d="M18 16 L27 16" strokeWidth="1.5" fill="none"/>
          <path d="M18 16 C22 16, 22 26, 25 26 L27 26" strokeWidth="1.5" fill="none"/>
        </g>
        
        <circle cx="3" cy="10" r="2" fill={color}/>
        <circle cx="3" cy="22" r="2" fill={color}/>
        <circle cx="16" cy="16" r="3" fill={color}/>
        <circle cx="29" cy="6" r="2" fill={color}/>
        <circle cx="29" cy="16" r="2" fill={color}/>
        <circle cx="29" cy="26" r="2" fill={color}/>
      </svg>
    );
  }
);

SigilweaverIcon.displayName = 'SigilweaverIcon';
