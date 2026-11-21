# The six roles in a shared house: one rule for both fronts

Written 2026-11-22 by Fable, from stage 11, step 7 (the game). The plan names six roles for stage 8 (many players) and for the game's multiplayer: owner, builder, plumber, electrician, painter, viewer. The web app has no rule for them yet. The game needed one to let two players build in one house, so it wrote this one down. Stage 8 is to copy it, or to change it here first and then in both fronts.

## What each role may do

| Role | Tools in its belt | What it may change in the design |
|---|---|---|
| owner | every tool | everything |
| builder | place, remove, door and window, room, dig; lifts and moves things | rooms, openings, placed things, levels, roof, site, the ground (`terrainCuts`). Not paint, not services |
| plumber | dig, pipe, fixture, remove | runs of the systems `cold-water`, `hot-water`, `waste`, `fire-water`, `ventilation`; fixtures that have a port of one of them; the ground |
| electrician | dig, cable, fixture, remove | runs of the systems `electrical`, `data`, `refrigerant`; fixtures that have a port of one of them; the ground |
| painter | paint | a room's `wallPaint`, `floorFinish`, `floorTiles` |
| viewer | none | nothing |

The house has one owner: the player (or the account) that holds the design. Nobody joins as owner.

## The rule is kept twice

1. In the hand: a player's tool bar offers only the tools of the role.
2. Where the design is held: the check looks at WHAT CHANGED between the design that is held and the design that is offered, never at what the offering side says it did. An offer is taken only when every difference is the role's to make:
   - a difference under `services`: each run that was added, removed or changed must be of a system of the role (both what it was and what it is now), and each such fixture of a kind of the role; a run or a fixture without an `id` cannot be told apart, so the offer is refused;
   - a difference in `terrainCuts`: allowed to builder, plumber and electrician;
   - in `rooms`: a room more, a room less or another order is the builder's; inside a room the keys `wallPaint`, `floorFinish` and `floorTiles` are the painter's, every other key the builder's;
   - a difference in any other key of the design is the builder's.
   A refusal carries one plain line that says why ("paint and floor finishes are the painter's, not the builder's").

## Versions

Every edit that is taken makes a new version number of the design. An offer names the version it was made from. An offer made from an old version is refused, and the offering side gets the design as it is now; nothing is merged blind (the plan's sync rule).

## What the game does with it (so the web can match)

- The host of a house is its owner and holds the design. A guest gets the whole design with its version on joining and after every edit that was taken.
- A guest edits its own copy with the ordinary tools and offers the whole result. The host checks version and role as above, makes the offer the house, saves it, and sends it to the other guests; the offering guest is only told the new number.
- A guest asks for its role in the address it joins by; the host gives what is asked. There is no invitation, no approval and no password yet: that belongs to stage 8.

## Open, for stage 8 to decide

- Who gives a role, and how it is taken back.
- Whether a plumber may remove a builder's thing that stands in the way of a pipe (today: no).
- Whether the builder may paint (today: no; the painter may not move furniture either).
- Air conditioning as a trade of its own (today its line, `refrigerant`, is the electrician's, and `ventilation` the plumber's).
- Presence: who is where. The game shows each player's figure with its role over its head; a thing that a player carries is seen by the others only when it is set down.
