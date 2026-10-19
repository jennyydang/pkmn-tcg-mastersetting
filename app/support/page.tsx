import type { Metadata } from "next";
import Link from "next/link";
import { APP_NAME, SUPPORT_EMAIL } from "@/lib/appInfo";

export const metadata: Metadata = { title: `Help & Support · ${APP_NAME}` };

const FAQ = [
  {
    q: "How do I start tracking a set?",
    a: "Search for a set, Pokémon or artist on the home screen and tap Add. Then tap cards you own to mark them.",
  },
  {
    q: "What's the difference between master sets and My Collection?",
    a: "Master sets track progress toward owning every card in a set, Pokémon or artist. My Collection is a free-form list of cards you own, whatever set they're from.",
  },
  {
    q: "Where do card prices come from?",
    a: "Prices are TCGplayer market prices, provided through TCGdex. Japanese cards use Cardmarket prices, converted from euros to dollars at the day's exchange rate. They're estimates and can lag behind the market.",
  },
  {
    q: "I forgot my password.",
    a: "On the sign-in screen, tap “Forgot password?” and we'll email you a reset link.",
  },
  {
    q: "How do I delete my account?",
    a: "Open Account from the top of the screen and choose Delete Account. This permanently erases your account and collection.",
  },
];

export default function SupportPage() {
  return (
    <div className="max-w-2xl mx-auto text-sm leading-relaxed text-gray-700 dark:text-gray-300 space-y-6">
      <Link href="/" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">← Home</Link>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Help &amp; Support</h1>

      <section className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Contact us</h2>
        <p className="mb-2">
          Found a bug or have an idea?{" "}
          <Link href="/feedback?from=/support" className="text-blue-600 dark:text-blue-400 font-medium hover:underline">Send anonymous feedback</Link>.
        </p>
        {SUPPORT_EMAIL ? (
          <p>
            Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-600 dark:text-blue-400 font-medium hover:underline">{SUPPORT_EMAIL}</a>
            {" "}and we’ll get back to you as soon as we can.
          </p>
        ) : (
          <p className="text-red-500 dark:text-red-400">Support email not configured (set NEXT_PUBLIC_SUPPORT_EMAIL).</p>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Frequently asked questions</h2>
        {FAQ.map(({ q, a }) => (
          <div key={q}>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">{q}</h3>
            <p className="mt-1">{a}</p>
          </div>
        ))}
      </section>

      <p className="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-800">
        {APP_NAME} is an unofficial fan-made app and isn’t affiliated with, endorsed or sponsored by
        Nintendo, Creatures Inc., GAME FREAK inc. or The Pokémon Company. Pokémon and card images are
        trademarks and copyrights of their respective owners. See our{" "}
        <Link href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">Privacy Policy</Link>.
      </p>
    </div>
  );
}
