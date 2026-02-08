"use client";

export default function LoadingSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="game-card-container">
          {/* Top bar */}
          <div className="flex items-center justify-between mb-6">
            <div className="shimmer h-5 w-24 rounded-full" />
            <div className="shimmer h-5 w-16 rounded-full" />
          </div>
          {/* Logos row */}
          <div className="flex items-center justify-between mb-6 px-4">
            <div className="flex flex-col items-center gap-3">
              <div className="shimmer w-20 h-20 rounded-full" />
              <div className="shimmer h-4 w-20" />
            </div>
            <div className="shimmer h-8 w-12" />
            <div className="flex flex-col items-center gap-3">
              <div className="shimmer w-20 h-20 rounded-full" />
              <div className="shimmer h-4 w-20" />
            </div>
          </div>
          {/* Bars */}
          <div className="space-y-3">
            {[1, 2].map((j) => (
              <div key={j}>
                <div className="flex justify-between mb-1.5">
                  <div className="shimmer h-4 w-12" />
                  <div className="shimmer h-3 w-16" />
                  <div className="shimmer h-4 w-12" />
                </div>
                <div className="shimmer h-2.5 w-full rounded-full" />
              </div>
            ))}
          </div>
          {/* Footer */}
          <div className="flex justify-between mt-5 pt-4 border-t border-white/[0.06]">
            <div className="shimmer h-3 w-20" />
            <div className="shimmer h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}
