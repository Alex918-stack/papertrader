# Post-demo follow-ups

Things deliberately deferred until after the demo - not forgotten, just not
worth the risk of touching this close to it.

## Enable the React Compiler

**Why deferred:** it's a whole-app build transform. Turning it on days
before a demo means re-verifying everything to fix a bug class that
currently has zero remaining instances (see CLAUDE.md's React Hooks rule -
the one real instance, in the guided tour, is already fixed by hand). Right
call long-term, bad trade this week.

**Why do it eventually:** it auto-memoizes context provider value objects
(and other recomputed values) without hand-written `useMemo`, which is
better than memoizing the four providers by hand - a memoized object still
changes identity when its contents change, so the four dependency arrays
would still need to be correct on their own. The compiler removes the
"every render creates a new object" precondition that makes the mistake
dangerous in the first place; it doesn't replace the CLAUDE.md rule about
depending on primitive fields, not whole context objects.

**Findings (already researched, so this is just execution when it's time):**
- This stack (Next 16.2.10 + React 19.2.4) supports it as a first-class
  config option - confirmed from `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/reactCompiler.md`
  for this exact Next version, not assumed from training data.
- Config key: top-level `reactCompiler: true` in `next.config.ts` - **not**
  nested under `experimental` in this Next version. Use
  `reactCompiler: { compilationMode: 'annotation' }` instead for an opt-in
  mode where only components/hooks with a `"use memo"` directive get
  compiled.
- Requires installing `babel-plugin-react-compiler` as a devDependency
  (`npm install -D babel-plugin-react-compiler`). Currently **not
  installed** - it only appears in `package-lock.json` as an unresolved
  entry in Next's own `optionalPeerDependencies` list.
- React 19 needs no separate runtime shim - `react-compiler-runtime` is
  only needed for React <19, so there's nothing extra to add for this
  project's React 19.2.4.

**When picking this up:** install the plugin, add the config key, then
re-verify the app broadly (not just the guided tour) before merging, since
it's a build-wide transform.
