import { Shield, Home } from "lucide-react";

interface LogoProps {
  className?: string;
  iconSize?: number;
}

export function Logo({ className = "", iconSize = 24 }: LogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: iconSize * 1.6, height: iconSize * 1.1 }}>
      {/* Glow effect background */}
      <div 
        className="absolute rounded-full blur-md opacity-40"
        style={{
          width: iconSize * 1.3,
          height: iconSize * 1.3,
          left: '15%',
          top: '-10%',
          background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
        }}
      />
      
      {/* House icon with gradient */}
      <Home 
        className="absolute" 
        style={{ 
          width: iconSize * 0.9, 
          height: iconSize * 0.9,
          left: '0%',
          top: '8%',
          stroke: 'url(#houseGradient)',
          strokeWidth: 2,
          fill: 'none',
          filter: 'drop-shadow(0 2px 4px rgb(0 0 0 / 0.15))'
        }} 
      />
      
      {/* Shield icon with vibrant gradient */}
      <Shield 
        className="absolute" 
        style={{ 
          width: iconSize * 0.95, 
          height: iconSize * 0.95,
          right: '0%',
          top: '5%',
          stroke: 'url(#shieldGradient)',
          strokeWidth: 2.5,
          fill: 'url(#shieldFill)',
          filter: 'drop-shadow(0 3px 6px rgb(0 0 0 / 0.2))'
        }} 
      />
      
      {/* SVG Gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {/* House gradient - amber/orange tones */}
          <linearGradient id="houseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.4 }} />
          </linearGradient>
          
          {/* Shield gradient - vibrant primary */}
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.8)', stopOpacity: 1 }} />
          </linearGradient>
          
          {/* Shield fill with subtle gradient */}
          <linearGradient id="shieldFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.15 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
