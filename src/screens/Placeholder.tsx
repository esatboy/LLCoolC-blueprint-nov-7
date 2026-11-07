export default function Placeholder({ title }: { title: string }) {
  return (
    <section className="py-10 text-center text-muted">
      <h2 className="font-display text-xl text-ink">{title}</h2>
      <p>Coming in the next milestone.</p>
    </section>
  );
}
