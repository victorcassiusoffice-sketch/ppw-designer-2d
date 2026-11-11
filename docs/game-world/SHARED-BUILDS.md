# Shared builds

Open the 3D house and choose **Shared build**. The host chooses a job and character, then **Host this build**. A teammate opens the designer, chooses a character and job, and enters the invitation under **Join build**. Invitations grant editing rights to one build. Character and job names are visible to participants.

In Walk, **Build from here** opens the house tools while the person stays at the chosen spot. **Resume walking** continues the visit. Changes to separate objects merge automatically. When two edits touch the same field the editor asks which change to keep. Losing the network keeps edits on the device for retry. Leaving saves the local copy.

## Standalone host

The standalone host serves the application and persists builds in its own local database. From the repository, run `npm ci`, `npm run build`, then `npm run shared-build:serve -- --data=../olb-build-data`. Open `http://127.0.0.1:4199/demo` on the host machine. Two independent browser profiles can join the same build.

For teammates on other devices, set `--bind=0.0.0.0`, `--hostname=<your-hostname>`, `--cert=<certificate-path>` and `--key=<private-key-path>` on the same command. Teammates use the HTTPS address for that hostname and port. The host creates the room through the loopback address. Keep the data directory outside the served `dist` directory. Restart with the same data directory to reopen previously hosted builds.

## Hosted deployment

The deployed handler uses the existing shared-project PostgreSQL tables through the existing router. `GET /api/shared-projects/live/status` reports storage readiness without reading a participant or design. The studio session authorizes room creation. Invited editors receive individual, expiring sessions. Preview deployments permit read-only checks. The standalone host and automated tests use isolated storage.

Project geometry, editing history and avatar positions use separate records. A committed edit and its revision are stored atomically. Presence disappears after fifteen seconds without a heartbeat. Invitations and participant secrets are sent in request bodies or authorization headers and kept out of design exports.
