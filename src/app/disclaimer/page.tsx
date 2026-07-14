import type { Metadata } from 'next';
import LegalPage from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Disclaimer · Scouty',
  description: 'Scouty is an independent, beta directory — always confirm details with camps directly.',
};

export default function DisclaimerPage() {
  return (
    <LegalPage title="Disclaimer">
      <p>
        Scouty is a free, independent directory of Richmond-area summer camps, currently in beta.
      </p>

      <p>
        <strong className="font-semibold text-gray-900">Verify details with camps directly.</strong>{' '}
        Camp information on this site — including prices, dates, session availability, ages served, and
        locations — is gathered from public sources and may be incomplete, outdated, or inaccurate. Always
        confirm details directly with the camp before making plans or payments.
      </p>

      <p>
        <strong className="font-semibold text-gray-900">We are not affiliated with the camps listed.</strong>{' '}
        Camp names, logos, and descriptions are used to identify and describe the camps. A listing on
        Scouty is not an endorsement, and we do not vet, inspect, or certify any camp. Parents and
        guardians are solely responsible for evaluating whether a camp is safe and appropriate for their
        child.
      </p>

      <p>
        <strong className="font-semibold text-gray-900">No warranties.</strong> This site is provided
        &ldquo;as is,&rdquo; without warranties of any kind. To the fullest extent permitted by law, we
        are not liable for any loss or damage arising from your use of the site or reliance on its
        information.
      </p>

      <p>
        <strong className="font-semibold text-gray-900">Corrections.</strong> If you represent a camp and
        would like your listing updated or removed, contact us at scoutyrva@gmail.com and
        we&rsquo;ll respond promptly.
      </p>
    </LegalPage>
  );
}
