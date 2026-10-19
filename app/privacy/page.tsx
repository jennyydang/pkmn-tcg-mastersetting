import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/appInfo";

export const metadata: Metadata = { title: `Privacy Policy · ${APP_NAME}` };

// Describes what the app actually does with data (lib/store.tsx, lib/api.ts,
// CardScanSheet). Keep it in step when adding features that collect or share data.
export default function PrivacyPage() {
  return (
    <article className="max-w-2xl mx-auto text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:dark:text-gray-100 [&_h2]:pt-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
      <Link href="/" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">← Home</Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Privacy Policy</h1>
      <p className="text-gray-500 dark:text-gray-400">Effective October 19, 2026</p>

      <p>
        {APP_NAME} helps you track your Pokémon Trading Card Game collection. This policy explains what
        information the app collects, how it’s used, and the choices you have.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li><strong>Account information:</strong> your email address and password. Passwords are stored securely
          (hashed) by our authentication provider; we never see them.</li>
        <li><strong>Collection data:</strong> the master sets you track, the cards you mark as owned, your custom
          sets and My Collection cards, and daily snapshots of your collection’s estimated value.</li>
      </ul>
      <p>
        We don’t collect your name, location, contacts or device identifiers, and the app contains no
        advertising, analytics or tracking.
      </p>

      <h2>Feedback</h2>
      <p>
        When you send feedback, we store your message, the screen you sent it from and, if you choose, your app
        version and device type and an email address for a reply. Feedback isn’t linked to your account. To have
        feedback that includes your email deleted, contact us.
      </p>

      <h2>Camera</h2>
      <p>
        On devices that support barcode scanning, the card scanner uses your camera. Images are processed on your
        device only; they are never uploaded or stored. You can deny or revoke camera access at any time in your
        device settings, and search still works without it.
      </p>

      <h2>How we use your information</h2>
      <ul>
        <li>To sign you in and keep your collection in sync across your devices.</li>
        <li>To send emails you request, such as password reset links.</li>
      </ul>
      <p>We don’t sell your information or use it for advertising.</p>

      <h2>Services we rely on</h2>
      <ul>
        <li><strong>Supabase</strong> hosts our database and handles sign-in. Your account and collection data are
          stored there.</li>
        <li><strong>TCGdex</strong> provides card details, images and prices, and <strong>pokemontcg.io</strong> provides some
          card images. Your device requests this information directly from them, so, like any website, they receive
          your IP address. We don’t send them your account or collection information.</li>
        <li><strong>TCGplayer:</strong> price links open TCGplayer’s website, which has its own privacy policy.</li>
      </ul>

      <h2>Keeping and deleting your data</h2>
      <p>
        We keep your data for as long as you have an account. You can delete your account at any time from the
        Account page in the app; this permanently erases your account and all of your collection data right away.
      </p>

      <h2>Children</h2>
      <p>
        {APP_NAME} isn’t directed at children under 13, and we don’t knowingly collect information
        from them. If you believe a child has created an account, contact us and we’ll delete it.
      </p>

      <h2>Changes</h2>
      <p>If we change this policy, we’ll update the date above and, for significant changes, let you know in the app.</p>

      <h2>Contact</h2>
      <p>
        Questions about your privacy?{" "}
        {SUPPORT_EMAIL ? (
          <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">{SUPPORT_EMAIL}</a>
        ) : (
          <Link href="/support" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Contact support</Link>
        )}
      </p>
    </article>
  );
}
