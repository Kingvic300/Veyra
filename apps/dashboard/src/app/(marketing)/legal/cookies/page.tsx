'use client';

import { LegalPage } from '@/components/marketing/legal-page';
import { openConsentPreferences } from '@/lib/consent';

export default function CookiesPage() {
  return (
    <LegalPage
      current="/legal/cookies"
      title="Cookie policy"
      summary="Veyra uses one cookie and a few browser storage entries that the product needs to work. Anything optional stays off until you say yes."
    >
      <p>
        <button
          type="button"
          onClick={openConsentPreferences}
          className="inline-flex h-10 items-center rounded-control bg-settle px-4 text-sm font-medium text-white no-underline hover:bg-settle-strong"
        >
          Change cookie settings
        </button>
      </p>

      <h2>Strictly necessary</h2>
      <p>These cannot be switched off because Veyra does not work without them. They are never used for tracking or advertising.</p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Purpose</th>
            <th>Lasts</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>veyra_session</code>
            </td>
            <td>Cookie, HttpOnly, SameSite=Lax</td>
            <td>Keeps you signed in. Scripts on the page cannot read it.</td>
            <td>12 hours</td>
          </tr>
          <tr>
            <td>
              <code>veyra:consent</code>
            </td>
            <td>Local storage</td>
            <td>Remembers your cookie choices.</td>
            <td>Until you clear it</td>
          </tr>
          <tr>
            <td>
              <code>veyra:signed-in</code>
            </td>
            <td>Session storage</td>
            <td>Lets the app tell you when your session ends.</td>
            <td>Until the tab closes</td>
          </tr>
          <tr>
            <td>
              <code>veyra:last-wallet</code>
            </td>
            <td>Local storage</td>
            <td>Remembers which wallet extension you last used. Stores the wallet name only, never keys.</td>
            <td>Until you disconnect</td>
          </tr>
          <tr>
            <td>
              <code>veyra:seen:&lt;organisation&gt;</code>
            </td>
            <td>Local storage</td>
            <td>Marks which notifications you have already seen.</td>
            <td>Until you clear it</td>
          </tr>
        </tbody>
      </table>

      <h2>Optional: anonymous analytics</h2>
      <p>
        If you allow it, and only if the operator of this Veyra installation has enabled an analytics provider, we load a privacy-friendly script that
        counts page visits without identifying you. It is off by default and you can switch it off at any time. Turning it off stops the script from
        loading on your next page view.
      </p>

      <h2>Wallet extensions</h2>
      <p>
        Wallet extensions such as Ready or Braavos are separate software with their own storage and privacy policies. Veyra asks them for your account
        address and to sign transactions you approve, and nothing else.
      </p>

      <h2>Managing cookies in your browser</h2>
      <p>
        You can delete cookies and site storage in your browser settings. Deleting the session cookie signs you out; deleting the consent entry brings
        back the cookie banner.
      </p>
    </LegalPage>
  );
}
