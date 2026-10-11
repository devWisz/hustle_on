/**
 * The product's name and slogan, in one place.
 *
 * The last rename had to touch 68 files because every surface held its own copy
 * of the string. Anything that shows the name should read it from here, so the
 * next one is a two-line change. The Go side keeps its own copy in
 * `auth.Config.ProductName` (and the email templates), because it cannot import
 * TypeScript.
 */
export const SITE_NAME = "Hustle On";
export const SITE_TAGLINE = "Rewards your hustle.";
