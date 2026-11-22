import type { Metadata } from 'next';
import Link from 'next/link';
import LegalPage, { LegalHeading } from '@/components/LegalPage';

export const metadata: Metadata = {
  title: 'Terms of Use · Scouty',
  description: 'The terms for using Scouty, and for camps that send us their dates.',
};

const EMAIL = (
  <a href="mailto:scoutyrva@gmail.com" className="text-blue-600 hover:underline">
    scoutyrva@gmail.com
  </a>
);

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Use">
      <p className="text-gray-600">Effective date: November 22, 2026</p>

      <p>
        Scouty (&ldquo;we,&rdquo; &ldquo;us&rdquo;) is a free directory that helps Richmond-area families
        find summer camps, currently in beta. By using scouty-beta.vercel.app you agree to these terms. If
        you don&rsquo;t agree, please don&rsquo;t use the site.
      </p>

      <LegalHeading>Using Scouty</LegalHeading>
      <p>
        Scouty is free, and you don&rsquo;t need an account. You may use it to find camps for your own
        family. Please don&rsquo;t:
      </p>
      <ul className="list-disc space-y-1 pl-6">
        <li>copy the directory in bulk, by scraping or otherwise, to republish or sell it</li>
        <li>try to break, overload, or get around the limits of the site or its forms</li>
        <li>send us false information, or information about a camp you don&rsquo;t represent</li>
      </ul>

      <LegalHeading>Camp information</LegalHeading>
      <p>
        Camp details on Scouty come from camps&rsquo; own websites and from the camps themselves. They can
        be incomplete, out of date, or wrong, and camps change dates and prices. Always confirm details
        with the camp before you register or pay. Scouty doesn&rsquo;t run, vet, or endorse any camp, and
        isn&rsquo;t part of any camp&rsquo;s registration. See our{' '}
        <Link href="/disclaimer" className="text-blue-600 hover:underline">Disclaimer</Link> for more.
      </p>

      <LegalHeading>For camps sending us their dates</LegalHeading>
      <p>When you send an update through a camp&rsquo;s update form, you confirm that:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>you work for the camp, or are allowed to speak for it</li>
        <li>what you send is accurate to the best of your knowledge</li>
      </ul>
      <p>
        You give us permission to publish what you send on Scouty, to adjust its format to fit the site,
        and to show it as confirmed by the camp. We review every update before it goes live, and we may
        contact you about it, change how it&rsquo;s shown, decline it, or remove it later. To correct or
        remove your camp&rsquo;s listing at any time, email {EMAIL}.
      </p>

      <LegalHeading>Parent check-ins</LegalHeading>
      <p>
        Parents can say how a camp went: whether they&rsquo;d send their child again, a few set tags, and
        an optional short comment. A check-in counts only after you confirm it from your email, and a
        camp&rsquo;s summary shows only once at least five parents have checked in. When you send one,
        you confirm that your child attended that camp that summer, and you give us permission to
        publish your answers and comment on Scouty without your name or email.
      </p>
      <p>Comments are reviewed before they appear. We publish every comment that follows these rules, positive or negative:</p>
      <ul className="list-disc space-y-1 pl-6">
        <li>it&rsquo;s about your own family&rsquo;s experience at that camp</li>
        <li>it doesn&rsquo;t name or describe a child or a staff member</li>
        <li>it isn&rsquo;t abusive, and doesn&rsquo;t include contact details, links or ads</li>
        <li>it isn&rsquo;t written by, or on behalf of, the camp or a competitor</li>
      </ul>
      <p>
        We don&rsquo;t hide check-ins for being negative, and camps can&rsquo;t remove them. A camp that
        thinks a check-in breaks these rules can ask us to look at it at {EMAIL}. Check-ins are the
        opinions of the parents who send them, not Scouty&rsquo;s. We never pay for check-ins or reward
        positive ones.
      </p>

      <LegalHeading>Saved camps and emails</LegalHeading>
      <p>
        Camps and sessions you save are kept in your own browser, not on our servers, so clearing your
        browser data removes them. If you give us your email for camp updates or a Notify me request, we
        use it only as our{' '}
        <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link> describes,
        and every email we send has a link to unsubscribe.
      </p>

      <LegalHeading>Other websites</LegalHeading>
      <p>
        Scouty links to camps&rsquo; websites, registration pages, and Google reviews. Those sites are run
        by others, and their own terms and privacy policies apply. We aren&rsquo;t responsible for them.
      </p>

      <LegalHeading>No warranties, limited liability</LegalHeading>
      <p>
        Scouty is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any
        kind. To the fullest extent the law allows, we aren&rsquo;t liable for any loss or damage that
        comes from using the site or relying on its information, including any decision about a camp.
      </p>

      <LegalHeading>Changes</LegalHeading>
      <p>
        We may change Scouty, or these terms, as the product grows. We&rsquo;ll post the new terms here
        with a new effective date. Using the site after a change means you accept the new terms.
      </p>

      <LegalHeading>Governing law</LegalHeading>
      <p>These terms are governed by the laws of the Commonwealth of Virginia.</p>

      <LegalHeading>Contact</LegalHeading>
      <p>Questions about these terms? Email us at {EMAIL}.</p>
    </LegalPage>
  );
}
