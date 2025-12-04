import logoHorizontal from "@assets/leaseshield_logo_transparent_horiz_jpg_1764884034160.png";
import logoStacked from "@assets/leashield_logo_transparent_jpg_1764884038236.png";

interface LogoProps {
  className?: string;
  variant?: 'horizontal' | 'stacked' | 'icon-only';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ className = "", variant = 'horizontal', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: variant === 'stacked' ? 'h-16' : 'h-8',
    md: variant === 'stacked' ? 'h-24' : 'h-10',
    lg: variant === 'stacked' ? 'h-32' : 'h-12',
    xl: variant === 'stacked' ? 'h-40' : 'h-16',
  };

  if (variant === 'stacked') {
    return (
      <img 
        src={logoStacked} 
        alt="LeaseShield App - Landlord Protection" 
        className={`${sizeClasses[size]} w-auto object-contain ${className}`}
      />
    );
  }

  return (
    <img 
      src={logoHorizontal} 
      alt="LeaseShield App - Landlord Protection" 
      className={`${sizeClasses[size]} w-auto object-contain ${className}`}
    />
  );
}

interface LogoIconProps {
  className?: string;
  size?: number;
}

export function LogoIcon({ className = "", size = 32 }: LogoIconProps) {
  return (
    <img 
      src={logoStacked} 
      alt="LeaseShield" 
      className={`object-contain object-top ${className}`}
      style={{ width: size, height: size, objectPosition: 'center top' }}
    />
  );
}
