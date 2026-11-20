type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = '' }: BrandLogoProps) {
  return (
    <img
      className={`brand-logo${className ? ` ${className}` : ''}`}
      src="/campusly-emblem.png"
      alt="Campusly"
      width={1536}
      height={1024}
    />
  );
}
