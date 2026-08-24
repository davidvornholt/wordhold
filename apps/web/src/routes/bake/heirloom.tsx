import { createFileRoute } from '@tanstack/react-router';
import { BakePreview } from '../../shared/bake/preview';

const HeirloomBake = () => (
  <BakePreview themeClass="theme-heirloom" themeName="Heirloom" />
);

export const Route = createFileRoute('/bake/heirloom')({
  component: HeirloomBake,
});
