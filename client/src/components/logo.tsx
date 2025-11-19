import { Shield, Home } from "lucide-react";

interface LogoProps {
  className?: string;
  iconSize?: number;
}

export function Logo({ className = "", iconSize = 24 }: LogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: iconSize * 1.6, height: iconSize * 1.1 }}>
      {/* Stronger glow effect background */}
      <div 
        className="absolute rounded-full blur-lg opacity-50"
        style={{
          width: iconSize * 1.4,
          height: iconSize * 1.4,
          left: '15%',
          top: '-15%',
          background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)',
        }}
      />
      
      {/* House icon with amber/gold gradient */}
      <Home 
        className="absolute" 
        style={{ 
          width: iconSize * 0.92, 
          height: iconSize * 0.92,
          left: '0%',
          top: '8%',
          stroke: 'url(#houseGradient)',
          strokeWidth: 2.3,
          fill: 'none',
          filter: 'drop-shadow(0 3px 5px rgb(0 0 0 / 0.2))'
        }} 
      />
      
      {/* Bold, masculine shield with darker, stronger colors */}
      <Shield 
        className="absolute" 
        style={{ 
          width: iconSize * 1, 
          height: iconSize * 1,
          right: '-2%',
          top: '3%',
          stroke: 'url(#shieldGradient)',
          strokeWidth: 3.5,
          fill: 'url(#shieldFill)',
          filter: 'drop-shadow(0 4px 8px rgb(0 0 0 / 0.3))',
          strokeLinecap: 'square',
          strokeLinejoin: 'miter'
        }} 
      />
      
      {/* SVG Gradients */}
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          {/* House gradient - warm amber/gold tones for contrast */}
          <linearGradient id="houseGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#f59e0b', stopOpacity: 0.85 }} />
            <stop offset="100%" style={{ stopColor: '#d97706', stopOpacity: 0.7 }} />
          </linearGradient>
          
          {/* Shield gradient - bold, darker, more masculine */}
          <linearGradient id="shieldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary) / 1)', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: 'hsl(var(--primary) / 0.95)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.85)', stopOpacity: 1 }} />
          </linearGradient>
          
          {/* Shield fill - stronger, more opaque */}
          <linearGradient id="shieldFill" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.25 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.1 }} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
