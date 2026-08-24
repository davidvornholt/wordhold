import { createFileRoute } from '@tanstack/react-router';
import { BakePreview } from '../../shared/bake/preview';

const WarmPrintBake = () => (
  <BakePreview themeClass="theme-warm-print" themeName="Warm Print" />
);

export const Route = createFileRoute('/bake/warm-print')({
  component: WarmPrintBake,
});
