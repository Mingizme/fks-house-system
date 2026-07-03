export default function AdminLoading() {
  return (
    <main className="p-6 lg:p-10 space-y-6 animate-pulse">
      <div className="space-y-3">
        <div className="h-3 w-32 rounded-full bg-ink-surface2" />
        <div className="h-8 w-72 max-w-full rounded-lg bg-ink-surface2" />
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        {[0, 1, 2].map((item) => (
          <div key={item} className="h-28 rounded-xl2 border border-ink-border bg-ink-surface" />
        ))}
      </div>
      <div className="h-80 rounded-xl2 border border-ink-border bg-ink-surface" />
    </main>
  );
}
