import { ScoutLogo } from "../components/ScoutLogo";
import { Card } from "../components/ui/Card";
import { Page } from "../components/ui/Page";

export function PrivacyPage() {
  return (
    <div className="flex min-h-screen min-w-0 flex-col justify-center p-4 md:min-w-[var(--desktop-min-width)] md:p-8">
      <Page narrow className="py-0">
        <div className="mb-6 text-center">
          <div className="mb-3 flex justify-center">
            <ScoutLogo size={48} />
          </div>
          <h1 className="text-3xl tracking-tight">Privacy Policy</h1>
          <p className="text-text-muted">Last updated: 18 June 2026</p>
        </div>

        <Card>
          <p>
            Little Scout helps parents share and discover how quickly
            kid-friendly restaurants serve food. This policy explains what we
            collect, why, how long we keep it, who we share it with, and the
            choices you have. It applies to the Little Scout web app and iOS app.
          </p>
          <p>
            Questions about this policy? Contact us at{" "}
            <a className="font-semibold text-brand" href="mailto:privacy@littlescout.app">
              privacy@littlescout.app
            </a>
            .
          </p>

          <h2>Who this app is for</h2>
          <p>
            Little Scout is intended for adults (typically parents and
            caregivers). It is not directed to children under 13, and we do not
            knowingly collect personal information from children under 13. If you
            believe a child has provided us personal information, contact us and
            we will delete it.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Email address</strong> — to create and secure your account.
            </li>
            <li>
              <strong>Ratings and observations you submit</strong> (e.g.
              time-to-food, restaurant notes) — to operate the crowd-sourced
              rating product and compute aggregates.
            </li>
            <li>
              <strong>Approximate location</strong>, only when you explicitly
              grant it — to center the map near you and find nearby restaurants.
            </li>
            <li>
              <strong>Technical and abuse-prevention data</strong> (IP address,
              device and request metadata in server logs) — for security, rate
              limiting, and reliability.
            </li>
          </ul>
          <p>
            We do not collect a continuous or background location trail. Location
            is used only in the moment, when you tap to find restaurants near
            you, and is not stored as a personal location history.
          </p>

          <h2>How we use your information</h2>
          <ul>
            <li>Operate and improve the rating aggregation product.</li>
            <li>Authenticate you and keep your account secure.</li>
            <li>Prevent abuse, spam, and fraudulent submissions.</li>
            <li>
              Compute and display aggregate restaurant statistics, derived from
              many users&apos; contributions and not attributed to you individually
              in the public app.
            </li>
          </ul>
          <p>
            We do not sell your personal information, and we do not use
            third-party advertising or cross-app tracking.
          </p>

          <h2>How long we keep it</h2>
          <ul>
            <li>Account email: until you delete your account.</li>
            <li>
              Ratings, observations, and notes you submit: until you delete your
              account, then deleted or anonymized.
            </li>
            <li>
              Curated restaurant locations (our own catalog data): indefinitely.
            </li>
            <li>
              Server logs containing IP/device data: 30–90 days, then aggregated
              or redacted.
            </li>
          </ul>

          <h2>Who we share it with</h2>
          <p>
            We use the following service providers to run Little Scout. They
            process data on our behalf, subject to their own terms:
          </p>
          <ul>
            <li>
              <strong>Firebase (Google)</strong> — account authentication and
              security.
            </li>
            <li>
              <strong>Google Maps Platform</strong> — restaurant location, map
              display, and search.
            </li>
            <li>
              <strong>Google Cloud Platform</strong> — hosting and storage (Cloud
              Run, Cloud SQL, and Cloud Storage for any photo uploads).
            </li>
          </ul>

          <h2>Your rights and choices</h2>
          <ul>
            <li>
              <strong>Account deletion:</strong> Delete your account from{" "}
              <strong>Account → Delete account</strong> in the web or iOS app.
              You may need to confirm your identity before deletion completes.
              When you delete your account, we delete your ratings, observations,
              and notes, delete any photos you uploaded, revoke your sign-in
              credentials (including Sign in with Apple), and remove your
              authentication record, subject to legal retention requirements.
              Deletion is usually immediate; we show a confirmation when it is
              done.
            </li>
            <li>
              <strong>Help deleting:</strong> If you cannot access the app, email{" "}
              <a className="font-semibold text-brand" href="mailto:privacy@littlescout.app">
                privacy@littlescout.app
              </a>
              .
            </li>
            <li>
              <strong>Location:</strong> You can decline or revoke the location
              permission at any time in your browser or device settings; the app
              falls back to a default map area.
            </li>
            <li>
              <strong>Regional rights (CCPA / GDPR):</strong> Depending on where
              you live, you may have rights to access, correct, or delete your
              personal information. We honor these requests through the same
              contact above.
            </li>
          </ul>

          <h2>Changes to this policy</h2>
          <p>
            We may update this policy as the product evolves. We will update the
            date above and, for material changes, provide a more prominent
            notice.
          </p>
        </Card>
      </Page>
    </div>
  );
}
