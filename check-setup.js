/**
 * Friendly setup check.
 *
 * Run at the start of every agent so that if the Anthropic API key isn't set,
 * the user sees plain-English instructions instead of a cryptic crash.
 *
 * Usage (already wired into each agent):
 *   require("./check-setup")();
 */
module.exports = function checkSetup() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("");
    console.error("\x1b[31mSetup needed:\x1b[0m your Anthropic API key isn't set yet, so the agent can't run.");
    console.error("");
    console.error("How to fix this (you only do it once):");
    console.error("  1. In this folder, make your settings file:   cp .env.example .env");
    console.error("  2. Open the new .env file in any text editor.");
    console.error("  3. Get a key from  https://console.anthropic.com  and paste it after");
    console.error("     ANTHROPIC_API_KEY=   (replace the placeholder text).");
    console.error("  4. Save the file and run this command again.");
    console.error("");
    process.exit(1);
  }
};
