# World Finish: base-publication hard boundary

28 October 2026. Read-only audit; no branch, worktree or remote mutation performed.

## Verified graph

| Ref | Commit | Relationship |
|---|---|---|
| Main / common merge base | `3eefbf7646f2b5c76e5297f7836e6e0336e8f1a2` | Shared ancestor of PRs #52, #53 and #54 |
| PR #52, open and unmerged | `56d852d1f2f5d7342b9e02194964d6b998c795c7` | Descends from the common base; is not an ancestor of either published World head |
| PR #53, published Walk head | `712b5b27706b8661c38f1e28a2a582826b7d7d05` | Nine published commits after the common base |
| PR #54, published Site head | `85d64cfcc50a38f9cc9eac66f2a2a7e0b08c2de9` | Seven published commits after the common base |

The merge base of #52 and each World head is the main commit above. The World series and #52 diverge there. The PR #52 API result reports `state=OPEN`, `mergedAt=null`, and the exact head above.

## Why the instructions conflict

Finish gate 1A requires rebasing both World branches onto the unmerged #52 head and updating the existing PRs. Section 0.4 explicitly prohibits both force-push and merge. We do not assume an exception for a local integration merge.

A normal Git push may advance an existing remote branch only when its current published tip is an ancestor of the proposed tip: `git merge-base --is-ancestor <old-remote-tip> <new-tip>` must succeed. Rebasing the nine/seven published World commits onto #52 recreates them with new parentage and commit IDs. Their existing published tips are not ancestors of those rebased tips. Publishing that rewritten series to the existing PR branches therefore requires a non-fast-forward update.

This is not a technical inability to integrate #52's source. It is a conflict between the required ancestry change, the existing published PR branches, and the explicit publication restrictions.

## Alternatives considered

| Alternative | Why it does not satisfy this instruction |
|---|---|
| Rebase, then force-push (including force-with-lease) | Performs the expressly prohibited non-fast-forward publication. A lease does not make it a normal push. |
| Merge #52 into each existing branch | Preserves history and permits normal pushes, but performs an expressly prohibited merge and is not the requested rebase. |
| Rebase and add an ancestry-preserving bridge/integration merge | Makes a normal push possible by retaining the old tip as an ancestor, but still performs a merge. No hidden merge or synthetic history workaround is proposed. |
| Cherry-pick #52, or apply its patch, onto the World tips | Can preserve normal-push history and integrate the source, but does not rebase the World series onto #52 and does not make the #52 head its ancestor. It must not be labelled a rebase. |
| Publish rebased replacement branches/new PRs | Can avoid rewriting the old branches, but does not update the required existing PRs #53 and #54. |
| Change each PR's comparison base to #52 | Changes the review comparison only; it neither incorporates #52's source nor rebases the World branch. |
| Perform only a local rebase and leave it unpublished | Leaves the required PRs and their previews on the old ancestry, so does not complete gate 1A. |

Decision: honor the explicit hard boundary. Leave both published World PRs and PR #52 intact; record gate 1A as OPEN. No merge, force-push, relabelled cherry-pick or branch-replacement workaround was performed. The existing Fix 1 results remain historical evidence, not proof that the new Finish gates pass.
