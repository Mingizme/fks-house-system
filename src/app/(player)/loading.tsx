export default function PlayerLoading() {
  return (
    <main className="p-6 lg:p-10 space-y-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-24 rounded-full bg-ink-surface2" />
        <div className="h-8 w-64 max-w-full rounded-lg bg-ink-surface2" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="h-36 rounded-xl2 border border-ink-border bg-ink-surface" />
        ))}
      </div>
      <div className="h-72 rounded-xl2 border border-ink-border bg-ink-surface" />
    </main>
  );
}
