import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Home } from "lucide-react";

export default function LogoColors() {
  const colorOptions = [
    {
      name: "Western Verify Coral/Orange",
      house: { start: "#e57a5a", end: "#d9725c" },
      description: "🎯 Matches Western Verify branding - warm, approachable"
    },
    {
      name: "Lighter Coral",
      house: { start: "#f28b77", end: "#e57a5a" },
      description: "Softer version of Western Verify orange"
    },
    {
      name: "Deep Coral",
      house: { start: "#d9725c", end: "#c25e48" },
      description: "Richer, more saturated coral tone"
    },
    {
      name: "Current - Amber/Gold",
      house: { start: "#f59e0b", end: "#d97706" },
      description: "Warm, professional, high contrast"
    },
    {
      name: "Charcoal Gray",
      house: { start: "#6b7280", end: "#4b5563" },
      description: "Ultra-professional, corporate, neutral"
    },
    {
      name: "Steel Blue-Gray",
      house: { start: "#64748b", end: "#475569" },
      description: "Professional services, sophisticated, modern"
    },
    {
      name: "Forest Green",
      house: { start: "#10b981", end: "#059669" },
      description: "Verified/approved, trustworthy, stable"
    },
    {
      name: "Silver/Light Gray",
      house: { start: "#94a3b8", end: "#64748b" },
      description: "Clean, professional, subtle contrast"
    }
  ];

  const LogoWithColor = ({ houseColor, size = 48 }: { houseColor: { start: string; end: string }, size?: number }) => {
    const id = `house-${houseColor.start.replace('#', '')}`;
    return (
      <div className="relative" style={{ width: size * 1.6, height: size * 1.1 }}>
        <div 
          className="absolute rounded-full blur-lg opacity-50"
          style={{
            width: size * 1.4,
            height: size * 1.4,
            left: '15%',
            top: '-15%',
            background: 'radial-gradient(circle, hsl(var(--primary)) 0%, transparent 65%)',
          }}
        />
        <Home 
          className="absolute" 
          style={{ 
            width: size * 0.92, 
            height: size * 0.92,
            left: '0%',
            top: '8%',
            stroke: `url(#${id})`,
            strokeWidth: 2.3,
            fill: 'none',
            filter: 'drop-shadow(0 3px 5px rgb(0 0 0 / 0.2))'
          }} 
        />
        <Shield 
          className="absolute" 
          style={{ 
            width: size * 1, 
            height: size * 1,
            right: '-2%',
            top: '3%',
            stroke: 'url(#shieldGrad)',
            strokeWidth: 2.5,
            fill: 'url(#shieldFillGrad)',
            filter: 'drop-shadow(0 4px 8px rgb(0 0 0 / 0.3))',
            strokeLinecap: 'square',
            strokeLinejoin: 'miter'
          }} 
        />
        <svg width="0" height="0" style={{ position: 'absolute' }}>
          <defs>
            <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: houseColor.start, stopOpacity: 0.85 }} />
              <stop offset="100%" style={{ stopColor: houseColor.end, stopOpacity: 0.7 }} />
            </linearGradient>
            <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style={{ stopColor: 'hsl(var(--primary) / 1)', stopOpacity: 1 }} />
              <stop offset="50%" style={{ stopColor: 'hsl(var(--primary) / 0.95)', stopOpacity: 1 }} />
              <stop offset="100%" style={{ stopColor: 'hsl(var(--primary) / 0.85)', stopOpacity: 1 }} />
            </linearGradient>
            <linearGradient id="shieldFillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.25 }} />
              <stop offset="100%" style={{ stopColor: 'hsl(var(--primary))', stopOpacity: 0.1 }} />
            </linearGradient>
          </defs>
        </svg>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h1 className="font-display text-xl font-semibold text-foreground">
            Choose House Color
          </h1>
          <Button
            variant="ghost"
            onClick={() => window.location.href = "/"}
            data-testid="button-back-home"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Home
          </Button>
        </div>
      </header>

      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
            House Color Options
          </h2>
          <p className="text-muted-foreground">
            The shield stays blue (primary color). Pick which house color works best:
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {colorOptions.map((option, index) => (
            <Card key={index} className="p-6 hover-elevate transition-all">
              <div className="flex flex-col items-center text-center">
                <div className="mb-4 flex items-center justify-center h-24">
                  <LogoWithColor houseColor={option.house} size={56} />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {option.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {option.description}
                </p>
                <div className="flex items-center gap-2 mt-auto">
                  <div 
                    className="w-6 h-6 rounded border"
                    style={{ background: `linear-gradient(135deg, ${option.house.start}, ${option.house.end})` }}
                  />
                  <span className="text-xs text-muted-foreground font-mono">
                    House Color
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-12 p-6 bg-muted/30 rounded-lg">
          <p className="text-sm text-muted-foreground text-center">
            Let me know which color you prefer and I'll update the logo across the entire site!
          </p>
        </div>
      </div>
    </div>
  );
}
