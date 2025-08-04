interface SigilWeaverLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function SigilWeaverLogo({ className = '', size = 'md' }: SigilWeaverLogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`${sizeClasses[size]} ${className} flex items-center justify-center`}>
      <img 
        src="/assets/sigilweaver-logo.svg" 
        alt="SigilWeaver Logo"
        className="w-full h-full"
      />
    </div>
  );
}
