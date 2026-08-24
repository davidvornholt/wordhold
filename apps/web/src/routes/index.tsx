import { createFileRoute, Link } from '@tanstack/react-router';

const Home = () => (
  <main className="p-8">
    <h1 className="text-2xl">Wordhold</h1>
    <p>From page to memory.</p>
    <nav className="mt-6 flex flex-col gap-2">
      <Link className="underline" to="/bake/heirloom">
        Bake-off: Heirloom
      </Link>
      <Link className="underline" to="/bake/warm-print">
        Bake-off: Warm Print
      </Link>
    </nav>
  </main>
);

export const Route = createFileRoute('/')({
  component: Home,
});
