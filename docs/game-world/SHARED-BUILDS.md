# Shared builds

Open the 3D house and choose **Shared build**. The host chooses a job and character, then **Host this build**. A teammate opens the designer, chooses a character and job, and enters the invitation under **Join build**. Invitations grant editing rights to one build. Character and job names are visible to participants.

In Walk, **Build from here** opens the house tools while the person stays at the chosen spot. **Resume walking** continues the visit. Changes to separate objects merge automatically. When two edits touch the same field the editor asks which change to keep. Losing the network keeps edits on the device for retry. Leaving saves the local copy.

Drag installed lights and products with **Move objects**. Right-click a door, choose **Edit opening**, and change **Distance along wall**. The foundation and services tools open their measured plans. Choose **Back**, then **Resume walking** to return to the parked viewpoint.

In Plan or House, right-click a build element or hold it on a touch screen for its options. Drag **Stairs** from the build palette onto a clear landing on both connected floors. Drag the floor brush to paint a continuous line, hold Alt to fill a rectangle, or hold Shift to fill the room. Choose **Pull curve** on an existing wall, roof outline or service run, then drag the bend. Esc finishes the current valid pull. Roof covering thickness is measured perpendicular to the surface. A wall carrying an opening must have the opening moved before its edge can be bent.

## Standalone host

The standalone host serves the application and persists builds in its own local database. From the repository, run `npm ci`, `npm run build`, then `npm run shared-build:serve -- --data=../olb-build-data`. Open `http://127.0.0.1:4199/demo` on the host machine. Two independent browser profiles can join the same build.

For teammates on other devices, set `--bind=0.0.0.0`, `--hostname=<your-hostname>`, `--cert=<certificate-path>` and `--key=<private-key-path>` on the same command. Teammates use the HTTPS address for that hostname and port. The host creates the room through the loopback address. Keep the data directory outside the served `dist` directory. Restart with the same data directory to reopen previously hosted builds.

## Hosted deployment

A signed-in studio user can host from the 3D house. Invited players use a code to join that build. The deployed handler uses the connected private Vercel Blob store for new rooms. Each immutable preview has a separate rehearsal namespace. Rehearsal invitations expire after 24 hours. The two production addresses share the production namespace. The existing PostgreSQL adapter serves standalone builds and earlier PostgreSQL invitations.

The server reads the revision pointer from private storage without CDN caching. A successful conditional write publishes a complete snapshot and its receipt. Presence and membership use a separate small object. Players disappear from the live roster after 15 seconds without a heartbeat. Participant credentials expire after 24 hours. Invitations and participant credentials stay out of design exports.

To verify two hosted players, use a disposable build named **Release verification**. On the host computer, pass its invitation to the standard input of `node tools/world/hosted-build-session.mjs <https-origin> <full-commit> <report-path>`. The tester joins two independent browser profiles, draws two faces, verifies both copies, reconnects and walks. The report contains checks and request counts. The readiness endpoint is `GET /api/shared-projects/live/status`.
