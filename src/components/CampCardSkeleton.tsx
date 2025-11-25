export default function CampCardSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 animate-pulse">
        <div className="flex-1 space-y-4">
          <div className="h-6 bg-gray-200 rounded w-2/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-3 bg-gray-200 rounded w-1/2"></div>

          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>

          <div className="flex flex-wrap gap-2">
            {[...Array(3)].map((_, idx) => (
              <span key={idx} className="h-6 bg-gray-200 rounded-full w-16"></span>
            ))}
          </div>

          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-4/5"></div>
          </div>
        </div>

        <div className="flex-shrink-0 w-full sm:w-auto">
          <div className="h-10 bg-gray-200 rounded-md w-full sm:w-32"></div>
        </div>
      </div>
    </div>
  );
}



