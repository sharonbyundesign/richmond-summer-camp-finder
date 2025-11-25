interface CampCardProps {
  camp: {
    id: string;
    name: string;
    location?: string;
    min_age?: number;
    max_age?: number;
    description?: string;
    website_url?: string;
    camp_sessions?: Array<{
      start_date: string;
      end_date: string;
      label?: string;
    }>;
    camp_interests?: Array<{
      tag: string;
    }>;
  };
}

export default function CampCard({ camp }: CampCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-200">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{camp.name}</h3>
          
          {camp.location && (
            <p className="text-gray-600 mb-2 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {camp.location}
            </p>
          )}

          {(camp.min_age || camp.max_age) && (
            <p className="text-sm text-gray-500 mb-3">
              Ages {camp.min_age || '?'} - {camp.max_age || '?'}
            </p>
          )}

          {camp.description && (
            <p className="text-gray-700 mb-4 line-clamp-3">{camp.description}</p>
          )}

          {camp.camp_interests && camp.camp_interests.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {camp.camp_interests.map((interest, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full"
                >
                  {interest.tag}
                </span>
              ))}
            </div>
          )}

          {camp.camp_sessions && camp.camp_sessions.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold text-gray-700 mb-2">Available Sessions:</p>
              <div className="space-y-1">
                {camp.camp_sessions.map((session, idx) => (
                  <div key={idx} className="text-sm text-gray-600">
                    {session.label && <span className="font-medium">{session.label}: </span>}
                    {formatDate(session.start_date)} - {formatDate(session.end_date)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {camp.website_url && (
          <div className="flex-shrink-0">
            <a
              href={camp.website_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium whitespace-nowrap"
            >
              Visit Website
            </a>
          </div>
        )}
      </div>
    </div>
  );
}


