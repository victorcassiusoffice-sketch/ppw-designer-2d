# Trade Folder link · phase 1 pilot

In the protected Designer, open **Project hub → Build dashboard**. The direct path is `/designer?panel=build`. The public demo, embed and pitch pages do not expose this workspace.

1. **Make packages.** Enter a company name and a site/phase label. The current plan's existing estimators supply the quantities. Review the scope, units, references, dates and company on each draft. Change or remove a line, or add a measured line yourself. Check estimates on site.
2. **Share the work.** Choose **Build work file → Download work file**. The `.olbpackage.json` contains the request and a measured design extract. A small room sketch is included when it fits. Take the file to [Trade Folder](https://tradefolder.vercel.app/pro/job-pack). Copy link and QR are offered only when the request fits 1,800 characters; these carry the request, not the design. The trade sets its own prices.
3. **Review an answer.** Choose **Add an answer**, then a returned file or link. Check the sender and contents before saving. Opening an answer link prefills the review; it never accepts the answer. The checksum detects changes to the file; it does not establish the sender's identity.
4. **Record a decision.** A named owner, engineer or contractor decides on a quote or invoice. Recording paid requires a date, method and reference. No money moves. Totals are kept separately for each currency. Use **Hide amounts** for presentations.
5. **Revise or back up.** When the plan changes, review the new measured lines and send a new request for the same package. Previous decisions remain in history. Use **Files** to export or restore the local dashboard and download its package CSV. A backup contains private financial and project information even when amounts are hidden on screen.

The register belongs to this browser. Files are passed by people: there is no shared account, cloud synchronization, real ordering or payment. Once the pilot is loaded, reviewing data and recording decisions use local storage. An empty or different browser cannot accept an answer for a request it has never sent. Use a non-sensitive plot label; budgets and internal notes do not leave One Live Build in a work file.

## Contract and verification

The [Plan View contract](PLAN-VIEW-CONTRACT.md) and [Job Pack contract](JOB-PACK-CONTRACT.md) are frozen v1 copies. [Source provenance](../../src/designer/link/vendor/VENDORED.json) records the pinned Trade Folder files. The Trade Folder readers remain byte-identical to their upstream source.

The feature keeps its exact Ajv and uqr pins in a private npm package with its own lock. A normal root `npm ci` installs it. `npm run build` builds both HTML shells, the isolated plumbing pitch and the protected Designer. The dashboard stays a dynamic import even in that protected graph. The web middleware still decides access.

On a local compiled preview, run the matching dashboard and public-route checks in [tools/link](../../tools/link). Those checks require dedicated loopback servers, a built Trade Folder checkout, and no login. See [release evidence](evidence/) for the measured screen sizes, fixture details and results. The 3D view, rendering engines, geometry and material estimators are unchanged by this feature.
