"use client";

export default function LoadingSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass-card p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="shimmer w-10 h-10 rounded-lg" />
            <div className="flex-1 space-y-2">
              <div className="shimmer h-4 w-3/4" />
              <div className="shimmer h-3 w-1/3" />
            </div>
          </div>
          <div className="space-y-3">
            {[1, 2, 3].map((j) => (
              <div key={j}>
                <div className="flex justify-between mb-1">
                  <div className="shimmer h-3 w-1/2" />
                  <div className="shimmer h-3 w-8" />
                </div>
                <div className="shimmer h-1.5 w-full" />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-4 pt-3 border-t border-border">
            <div className="shimmer h-3 w-16" />
            <div className="shimmer h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  );
}
