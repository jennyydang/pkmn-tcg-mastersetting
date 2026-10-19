// Always written lowercase.
export const APP_NAME = "pocketi";

// Shown on the privacy and support pages. Set NEXT_PUBLIC_SUPPORT_EMAIL before
// submitting to the App Store; Apple reviews these pages.
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "";

// The hosted site, for links that leave the app (password reset emails, shared
// trade lists). Inside the iOS app the origin is capacitor://localhost, which a
// browser can't open, so set NEXT_PUBLIC_SITE_URL for app builds.
export function siteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;
}

// Keep in step with MARKETING_VERSION in the Xcode project.
export const APP_VERSION = "1.0";
