/** Shown for the moment a page's code is loading: a thin bar at the top and faint placeholders, no layout jump. */
export function PageFallback() {
  return (
    <div className="w-full px-4 py-6 md:px-8" aria-busy="true" aria-label="Loading">
      <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden">
        <div className="bar-live h-full w-full" />
      </div>
      <div className="skeleton h-8 w-56" />
      <div className="skeleton mt-3 h-4 w-80" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    </div>
  );
}
