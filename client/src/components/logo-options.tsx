import { Shield, Home, FileText, Key, Lock } from "lucide-react";

interface LogoProps {
  className?: string;
  iconSize?: number;
}

// Option 1: Current - House + Shield with Glow
export function LogoOption1({ className = "", iconSize = 24 }: LogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: iconSize * 1.6, height: iconSize * 1.1 }}>
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
      <Home 
        className="absolute" 
        style={{ 
          width: iconSize * 0.9, 
          height: iconSize * 0.9,
          left: '0%',
          top: '8%',
          stroke: 'url(#houseGradient1)',
          strokeWidth: 2,
          fill: 'none',
          filter: 'drop-shadow(0 2px 4px rgb(0 0 0 / 0.15))'
        }} 
      />
      <Shield 
        className="absolute" 
        style={{ 
          width: iconSize * 0.95, 
          height: iconSize * 0.95,
          right: '0%',
          top: '5%',
          stroke: 'url(#shieldGradient1)',
          strokeWidth: 2.5,
          fill: 'url(#shieldFill1)',
          filter: 'drop-shadow(0 3px 6px rgb(0 0 0 / 0.2))'
        }} 
      />
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="houseGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.6 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.4 }} />
          </linearGradient>
          <linearGradient id="shieldGradient1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.8)', stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="shieldFill1" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.15 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Option 2: House Inside Shield (Integrated)
export function LogoOption2({ className = "", iconSize = 24 }: LogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: iconSize * 1.2, height: iconSize * 1.2 }}>
      <Shield 
        className="absolute text-primary" 
        style={{ 
          width: iconSize * 1.2, 
          height: iconSize * 1.2,
          left: '0%',
          top: '0%',
          strokeWidth: 2.5,
          fill: 'url(#shieldBg2)',
          filter: 'drop-shadow(0 4px 8px rgb(0 0 0 / 0.25))'
        }} 
      />
      <Home 
        className="absolute text-background dark:text-foreground" 
        style={{ 
          width: iconSize * 0.55, 
          height: iconSize * 0.55,
          left: '27%',
          top: '28%',
          strokeWidth: 2.5,
          filter: 'drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))'
        }} 
      />
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="shieldBg2" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.85)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Option 3: Document + Shield (Lease Protection)
export function LogoOption3({ className = "", iconSize = 24 }: LogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: iconSize * 1.5, height: iconSize * 1.1 }}>
      <FileText 
        className="absolute" 
        style={{ 
          width: iconSize * 0.85, 
          height: iconSize * 0.85,
          left: '0%',
          top: '10%',
          stroke: 'url(#docGradient3)',
          strokeWidth: 2,
          fill: 'none',
          filter: 'drop-shadow(0 2px 4px rgb(0 0 0 / 0.15))'
        }} 
      />
      <Shield 
        className="absolute" 
        style={{ 
          width: iconSize * 0.7, 
          height: iconSize * 0.7,
          right: '5%',
          top: '0%',
          stroke: 'url(#shieldGradient3)',
          strokeWidth: 3,
          fill: 'url(#shieldFill3)',
          filter: 'drop-shadow(0 3px 6px rgb(0 0 0 / 0.25))'
        }} 
      />
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="docGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.5 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.3 }} />
          </linearGradient>
          <linearGradient id="shieldGradient3" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.8)', stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="shieldFill3" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.2 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.05 }} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Option 4: Shield with Key (Security Focus)
export function LogoOption4({ className = "", iconSize = 24 }: LogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: iconSize * 1.2, height: iconSize * 1.2 }}>
      <div 
        className="absolute rounded-full blur-lg opacity-30"
        style={{
          width: iconSize * 1.4,
          height: iconSize * 1.4,
          left: '-10%',
          top: '-10%',
          background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)',
        }}
      />
      <Shield 
        className="absolute" 
        style={{ 
          width: iconSize * 1.2, 
          height: iconSize * 1.2,
          left: '0%',
          top: '0%',
          stroke: 'url(#shieldGradient4)',
          strokeWidth: 2.5,
          fill: 'url(#shieldFill4)',
          filter: 'drop-shadow(0 4px 8px rgb(0 0 0 / 0.2))'
        }} 
      />
      <Key 
        className="absolute text-background dark:text-foreground" 
        style={{ 
          width: iconSize * 0.6, 
          height: iconSize * 0.6,
          left: '25%',
          top: '25%',
          strokeWidth: 2.5,
          filter: 'drop-shadow(0 1px 3px rgb(0 0 0 / 0.15))'
        }} 
      />
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="shieldGradient4" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.75)', stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="shieldFill4" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.95 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.8)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

// Option 5: Bold Geometric Shield
export function LogoOption5({ className = "", iconSize = 24 }: LogoProps) {
  return (
    <div className={`relative ${className}`} style={{ width: iconSize * 1.3, height: iconSize * 1.3 }}>
      {/* Outer glow rings */}
      <div 
        className="absolute rounded-lg opacity-20"
        style={{
          width: iconSize * 1.3,
          height: iconSize * 1.3,
          left: '0%',
          top: '0%',
          border: '2px solid hsl(var(--primary))',
          animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        }}
      />
      <Shield 
        className="absolute" 
        style={{ 
          width: iconSize * 1.1, 
          height: iconSize * 1.1,
          left: '8%',
          top: '8%',
          stroke: 'url(#shieldGradient5)',
          strokeWidth: 3.5,
          fill: 'url(#shieldFill5)',
          filter: 'drop-shadow(0 6px 12px rgb(0 0 0 / 0.3))'
        }} 
      />
      <Home 
        className="absolute text-background dark:text-primary-foreground" 
        style={{ 
          width: iconSize * 0.5, 
          height: iconSize * 0.5,
          left: '31%',
          top: '33%',
          strokeWidth: 3,
        }} 
      />
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <defs>
          <linearGradient id="shieldGradient5" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary) / 1)', stopOpacity: 1 }} />
            <stop offset="50%" style={{ stopColor: 'hsl(var(--primary) / 0.9)', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.8)', stopOpacity: 1 }} />
          </linearGradient>
          <linearGradient id="shieldFill5" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 1 }} />
            <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.85)', stopOpacity: 1 }} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
