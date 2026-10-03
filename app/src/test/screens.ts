/* The screens the app loads on demand (lazy, App.tsx). Vitest transforms a
   module the first time it is imported, so the first test of a file that
   opens a roster paid for the whole screen – close to four seconds here and
   past the five-second limit on a slower CI runner. A file that renders
   the routes loads them once, before its tests, with time to spare. */
export const SCREENS_MS = 30_000;

export async function loadScreens(): Promise<void> {
  await Promise.all([import('../routes/Roster.tsx'), import('../routes/NewWarband.tsx'), import('../routes/TradingPost.tsx'), import('../routes/Hire.tsx'), import('../routes/HouseRules.tsx')]);
}
