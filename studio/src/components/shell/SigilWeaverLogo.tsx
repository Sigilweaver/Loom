import logoSvg from '/assets/sigilweaver-logo.svg';

interface SigilweaverLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function SigilweaverLogo({ className = '', size = 'md' }: SigilweaverLogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} flex items-center justify-center`}>
      <img
        src={logoSvg}
        alt="Sigilweaver Logo"
        className="w-full h-full"
      />
    </div>
  );
}
