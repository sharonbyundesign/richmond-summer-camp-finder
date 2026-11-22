import type { Metadata } from 'next';
import LegalPage, { LegalHeading } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Privacy Policy · Scouty',
  description: 'How Scouty collects and uses information during our beta.',
};

export default function PrivacyPolicyPage() {
  return (
    <LegalPage title="Privacy Policy">
      <p className="text-gray-600">Effective date: November 22, 2026</p>

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
      <p>Text you type into input fields is masked in session recordings.</p>
      <p>
        Search and filter inputs. Filters you apply (such as camp session dates, price ranges, or
        children&rsquo;s ages) and the words you type in the camp search box are recorded as anonymous
        usage data, so we can see what families look for. We do not link this information to your
        identity, and we do not knowingly collect any personal information from or about children.
      </p>

      <LegalHeading>Email addresses you give us</LegalHeading>
      <p>
        Giving us your email is optional. There are two places you can do it:
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>
          <strong>Camp updates</strong> — the sign-up in the footer and banner. We store your email
          address and which of those places you used.
        </li>
        <li>
          <strong>Notify me</strong> — on a camp&rsquo;s page, to hear when that camp posts its dates
          for the coming season. We store your email address, the camp, and the season you asked
          about, so we email you about that camp and not others.
        </li>
      </ul>
      <p>
        <strong>Parent check-ins</strong> — if you check in on a camp, we store your email, the camp,
        the summer, your answers and any comment. We use your email only to send the one link that
        confirms your check-in, and we never show it. Your answers and an approved comment appear on
        the camp&rsquo;s page without your name or email. We also keep a one-way scrambled form of your
        IP address, only to stop the form being flooded.
      </p>
      <p>
        <strong>Camps sending us their dates</strong> — if you work for a camp and send its dates through
        the camp&rsquo;s update form, we store your name, email, role, and any note, along with the dates
        you send, so we can check the update and contact you about it. We also keep a one-way scrambled
        form of your IP address (not the address itself), only to stop the form being flooded.
      </p>
      <p>
        We use your address only to send what you asked for. We do not sell it, and we do not share
        it with advertisers. Addresses are stored in our database, hosted by Supabase on our behalf.
        Every email we send includes a link to unsubscribe, or you can ask us to remove you at{' '}
        <a href="mailto:scoutyrva@gmail.com" className="text-blue-600 hover:underline">scoutyrva@gmail.com</a>.
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
        improve the experience during our beta period, and email addresses only as described above. We
        do not sell your information. Analytics data is processed by PostHog, and email addresses are
        stored by Supabase, each on our behalf under their privacy and security terms.
      </p>

      <LegalHeading>Data retention</LegalHeading>
      <p>Session recordings and analytics data are retained for 30 days and then deleted.</p>
      <p>
        We keep your email address until you unsubscribe or ask us to delete it.
      </p>

      <LegalHeading>Your choices</LegalHeading>
      <p>
        You can block analytics using browser settings or extensions that limit tracking, and the site
        will continue to work. If you have questions about your data or would like it deleted, contact us
        at <a href="mailto:scoutyrva@gmail.com" className="text-blue-600 hover:underline">scoutyrva@gmail.com</a> and we will make reasonable efforts to identify
        and remove it.
      </p>

      <LegalHeading>Children&rsquo;s privacy</LegalHeading>
      <p>
        Scouty is intended for use by parents and guardians, not by children. We do not knowingly collect
        personal information from children under 13. If you believe a child has provided us personal
        information, contact us at <a href="mailto:scoutyrva@gmail.com" className="text-blue-600 hover:underline">scoutyrva@gmail.com</a>.
      </p>

      <LegalHeading>Changes to this policy</LegalHeading>
      <p>
        We may update this policy as the product evolves. We will post the updated version here with a new
        effective date.
      </p>

      <LegalHeading>Contact</LegalHeading>
      <p>Questions? Email us at <a href="mailto:scoutyrva@gmail.com" className="text-blue-600 hover:underline">scoutyrva@gmail.com</a>.</p>
    </LegalPage>
  );
}
