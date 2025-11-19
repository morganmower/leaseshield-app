import { Shield, Home } from "lucide-react";

interface LogoProps {
  className?: string;
  iconSize?: number;
}

export function Logo({ className = "", iconSize = 24 }: LogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: iconSize * 1.5, height: iconSize }}>
      {/* House icon in the background */}
      <Home 
        className="absolute text-primary/40" 
        style={{ 
          width: iconSize * 0.85, 
          height: iconSize * 0.85,
          left: '0%',
          top: '10%'
        }} 
      />
      {/* Shield icon overlapping in front */}
      <Shield 
        className="absolute text-primary" 
        style={{ 
          width: iconSize * 0.85, 
          height: iconSize * 0.85,
          right: '0%',
          top: '10%',
          filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))'
        }} 
      />
    </div>
  );
}
