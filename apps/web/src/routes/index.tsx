import { createFileRoute } from '@tanstack/react-router';

const Home = () => (
  <main className="p-8">
    <h1 className="text-2xl">Wordhold</h1>
    <p>From page to memory.</p>
  </main>
);

export const Route = createFileRoute('/')({
  component: Home,
});
