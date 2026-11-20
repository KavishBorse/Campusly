import { BrandLogo } from './BrandLogo';

export function LoadingScreen() {
  return (
    <main className="loading-screen" aria-label="Loading Campusly">
      <BrandLogo className="brand-logo--loading" />
      <span className="loading-line" />
    </main>
  );
}
