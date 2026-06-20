import { Link } from "react-router-dom";

import { Layout } from "../components/Layout";

export function ModerationPolicyPage() {
  return (
    <Layout>
      <article className="mx-auto max-w-[var(--page-narrow)] py-8">
        <h1 className="text-2xl">Moderation policy</h1>
        <p className="text-text-muted">
          Little Scout removes content that violates our community guidelines — spam, harassment, fake
          reviews, or off-topic posts. We do not suppress negative ratings based on sentiment.
        </p>
        <ul className="grid gap-2 text-sm">
          <li>New contributors may have submissions reviewed before they appear publicly.</li>
          <li>Trusted contributors can publish immediately; all content remains reportable.</li>
          <li>Operators may exclude mistaken speed entries from venue medians.</li>
        </ul>
        <p className="text-sm">
          <Link to="/" className="font-semibold text-brand hover:underline">
            Back to app
          </Link>
        </p>
      </article>
    </Layout>
  );
}
