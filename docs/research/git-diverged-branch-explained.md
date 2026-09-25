# Why `git push` was refused today, and what `git pull` did about it

Branch: `LFT-24`. Date: 2026-09-18.

## 1. What "diverged" means

This morning `LFT-24` was the same on your laptop and on GitHub. Both pointed at commit `e49d2f4`.

Then two things happened at the same time, in two different places.

- Locally, your session merged three research branches and added a docs commit. That is 6 new commits. None were pushed.
- On GitHub, you merged pull request #32 into `LFT-24`. That created one commit, `637d27c`, that your laptop had never seen.

Now both sides have new work, but neither side has the other's work. That is what "diverged" means.

```
                     local LFT-24 (6 commits ahead)
                     9408b2b - 88117ca - 3497f53 - 4124751 - ...
                    /
  ... - 5c334b8 - e49d2f4        <- common base, last shared commit
                    \
                     637d27c     <- origin/LFT-24 (1 commit behind you, 1 ahead of you)
                     (merge of PR #32)
```

`git status` reported this as "ahead 6, behind 1". Ahead counts your commits GitHub lacks. Behind counts GitHub's commits you lack.

## 2. Why push was refused

A push moves the remote branch pointer forward to your latest commit. Git only allows that when your commit already contains everything the remote branch has. Here, `637d27c` is not in your history. Moving the pointer would have thrown that commit away. Git will not silently discard commits it can see on the remote but not on your side, so it rejects the push and asks you to fetch first.

## 3. What `git pull --no-rebase origin LFT-24` does

`git pull` is two commands glued together: `git fetch` followed by `git merge`. Looking at them separately makes the result easier to trust.

### Before fetch

Your laptop has a stale idea of where GitHub's branch is. The remote-tracking branch `origin/LFT-24` still points at `e49d2f4`.

```
  e49d2f4 - 9408b2b - 88117ca - 3497f53 - 4124751 ...   <- LFT-24 (local)
  ^
  origin/LFT-24 (stale copy of GitHub)
```

### After fetch

`git fetch` downloads GitHub's new commits and moves `origin/LFT-24` to match GitHub. Your own branch `LFT-24` does not move. Nothing in your working files changes.

```
  e49d2f4 - 9408b2b - 88117ca - 3497f53 - 4124751 ...   <- LFT-24 (local, untouched)
     \
      637d27c                                            <- origin/LFT-24 (now correct)
```

### After merge

`git merge` creates one new commit that has two parents: your latest local commit and `637d27c`. This is the merge commit. After it, your branch contains both lines of work, so a push is allowed again.

```
  e49d2f4 - 9408b2b - 88117ca - 3497f53 - 4124751 - 0e0e42f   <- LFT-24 (local)
     \                                              /
      637d27c ------------------------------------      <- origin/LFT-24
```

In this repo the merge commit is `0e0e42f`. You can see the shape above with `git log --oneline --graph -12`.

## 4. Why merge and not rebase here

`git pull --rebase` would have done something different. It would lift your 6 commits off, move your branch to `637d27c`, and replay the 6 commits on top. Every replayed commit gets a new id.

```
  e49d2f4 - 637d27c - 9408b2b' - 88117ca' - 3497f53' - 4124751' ...   <- LFT-24 after rebase
                        (same changes, new commit ids, history rewritten)
```

Rebase gives a straighter history, but it rewrites commits and can ask you to fix the same conflict several times, once per replayed commit. Merge keeps every existing commit as is and asks about a conflict only once, which makes it the safer first choice when you are new to this.

## 5. What a conflict is and why it happened in one file

Git merges automatically when the two sides changed different lines. It stops and asks you when both sides changed the same lines in different ways.

That happened in `docs/.vitepress/config.ts`. Your local commits added a Research block to the sidebar. PR #32 also added a Research block to the sidebar, in the same place. Git could not know which one you wanted, so it wrote both into the file with markers:

```ts
<<<<<<< HEAD
      { text: "Calendar Rendering Library", link: "/research/calendar-rendering-library" },
=======
      { text: "Calendar rendering library", link: "/research/calendar-rendering-library" },
>>>>>>> 637d27c
```

The lines between `<<<<<<< HEAD` and `=======` are yours. The lines between `=======` and `>>>>>>> 637d27c` came from GitHub. To resolve it, keep one version (or combine them), delete the three marker lines, then run `git add docs/.vitepress/config.ts` and `git commit`.

## 6. The habit to build

- Before you push, run `git fetch` and then `git status`.
- If status says "behind", pull first, then push.
- If a pull stops on a conflict, open the file, fix the markers, `git add`, `git commit`, then push.

## 7. Cheat sheet

```bash
git fetch origin                        # learn what GitHub has, change nothing locally
git status                              # look for "ahead" and "behind"
git pull --no-rebase origin LFT-24      # fetch + merge; fix conflicts if asked
git push origin LFT-24                  # now accepted
```
