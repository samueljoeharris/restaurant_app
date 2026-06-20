import { Link } from "react-router-dom";

import { ScoutLogo } from "../components/ScoutLogo";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";

export function ModerationPolicyPage() {
  return (
    <div className="flex min-h-screen flex-col justify-center p-4 sm:p-8 lg:min-w-[var(--desktop-min-width)]">
      <Page narrow className="py-0">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <ScoutLogo size={48} />
          </div>
          <h1 className="text-3xl tracking-tight">Moderation policy</h1>
        </div>

        <Card>
          <p>
            Little Scout removes content that violates our community guidelines — spam, harassment, fake
            reviews, or off-topic posts. We do not suppress negative ratings based on sentiment.
          </p>
          <ul className="grid gap-2 text-sm">
            <li>New contributors may have submissions reviewed before they appear publicly.</li>
            <li>Trusted contributors can publish immediately; all content remains reportable.</li>
            <li>Operators may exclude mistaken speed entries from venue medians.</li>
          </ul>
          <p>
            <Link to="/map" className="font-semibold text-brand hover:underline">
              Back to app
            </Link>
          </p>
        </Card>
      </Page>
    </div>
  );
}
