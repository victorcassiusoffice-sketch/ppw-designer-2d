/**
 * M7 — Merchant onboarding self-serve page (DT-K1-03).
 *
 * Public, no auth. Walks a prospective Pattern C merchant (K1-Sport
 * being the pilot) through:
 *   1. What "Pattern C" actually means (manual monthly reconciliation,
 *      5% commission, no platform-acquiring risk, no MIPS dependency).
 *   2. How PPW attributes designer-originated clicks
 *      (ref code embedded in the outbound URL).
 *   3. What the merchant has to do (verify the ref code is visible in
 *      their order export; sign the MoU; send invoice → bank transfer).
 *
 * Brand-themed (navy / gold / cream + EB Garamond + Inter) so the page
 * sits naturally next to the M5 merchant dashboard.
 *
 * Route: `/merchants/onboard/:slug` (slug is optional context, e.g.
 * `/merchants/onboard/k1-sport`). The page reads the slug from
 * `useParams` and slots it into copy + MoU mailto. Static otherwise —
 * no API calls.
 */

import { Link, useParams } from 'react-router-dom';

const BRAND = {
  navy: '#232C3B',
  deepNavy: '#1A2230',
  gold: '#FFBB58',
  goldSoft: 'rgba(255,187,88,0.18)',
  cream: '#F5EBD7',
  creamLine: 'rgba(245,235,215,0.14)',
  muted: '#A8B0BD',
  serif: "'EB Garamond', Georgia, serif",
  sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
} as const;

const MERCHANT_DISPLAY_NAMES: Record<string, string> = {
  'k1-sport': 'K1-Sport',
};

export default function MerchantOnboardingPage(): JSX.Element {
  const { slug } = useParams<{ slug: string }>();
  const slugLower = (slug ?? '').toLowerCase();
  const displayName = MERCHANT_DISPLAY_NAMES[slugLower] ?? slugLower ?? '';
  const subjectSlug = displayName || 'partner';
  const mouSubject = `PPW × ${subjectSlug} — Pattern C MoU`;
  const mouHref = `mailto:victor@ppwellness.co?subject=${encodeURIComponent(mouSubject)}`;

  return (
    <div
      data-testid="merchant-onboarding"
      data-merchant-slug={slugLower}
      style={{
        minHeight: '100vh',
        background: BRAND.navy,
        color: BRAND.cream,
        fontFamily: BRAND.sans,
      }}
    >
      <Header displayName={displayName} />
      <main style={{ maxWidth: 880, margin: '0 auto', padding: '40px 24px 80px' }}>
        <Hero displayName={displayName} />
        <HowItWorks />
        <WhatTheMerchantDoes />
        <FinancePosture />
        <Cta mouHref={mouHref} displayName={displayName} slug={slugLower} />
      </main>
    </div>
  );
}

function Header({ displayName }: { displayName: string }): JSX.Element {
  return (
    <header
      style={{
        background: BRAND.deepNavy,
        borderBottom: `1px solid ${BRAND.creamLine}`,
        padding: '20px 24px',
      }}
    >
      <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span
          style={{
            padding: '4px 10px',
            borderRadius: 4,
            background: BRAND.gold,
            color: BRAND.deepNavy,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          PPW Partnership
        </span>
        <h1
          style={{
            margin: 0,
            fontFamily: BRAND.serif,
            fontWeight: 500,
            fontSize: 22,
            color: BRAND.cream,
          }}
          data-testid="merchant-onboarding-title"
        >
          {displayName ? `${displayName} onboarding` : 'Merchant onboarding'}
        </h1>
      </div>
    </header>
  );
}

function Section({ title, children, testid }: { title: string; children: React.ReactNode; testid?: string }): JSX.Element {
  return (
    <section
      data-testid={testid}
      style={{
        background: BRAND.deepNavy,
        border: `1px solid ${BRAND.creamLine}`,
        borderRadius: 10,
        padding: 24,
        marginBottom: 18,
      }}
    >
      <h2
        style={{
          fontFamily: BRAND.serif,
          fontWeight: 500,
          fontSize: 20,
          margin: '0 0 12px',
          color: BRAND.cream,
        }}
      >
        {title}
      </h2>
      <div style={{ color: BRAND.cream, fontSize: 14, lineHeight: 1.6 }}>{children}</div>
    </section>
  );
}

function Hero({ displayName }: { displayName: string }): JSX.Element {
  return (
    <section style={{ marginBottom: 32 }}>
      <h2
        style={{
          fontFamily: BRAND.serif,
          fontWeight: 500,
          fontSize: 30,
          margin: '0 0 12px',
          color: BRAND.cream,
        }}
      >
        Become a {displayName ? `${displayName} ↔ ` : ''}PPW partner in under a day
      </h2>
      <p style={{ color: BRAND.muted, fontSize: 15, lineHeight: 1.6, margin: 0 }}>
        Peak Performance Wellness routes design-driven customers to your storefront with a 5% commission
        agreed at MoU. The pilot uses <strong style={{ color: BRAND.cream }}>Pattern C</strong> —
        you stay the seller of record, you collect 100% at checkout, PPW invoices you once a month for the
        attributed 5%. Zero changes to your existing payment processor.
      </p>
    </section>
  );
}

function HowItWorks(): JSX.Element {
  return (
    <Section title="How attribution actually works" testid="onboarding-how-it-works">
      <ol style={{ paddingLeft: 20, margin: 0 }}>
        <li style={{ marginBottom: 8 }}>
          A customer designs their wellness room on PPW Designer and adds your product.
        </li>
        <li style={{ marginBottom: 8 }}>
          They click <em>“Get this room”</em> → PPW issues a unique ref code (e.g.
          <code style={{ padding: '0 4px', background: BRAND.goldSoft, color: BRAND.cream, borderRadius: 3 }}>
            PPW-K1-DESIGN42-A7C3F1B0
          </code>
          ).
        </li>
        <li style={{ marginBottom: 8 }}>
          We log the click in our database <em>and</em> embed the ref code in the URL we hand off to your
          storefront: <code style={{ color: BRAND.cream }}>?ref=PPW-K1-…&amp;utm_source=ppw-designer</code>.
        </li>
        <li style={{ marginBottom: 0 }}>
          You verify the ref code appears in your standard order export (Airsquare query string, custom-field,
          or coupon — whichever you support). At month end PPW reconciles the codes against the orders, invoices
          you for 5%, you bank-transfer.
        </li>
      </ol>
    </Section>
  );
}

function WhatTheMerchantDoes(): JSX.Element {
  return (
    <Section title="What you do — total time ≈ 1 hour" testid="onboarding-merchant-todo">
      <ul style={{ paddingLeft: 20, margin: 0 }}>
        <li style={{ marginBottom: 8 }}>
          Sign the one-page MoU (commission %, attribution window, exclusivity carve-outs).
        </li>
        <li style={{ marginBottom: 8 }}>
          Confirm with us (a 5-minute screen-share is enough) that your order export shows the URL query string
          or a coupon-style ref. Most cart platforms do this out of the box.
        </li>
        <li style={{ marginBottom: 8 }}>
          Pay PPW's monthly invoice via bank transfer in MUR. No PSP integration on your side.
        </li>
        <li style={{ marginBottom: 0 }}>
          Optional: send PPW your product list once at sign-up so we can seed our designer catalogue with your
          names, dimensions and prices (no images required at the pilot stage).
        </li>
      </ul>
    </Section>
  );
}

function FinancePosture(): JSX.Element {
  return (
    <Section title="The finance + legal posture" testid="onboarding-finance-posture">
      <p style={{ margin: '0 0 8px' }}>
        Under Pattern C, <strong style={{ color: BRAND.cream }}>PPW is not the seller of record</strong>.
        Your customer pays you directly on your existing payment rails, and you remain on the hook for VAT, refunds,
        delivery, and after-sales support exactly as you are today. PPW's 5% is invoiced as a marketing /
        customer-acquisition service.
      </p>
      <p style={{ margin: 0 }}>
        See <code style={{ color: BRAND.cream }}>K1-Commission-Architecture/02-THREE-ARCHITECTURE-OPTIONS.md</code>{' '}
        for the side-by-side against Pattern A (Stripe Connect) and Pattern B (MIPS 1BMV). Pattern B replaces
        Pattern C once both parties land MIPS sub-merchant onboarding — typically 6–8 weeks after MoU.
      </p>
    </Section>
  );
}

function Cta({ mouHref, displayName, slug }: { mouHref: string; displayName: string; slug: string }): JSX.Element {
  return (
    <section
      data-testid="onboarding-cta"
      style={{
        background: BRAND.deepNavy,
        border: `1px solid ${BRAND.gold}`,
        borderRadius: 10,
        padding: 24,
      }}
    >
      <h2
        style={{
          fontFamily: BRAND.serif,
          fontWeight: 500,
          fontSize: 20,
          margin: '0 0 12px',
          color: BRAND.cream,
        }}
      >
        Ready to sign?
      </h2>
      <p style={{ color: BRAND.cream, fontSize: 14, lineHeight: 1.6, margin: '0 0 16px' }}>
        Email Vic with the contact + bank details we'll need for the MoU and the first month's reconciliation.
        Once the MoU is signed, your dashboard at{' '}
        <code style={{ color: BRAND.cream }}>/merchant/{slug || '<your-slug>'}</code> goes live (sign-in via magic
        link sent to your contact email).
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <a
          href={mouHref}
          data-testid="onboarding-mou-cta"
          style={{
            display: 'inline-block',
            padding: '10px 18px',
            borderRadius: 6,
            background: BRAND.gold,
            color: BRAND.deepNavy,
            fontWeight: 600,
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          Email Vic to start the MoU
        </a>
        {slug && (
          <Link
            to={`/merchant/${encodeURIComponent(slug)}`}
            data-testid="onboarding-dashboard-link"
            style={{
              display: 'inline-block',
              padding: '10px 18px',
              borderRadius: 6,
              background: 'transparent',
              color: BRAND.cream,
              fontWeight: 600,
              fontSize: 13,
              textDecoration: 'none',
              border: `1px solid ${BRAND.creamLine}`,
            }}
          >
            Open the {displayName || 'merchant'} dashboard
          </Link>
        )}
      </div>
    </section>
  );
}
