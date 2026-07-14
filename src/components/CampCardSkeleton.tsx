/**
 * Mirrors CampCard's structure block for block — 176px photo, 20px body, divider,
 * footer row — so the list doesn't reflow when real cards replace the skeletons.
 */
export default function CampCardSkeleton() {
  return (
    <div className="flex h-full animate-pulse flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Photo, with the tag and save-button placeholders sitting where the real ones do */}
      <div className="relative h-44 w-full flex-shrink-0 bg-gray-200">
        <span className="absolute bottom-3 left-3 h-6 w-16 rounded-full bg-white/70" />
        <span className="absolute right-3 top-3 h-9 w-9 rounded-full bg-white/70" />
      </div>

      <div className="flex flex-1 flex-col p-5">
        {/* Title */}
        <div className="h-5 w-3/4 rounded bg-gray-200" />

        {/* Meta: city · ages · distance */}
        <div className="mt-2 h-4 w-1/2 rounded bg-gray-200" />

        {/* Description, two lines */}
        <div className="mt-3 space-y-2">
          <div className="h-3 w-full rounded bg-gray-200" />
          <div className="h-3 w-5/6 rounded bg-gray-200" />
        </div>

        {/* Sessions row */}
        <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />

        {/* Footer: Visit website / Reviews on Google */}
        <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-3">
          <div className="h-4 w-24 rounded bg-gray-200" />
          <div className="h-4 w-32 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
