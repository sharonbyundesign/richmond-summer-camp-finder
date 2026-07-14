import type { Metadata } from 'next';
import LegalPage, { LegalHeading } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy · Scouty',
  description: 'How Scouty collects and uses information during our beta.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-gray-600">Effective date: July 13, 2026</p>

      <p>
        Scouty (&ldquo;we,&rdquo; &ldquo;us&rdquo;) is a free tool that helps Richmond-area families
        discover summer camps. This policy explains what information we collect when you use
        scouty-beta.vercel.app and how we use it.
      </p>

      <LegalHeading>What we collect</LegalHeading>
      <p>
        We do not require accounts. You can use Scouty without providing your name, email, or any other
        personal information.
      </p>
      <p>
        Usage analytics and session recordings. We use PostHog, an analytics service, to understand how
        visitors use the site so we can improve it. This includes:
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>Pages you visit, buttons you click, and filters you use</li>
        <li>
          Session recordings — a replay of how you interact with the site (mouse movement, scrolling,
          clicks)
        </li>
        <li>
          Approximate location (city level, derived from your IP address), browser type, and device type
        </li>
      </ul>
      <p>Text you type into input fields is masked in session recordings and is not captured.</p>
      <p>
        Search and filter inputs. Filters you apply (such as camp session dates, price ranges, or
        children&rsquo;s ages) are recorded as anonymous usage data. We do not link this information to
        your identity, and we do not knowingly collect any personal information from or about children.
      </p>

      <LegalHeading>Cookies</LegalHeading>
      <p>
        We use cookies and similar technologies solely to support the analytics described above (for
        example, to recognize a returning browser session). We do not use advertising cookies and we do
        not sell or share your data with advertisers.
      </p>

      <LegalHeading>How we use this information</LegalHeading>
      <p>
        We use analytics and session recordings only to understand how the site is used, find bugs, and
        improve the experience during our beta period. We do not sell your information. Data is processed
        by PostHog on our behalf under their privacy and security terms.
      </p>

      <LegalHeading>Data retention</LegalHeading>
      <p>Session recordings and analytics data are retained for 30 days and then deleted.</p>

      <LegalHeading>Your choices</LegalHeading>
      <p>
        You can block analytics using browser settings or extensions that limit tracking, and the site
        will continue to work. If you have questions about your data or would like it deleted, contact us
        at sharonbyun.design@gmail or cherin0115@gmail.com and we will make reasonable efforts to identify
        and remove it.
      </p>

      <LegalHeading>Children&rsquo;s privacy</LegalHeading>
      <p>
        Scouty is intended for use by parents and guardians, not by children. We do not knowingly collect
        personal information from children under 13. If you believe a child has provided us personal
        information, contact us at sharonbyun.design@gmail or cherin0115@gmail.com.
      </p>

      <LegalHeading>Changes to this policy</LegalHeading>
      <p>
        We may update this policy as the product evolves. We will post the updated version here with a new
        effective date.
      </p>

      <LegalHeading>Contact</LegalHeading>
      <p>Questions? Email us at sharonbyun.design@gmail or cherin0115@gmail.com.</p>
    </LegalPage>
  );
}
