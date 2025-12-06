import logoHorizontal from "@/assets/logo-horizontal.png";
import logoStacked from "@/assets/logo-stacked.png";

interface LogoProps {
  className?: string;
  variant?: 'horizontal' | 'stacked' | 'icon-only';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Logo({ className = "", variant = 'horizontal', size }: LogoProps) {
  const sizeClasses = {
    sm: variant === 'stacked' ? 'h-20' : 'h-9',
    md: variant === 'stacked' ? 'h-28' : 'h-14',
    lg: variant === 'stacked' ? 'h-36' : 'h-20',
    xl: variant === 'stacked' ? 'h-48' : 'h-36',
  };

  const hasCustomSize = className.includes('w-') || className.includes('h-');
  const appliedSizeClass = hasCustomSize ? '' : sizeClasses[size || 'md'];

  if (variant === 'stacked') {
    return (
      <img 
        src={logoStacked} 
        alt="LeaseShield App - Landlord Protection" 
        className={`${appliedSizeClass} ${hasCustomSize ? '' : 'w-auto'} object-contain ${className}`}
      />
    );
  }

  return (
    <img 
      src={logoHorizontal} 
      alt="LeaseShield App - Landlord Protection" 
      className={`${appliedSizeClass} ${hasCustomSize ? '' : 'w-auto'} object-contain ${className}`}
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
