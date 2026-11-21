# When is a pipe or a cable connected? One rule for both fronts

Written 2026-11-21 by Fable, from stage 11, step 4 (the game). It is the check that `INVENTORY.md` asks for under "What is missing", point 5. The game has it and shows it. The web is to copy it in stage 2 or 7, so that both fronts say the same of the same design.

## What the web has today

- It lists BROKEN links only: an end that names a fixture or a junction that is gone, on another floor, of another system, or with no known height (`src/designer/serviceConnections.ts:175-222`).
- It never follows a line from one end to the other. A design where nothing is tied at all is reported as complete (`api/_lib/designMcp.ts:345, 352`).
- No kind of fixture is marked as a supply.

## The rule

It reads only what the saved design holds. Nothing is guessed from two runs touching or crossing, as on the web today.

1. An END of a run is TIED to a port when the run names a fixture and a port there (`startConnection`, `endConnection`) and the web's own test holds (`linkedPort`, `src/designer/serviceConnections.ts:109-115`): the fixture exists, it is on the run's storey, the port's name is the run's system, the fixture's kind has that port, and the port's height is known. It is JOINED at a junction when its point names one (`junctionId`) that exists on the same storey for the same system. An end that names a port or a junction that fails these tests is BROKEN. An end that names nothing is LOOSE.
2. Runs are one LINE when they are tied to the same port of the same fixture, or share a junction (also through a point in the middle of a run).
3. A run is JOINED when both its ends are tied or joined.
4. A system may need a SOURCE: a kind of fixture a line must reach.

   | System | The fixture a line must reach |
   |---|---|
   | `electrical` | `electrical-board` |
   | `cold-water` | `mains-tap` |
   | `waste` | `sewer-connection` |
   | `data` | `network-switch` |
   | `refrigerant` | `outdoor-ac` |
   | `hot-water`, `ventilation`, `fire-water` | none of the thirteen kinds: step 3 is all there is |

5. A run WORKS when it is joined and, where its system needs a source, its line reaches one.

## What is said, always in words

Never by colour alone. One of these, for every run:

| State | The words |
|---|---|
| works, system with a source | "CONNECTED. It reaches an electrical board." (a mains tap; a drainage connection; a network switch; an outdoor unit) |
| works, system without a source | "Connected at both ends." |
| joined, no source on the line | "Tied at both ends, but it does NOT work. No electrical board is on this line: nothing feeds it." |
| one end loose | "NOT connected: its start is loose." or "its end is loose." |
| both ends loose | "NOT connected: both its ends are loose." |
| a broken tie | "NOT connected: its end is cut off, the fixture it was tied to is gone." (or: its fixture is on another storey; its fixture has no connection for this system; the height of that connection is not set; the junction it was joined at is gone) |

In a view from above a run that works is drawn as a whole line and one that does not as a line of dashes. In the world an end that is tied to nothing has a collar on it. Shape, not colour.

## What the rule cannot say yet

- Whether the line is big enough, safe, or to code. It is a check of the drawing, not a design of the installation: the web's own words for its services stand ("not hydraulic or electrical certification").
- Hot water: no kind of fixture makes it. Ventilation and fire water: none feeds them.
- Two storeys: nothing in the design links a run on one storey to a run on another.
- A drainage connection has no height until one is typed, so nothing can be tied to it (`src/designer/serviceConnections.ts:54-55`).

## Proof

In the game repo (private): the rule with its five steps at the head of the function, four tests of it, and a scene that lays a conduit from a board on a house through a trench to a box and reads "CONNECTED", then takes the box away and reads "NOT connected: its end is loose." The file that scene saves passes this repo's own server checks, strict services schema, load and tie resolver without a change (run from the game repo; this repo is only read).
