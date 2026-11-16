export default function StudioLoading() {
  return (
    <div className="space-y-5">
      <div className="h-9 w-56 animate-pulse rounded-lg bg-[#10141d]" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl border border-[#1a2130] bg-[#10141d]"
          />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-xl border border-[#1a2130] bg-[#10141d]" />
    </div>
  );
}
