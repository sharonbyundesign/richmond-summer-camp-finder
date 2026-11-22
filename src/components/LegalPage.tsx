import SiteHeader from '@/components/SiteHeader';

/**
 * Shared shell for the static legal pages (/privacy, /disclaimer). Reuses the
 * site header treatment and a single readable prose column so the pages feel
 * native to the finder rather than bolted on.
 */
export default function LegalPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-gray-50">
      <SiteHeader />

      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">{title}</h1>
        <div className="mt-6 space-y-4 text-[15px] leading-relaxed text-gray-700">
          {children}
        </div>
      </div>
    </main>
  );
}

/** Section heading used within legal copy. */
export function LegalHeading({ children }: { children: React.ReactNode }) {
  return <h2 className="pt-4 text-xl font-semibold text-gray-900">{children}</h2>;
}
