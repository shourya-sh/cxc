"use client";

interface CategoryFilterProps {
  categories: string[];
  active: string;
  onSelect: (cat: string) => void;
  counts: Record<string, number>;
}

export default function CategoryFilter({
  categories,
  active,
  onSelect,
  counts,
}: CategoryFilterProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <button
        onClick={() => onSelect("all")}
        className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
          active === "all"
            ? "bg-accent text-bg-primary"
            : "bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-hover"
        }`}
      >
        All
        <span className="ml-1.5 opacity-60">
          {Object.values(counts).reduce((a, b) => a + b, 0)}
        </span>
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
            active === cat
              ? "bg-accent text-bg-primary"
              : "bg-bg-elevated text-text-secondary hover:text-text-primary hover:bg-bg-hover"
          }`}
        >
          {cat}
          {counts[cat] !== undefined && (
            <span className="ml-1.5 opacity-60">{counts[cat]}</span>
          )}
        </button>
      ))}
    </div>
  );
}
