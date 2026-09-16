# Triage Labels

The skills speak in terms of five canonical triage roles. This file maps those roles to the actual label strings used in this repo's issue tracker.

| Label in mattpocock/skills | Label in our tracker | Meaning                                  |
| -------------------------- | -------------------- | ---------------------------------------- |
| `needs-triage`             | `needs-triage`       | Maintainer needs to evaluate this issue  |
| `needs-info`               | `needs-info`         | Waiting on reporter for more information |
| `ready-for-agent`          | `ready-for-agent`    | Fully specified, ready for an AFK agent  |
| `ready-for-human`          | `ready-for-human`    | Requires human implementation            |
| `wontfix`                  | `wontfix`            | Will not be actioned                     |

When a skill mentions a role (e.g. "apply the AFK-ready triage label"), use the corresponding label string from this table.

Edit the right-hand column to match whatever vocabulary you actually use.

## Bootstrap

All five labels exist in `sachinkmohan/teach-direct`. If `gh issue edit --add-label` ever fails with `'<label>' not found`, recreate the missing one:

```bash
gh label create needs-triage --description "Maintainer needs to evaluate this issue" --color e4e669
gh label create needs-info --description "Waiting on reporter for more information" --color d876e3
gh label create ready-for-agent --description "Fully specified, ready for an AFK agent" --color 0e8a16
gh label create ready-for-human --description "Requires human implementation" --color 1d76db
gh label create wontfix --description "This will not be worked on" --color ffffff
```

The optional `wayfinder:map` and `wayfinder:<research|prototype|grilling|task>` labels used by `issue-tracker.md` also exist.
