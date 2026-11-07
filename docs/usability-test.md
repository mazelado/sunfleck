# Usability test (1.0)

A task test with a few people from real households, done cold, to find what the click counts
in [usability.md](usability.md) can't: whether people understand the screens. Each session
ends with the System Usability Scale (SUS), a standard 10-question score that can be compared
with other apps and with later releases.

- **Who runs it:** the maintainer (the *moderator*), with this plan.
- **What's needed:** 3 to 5 people, about 45 minutes each, a test copy of Sunfleck, and the
  printed [forms](usability-test-forms.md).
- **Where the results go:** a copy of the [results template](usability-test-results.md),
  filled in after the sessions. Problems found are fixed before the 1.0 release.
  Round 1: [results](usability-test-results-1.0-round-1.md).
- **Alongside it:** a [heuristic review](heuristic-review.md) of the same screens, done
  without participants.

- [Participants](#participants)
- [A test copy of Sunfleck](#a-test-copy-of-sunfleck)
- [The session](#the-session)
- [The tasks](#the-tasks)
- [What to note](#what-to-note)
- [Scoring and rating](#scoring-and-rating)
- [Afterwards](#afterwards)

## Participants

**Three to five people.** Five finds most of the problems that a larger group would; three is
enough to find the worst ones. More sessions after that mostly find the same problems again.

Aim for a mix:

- **Experience:** someone who keeps a lot of plants, and someone with just a few.
- **Phones:** at least one iPhone and one Android phone, each using their own.
- **Comfort with apps:** at least one person who isn't comfortable with technology.
- **Fresh eyes:** nobody who has used Sunfleck or seen it being built. Household members of
  the maintainer only if they haven't.

Tell them beforehand:

- It takes about 45 minutes.
- It tests the app, not them.
- No account or personal data of theirs is needed.

## A test copy of Sunfleck

Use a separate copy, never the household's own Sunfleck: participants add and change things.
It runs the code that's about to be released (`main`), built from the repository.

**One copy, used twice per session:** empty for part A (setting up), then filled with the demo
household for part B (everyday care). On any computer with Docker, e.g. a laptop:

```bash
git clone https://github.com/mazelado/sunfleck.git sunfleck-test
cd sunfleck-test/docker
cp env.example .env   # set SECRET_KEY (openssl rand -base64 48) and TIME_ZONE
docker compose -f compose.yaml -f compose.build.yaml up -d --build
```

**Reaching it from the participant's phone:** phones need HTTPS for Sunfleck to work as an
app. The simplest way is [Tailscale](https://tailscale.com/):

1. On the laptop, run `tailscale serve --bg 8000`. It prints an address.
2. Put that address in `.env` (`ALLOWED_HOSTS`, `CSRF_TRUSTED_ORIGINS`, `SUNFLECK_PUBLIC_URL`),
   and run the `up -d` command again.
3. Add the participant's phone to the Tailscale network for the session, or lend them a phone
   that's on it. See [Reach it from your phone](install.md#reach-it-from-your-phone-https).

**Before each session, start from an empty copy** (this deletes the test copy's data):

```bash
docker compose -f compose.yaml -f compose.build.yaml down -v
docker compose -f compose.yaml -f compose.build.yaml up -d
```

**Between part A and part B, fill in the demo household** (5 plants with photos, two rooms,
care due today). This empties the copy again first:

```bash
docker compose -f compose.yaml -f compose.build.yaml down -v
docker compose -f compose.yaml -f compose.build.yaml up -d
docker compose cp ../docs/screenshots/photos sunfleck:/tmp/demo-photos
docker compose exec sunfleck /app/entrypoint.sh manage demo_household --photos /tmp/demo-photos
```

The demo account is `ada@example.com`, password `a long and unusual passphrase`. Sign the
participant's phone in before part B starts, so the password isn't part of the test.

**Plugins:** leave AI and plant identification off; they need accounts and cost money, and
the test is about the app itself. The weather plugin is on in the demo household, from a
stored forecast.

## The session

About 45 minutes. One moderator; a second person taking notes helps, but isn't needed.

1. **Welcome (3 min).** Read this out, in your own words:

   > Thanks for helping. I'm testing an app for looking after house plants, not you: if
   > something is hard, that's the app's fault, and exactly what I need to find. I'll give
   > you some things to do, one at a time. Please think out loud as you go: what you're
   > looking for, what you expect, what surprises you. I won't help while you try, because I
   > need to see where you'd get stuck on your own; you can give up on any task at any time.
   > I'll take notes, but I won't record your face or voice, and your name won't be in them.
   > Is that all right?

   Note their answer on the forms. If they'd rather not, stop there.

2. **Background (2 min).** Ask how many plants they have, how they remember to look after
   them now, and which phone they use. Note it.

3. **Part A: setting up (10 min).** Tasks 1 to 3, on the empty copy.

4. **Part B: everyday use (20 min).** Fill in the demo household, sign the phone in, then
   tasks 4 to 12.

5. **SUS questionnaire (3 min).** They fill it in alone, on paper, straight after the tasks,
   before any discussion.

6. **Debrief (5 min).** Then the debrief questions on the forms. Now you may explain anything
   they got stuck on.

**While they work:**
- **Wording:** read each task out exactly as written, and give them the card with it.
- **Don't lead:** never point or name a button. If they ask, answer "What would you try?"
- **Silence:** if they go quiet, ask "What are you thinking?"
- **Giving up:** a task fails when they give up, say they think it's done when it isn't, or
  take over 5 minutes. Then help them through it, so the next task starts from the right
  place, and note that you helped.
- **After each task:** ask the one-question ease rating on the forms (SEQ, 1 to 7).

## The tasks

Each is a goal, in everyday words, without the app's own words (no "log", "schedule",
"location", "care type"). The wording matters: read it as written.

### Part A: setting up (empty copy)

| # | Task, as read out | Done when |
|---|---|---|
| 1 | "You've just installed this app for your household. Get it ready to use, with yourself as the person in charge." | The setup page is filled in and Today shows |
| 2 | "Add your home, and the room where you keep most of your plants. That room has a big window facing south." | A site, a room, and a south window in it |
| 3 | "Add one of your own plants that lives in that room. Use its real kind, if you know it." | A plant with that room, and a species or care profile, with a watering schedule |

### Part B: everyday use (demo household)

| # | Task, as read out | Done when |
|---|---|---|
| 4 | "Some plants need watering today. You've just watered all the ones in the living room. Let the app know." | Both living room plants are watered (one at a time, or all at once) |
| 5 | "You watered the aloe yesterday but forgot to note it. Add it now, and that the soil was still damp when you checked." | A watering yesterday, with "still wet" |
| 6 | "You're away until Monday. Make sure the app doesn't nag you about the dragon tree before then." | The dragon tree's watering snoozed (or its date moved) to Monday |
| 7 | "Find out whether the golden pothos gets enough light where it is, and what you could do about it." | They find the light check and say what it suggests |
| 8 | "Take a photo of something near you as if it were the avocado seedling, add it to that plant, and make it show only the middle of the photo." | A new photo on the avocado, cropped |
| 9 | "You've moved the flaming Katy into a bigger pot, 17 cm across. Update it." | Pot diameter 17 cm |
| 10 | "Is the golden pothos safe to keep if you had a cat?" | They find the toxicity notice and answer "no" |
| 11 | "Someone you live with wants to help with the watering. Let them in." | An invitation, with the Gardener role |
| 12 | "You'd like a reminder on your phone each morning about what needs doing. Set that up." | A notification channel added (this device or another), or they say how they would |

Tasks 4 to 6 and 9 have click budgets in [usability.md](usability.md): compare their paths
with the shortest ones there.

## What to note

On the [observation sheet](usability-test-forms.md#observation-sheet), for each task:

- **Result:**
  - **Done:** done without help.
  - **Done with help:** done, but you helped or answered a question.
  - **Not done:** given up, wrong, or over 5 minutes.
  - **Wrong but thought done:** they believed they'd finished, but hadn't. Worth noting
    especially, as it means the app didn't make clear what happened.
- **Time:** from finishing reading the task to saying they're done.
- **Path:** where they went first, and each wrong turn: pages, menus, buttons.
- **Hesitations:** pauses of over 5 seconds, back-and-forth, rereading.
- **Their words:** quote exactly what they say when confused or surprised ("where's...?",
  "I thought this would...").
- **Ease (SEQ):** their answer to "How easy or hard was that, from 1 (very hard) to 7 (very
  easy)?"

Write down what you saw, not why you think it happened; that comes later.

## Scoring and rating

**SUS score** (0 to 100), per person, from their 10 answers (1 to 5):
1. For the odd-numbered statements (1, 3, 5, 7, 9): score = answer − 1.
2. For the even-numbered statements (2, 4, 6, 8, 10): score = 5 − answer.
3. Add up the ten scores and multiply by 2.5.

Average the participants' scores. As a rough guide from published studies: about 68 is
average, above 80 is good, and below 50 is a sign of serious problems. With five people the
average is only a rough figure: compare it with later tests, not too precisely with other
apps.

**Problems:** list each problem once, however many people hit it, in the
[results template](usability-test-results.md#problems). Rate each with the severity scale
used in the heuristic review:

| Severity | Meaning | Before 1.0 |
|---|---|---|
| 4: catastrophe | People can't complete a core task, or lose data | Must fix |
| 3: major | People get stuck or make mistakes, or complete it only with help | Must fix |
| 2: minor | Slows people down or confuses them, but they recover | Fix if small |
| 1: cosmetic | Noticed, no effect on the task | Later |

Rate higher when more participants hit it, and when it's on a task people do daily (4 to 6)
rather than once (1 to 3).

## Afterwards

1. Fill in the results template within a day, while it's fresh: each person's results,
   their SUS score, and the problems with severities.
2. Share the filled-in results (without names) in an issue or a pull request. Fixes for the
   problems rated 3 and 4 go in before 1.0. The rest become issues.
3. Note what the test couldn't show: AI features, plant identification, notifications
   arriving over days, and large households.
4. Shred the paper forms once the results are written up.
