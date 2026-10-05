# kora-installments-test-app

A **completely standalone** project for testing the `kora-installments` npm
package as a real external consumer would — separate `node_modules`, its own
`package.json`, no relative imports into the package's source tree.

This is different from the `examples/demo-app` folder that lives *inside*
the `kora-installments` repo: that one imports package source directly and
exists to demo the feature. This one installs the package the same way
anyone running `npm install kora-installments` would, so it actually tests
the published boundary — whether `package.json`'s `exports`/`types`/`main`
fields resolve correctly, whether the compiled `dist/` output is valid,
whether TypeScript consumers get proper types. A bug that only shows up
after publishing (broken exports, a missing file in `dist`) would be
invisible from source-linked testing but caught here.

## How the dependency is wired

`vendor/kora-installments-0.1.0.tgz` is the exact tarball `npm pack` would
upload to the registry, vendored into this repo so the whole test app is
self-contained and works offline, with no dependency on the original
package's repo being present alongside it. `package.json` installs it via:

```json
"kora-installments": "file:vendor/kora-installments-0.1.0.tgz"
```

Once the real package is published to npm, you'd swap this line for a
normal version range (`"kora-installments": "^1.0.0"`) and run
`npm install` — everything else in this app stays the same.

## Run it

```bash
npm install
npm run dev
```

Open **http://localhost:3001** (note: different port from the in-repo demo,
so you can run both side by side).

Kora's API is mocked here too (see the top of `src/server.ts`) — no real
Kora account needed to click through create → activate → charge.

## Re-testing after you change the package

Every time you change something in the `kora-installments` source, repeat
this to pull the update into this standalone app:

```bash
# in the kora-installments repo
npm run build
npm pack                     # produces a fresh kora-installments-X.Y.Z.tgz

# copy the new tarball into this app
cp kora-installments-X.Y.Z.tgz /path/to/kora-installments-test-app/vendor/

# in this app
# update package.json's dependency path to the new filename if the version changed
npm install
npm run dev
```

If the version number didn't change (you're iterating quickly pre-publish),
`npm install` may not notice the tarball changed — delete
`node_modules/kora-installments` first to force a fresh unpack:

```bash
rm -rf node_modules/kora-installments
npm install
```

## Files

- `vendor/kora-installments-0.1.0.tgz` — the real publishable tarball
- `src/server.ts` — Express routes + Kora API mock, importing the package
  as `kora-installments` (bare specifier, resolved from `node_modules`)
- `public/index.html` — status page (same UI as the in-repo demo)
