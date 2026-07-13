type DirectChatRouteSkeletonProps = {
  centered?: boolean;
  showBackLink?: boolean;
};

type HouseChatRouteSkeletonProps = {
  showAdminControls?: boolean;
};

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`rounded-lg bg-ink-surface2 ${className}`} />;
}

function DirectChatFrameSkeleton() {
  return (
    <div className="flex h-full min-h-[70svh] flex-col overflow-hidden rounded-xl2 border border-ink-border bg-ink-surface">
      <div className="flex items-center gap-3 border-b border-ink-border p-3">
        <SkeletonBlock className="h-10 w-10 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <SkeletonBlock className="h-4 w-40 max-w-full" />
          <SkeletonBlock className="h-3 w-24 max-w-full" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col justify-end gap-4 overflow-hidden p-4">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className={`flex ${item % 2 === 0 ? "justify-start" : "justify-end"}`}>
            <div className={`space-y-2 ${item % 2 === 0 ? "w-7/12" : "w-8/12"}`}>
              <SkeletonBlock className="h-4 w-2/3" />
              <SkeletonBlock className="h-16 w-full rounded-xl2" />
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-ink-border p-3">
        <SkeletonBlock className="h-12 w-full rounded-xl2" />
      </div>
    </div>
  );
}

function HouseSidePanelSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl2 border border-ink-border bg-ink-surface p-3">
      <div className="mb-3 flex items-center justify-between">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-3 w-12" />
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="flex items-center gap-3 rounded-lg bg-ink-surface2/60 p-2">
            <SkeletonBlock className="h-8 w-8 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className="h-3 w-3/4" />
              <SkeletonBlock className="h-2 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DirectChatRouteSkeleton({ centered = false, showBackLink = false }: DirectChatRouteSkeletonProps) {
  return (
    <main
      aria-hidden="true"
      className={
        centered
          ? "mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col p-6 lg:p-10"
          : "flex min-h-0 flex-1 flex-col bg-ink-surface"
      }
    >
      <div className="flex min-h-0 flex-1 flex-col animate-pulse">
        {showBackLink && <SkeletonBlock className="mb-4 h-4 w-32 lg:mb-6" />}
        <div className={centered ? "min-h-[70svh] flex-1" : "min-h-0 flex-1"}>
          <DirectChatFrameSkeleton />
        </div>
      </div>
    </main>
  );
}

export function HouseChatRouteSkeleton({ showAdminControls = false }: HouseChatRouteSkeletonProps) {
  return (
    <main aria-hidden="true" className="w-full p-6 lg:p-8">
      <div className="animate-pulse">
        <div className="mb-8 hidden rounded-xl2 border border-ink-border bg-ink-surface p-6 lg:block">
          <div className="flex items-center gap-4">
            <SkeletonBlock className="h-14 w-14 shrink-0 rounded-full" />
            <div className="space-y-3">
              <SkeletonBlock className="h-7 w-52 max-w-full" />
              <SkeletonBlock className="h-4 w-72 max-w-full" />
            </div>
            <div className="ml-auto space-y-3">
              <SkeletonBlock className="h-3 w-24" />
              <SkeletonBlock className="h-9 w-32" />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {showAdminControls && (
            <div className="grid gap-3 rounded-xl2 border border-ink-border bg-ink-surface p-4 md:grid-cols-2">
              <SkeletonBlock className="h-24 w-full rounded-xl2" />
              <SkeletonBlock className="h-24 w-full rounded-xl2" />
            </div>
          )}
          <div className="flex flex-col gap-4 xl:flex-row">
            <div className="h-[70svh] min-h-[420px] min-w-0 flex-1 xl:h-[calc(100vh-220px)] xl:min-h-[620px]">
              <DirectChatFrameSkeleton />
            </div>
            <div className="h-[380px] w-full shrink-0 xl:h-[calc(100vh-260px)] xl:min-h-[480px] xl:w-72">
              <HouseSidePanelSkeleton />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
