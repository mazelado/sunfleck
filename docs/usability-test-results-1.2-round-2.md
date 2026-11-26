# Usability test results (1.2, round 2)

Three sessions, run with the [test plan](usability-test.md) and its
[round 2 differences](usability-test.md#round-2-12), and filled in from the moderator's
forms. No names or other details about the participants: they're P1, P2 and P3, numbered
afresh. Round 1's figures are here to compare with.

- **Version tested:** `main` at commit `9193ea4` (the latest before the sessions), on
  2026-11-25
- **Moderator:** the maintainer · **Note-taker:** none

**Differences from the plan**, to weigh the results by:

- **Three people, all on iPhones with Safari.** The plan asks for three to five, with at
  least one Android phone. Nothing here shows how the app works on Android.
- **Background answers are the same for all three** (8 plants, "I don't" remember, iPhone,
  no plant app before). They may be true, or copied from the first form; check before
  relying on them.
- **Task 6 after task 4:** the dragon tree is in the living room, so watering the living
  room's plants in task 4 also waters it, and by task 6 it isn't due for days. P1 saw this
  ("It's due in 11 days, it's fine"), which is the right answer for the state the app was in.
  The other two put it off anyway. For the next round, task 6 should be about a plant that's
  still due then, or task 4 should leave the dragon tree out.
- **Times** were read off the clock to the minute, so a task that
  took 0 took under a minute, and each time is about a minute either way.

## Participants

| | Plants | Phone | Plant apps before | Comfort with apps (own words) |
|---|---|---|---|---|
| P1 | 8 | iPhone, Safari | No | "It's technology, I'm never comfortable with technology." |
| P2 | 8 | iPhone, Safari | No | — |
| P3 | 8 | iPhone, Safari | No | — |

## Task results

Result per participant: D done, H done with help, N not done, W wrong but thought done.
Ease is the median SEQ (1 = very hard, 7 = very easy). Times are in minutes. *Round 1* is how
many did it alone in [round 1](usability-test-results-1.0-round-1.md), out of 2, on a
desktop.

| # | Task | P1 | P2 | P3 | Done alone | Median time | Ease | Round 1 |
|---|---|---|---|---|---|---|---|---|
| 1 | Set up the app | D | D | D | 3/3 | 1 | 7 | skipped |
| 2 | Add a home and a room with a window | W\* | D | D | 2/3 | under 1 | 7 | 0/2, ease 3 |
| 3 | Add a plant | D | W | D | 2/3 | 1 | 7 | 0/2, ease 6 |
| 4 | Water the living room's plants | D | W\* | W\* | 1/3 | 1 | 7 | 0/2, ease 5 |
| 5 | Add yesterday's watering, with damp soil | W | D | D | 2/3 | 1 | 7 | 0/2, ease 5.5 |
| 6 | Put off a plant's watering until Monday | D\* | W\* | D | 2/3 | 1 | 7 | 0/2, ease 2.5 |
| 7 | Check a plant's light | D | D | D | 3/3 | 1 | 7 | 1/2, ease 4 |
| 8 | Add a photo, and crop it | W | D | H | 1/3 | 1 | 7 | 0/2, ease 4 |
| 9 | Change a pot size | D | D | D | 3/3 | 2 | 6 | 2/2, ease 4.5 |
| 10 | Is a plant safe for a cat? | D | D | D | 3/3 | 1 | 7 | 2/2, ease 6.5 |
| 11 | Invite someone | W | W | D | 1/3 | 2 | 7 | 1/2, ease 5 |
| 12 | Set up a morning reminder | W | W | W | 0/3 | 1 | 7 | 1/2, ease 5.5 |
| 13 | Say how much water was given | D | W | D | 2/3 | 1 | 7 | new |
| 14 | How often the soil was right | D | D | D | 3/3 | 1 | 7 | new |

\* As marked on the forms, but the plan's "done when" may count it differently:
- **Task 2, P1:** marked W for missing **Use my location**. The plan only asks for a site, a
  room and a south window, so it's done if those were there. (P3 also missed it, and was
  marked D.)
- **Task 4, P2 and P3:** marked W for watering plant by plant instead of **Water all**. The
  plan counts one at a time as done, if both living room plants were watered.
- **Task 6, P1:** nothing to put off (see the differences at the top).
  **P2:** chose **A week later**, which is after Monday; the app wouldn't nag before then.

**What happened, briefly** (for each task not done alone by everyone):

- **1:** all three done; P2 and P3 ran into the password rules first.
- **2:** P1 and P3 didn't use **Use my location** for the home.
- **3:** P2 said they were done before saving the plant. P3 was the only one to add a photo
  first.
- **4:** P2 and P3 watered each plant with its own button (P3 with the green tick), not
  **Water all**.
- **5:** P1 watered again today instead of adding yesterday's watering, but chose **Still
  wet** correctly ("I'm not sure I did that right."). P2 and P3 set the date and the soil.
- **6:** P3 snoozed it from Today straight away. P2 tried adding a schedule and the care
  plans before finding **Put off**. P1 went to the dragon tree's page, saw it was due in 11
  days, and left it.
- **8:**
  - P1 cropped the photo, but added it to the wrong plant, and it didn't become the cover
    ("I don't know.").
  - P2 did it, after taking **Edit** (the plant) for a way to edit the photo.
  - P3 missed the camera button on the cover and added the photo from the history section,
    then missed the crop step, and was helped.
- **9:** all done, but slowly: each went to the care guide, the pot in **About**, or both,
  before finding **Edit** at the top (P3: "Took me a while.").
- **11:**
  - P1 went to Today, then their profile (missed **Settings** there), then Settings and
    Household, typed the email, then scrolled down and pressed the household name's
    **Save**. No invitation was made.
  - P2 typed no email; they changed Ada's own role in the member list from Admin to Gardener,
    and pressed the household name's **Save** ("I don't know if I did that right.").
  - P3 looked in the plant's watering section two or three times, then found Settings and
    did it.
- **12:** all three opened Settings, Notifications, and stopped at the times: P1 saw the
  digest set for 8:00 and said that was it, P2 turned on the evening reminder and saved, P3
  saved the times. None added this device or another way to be reached. On an iPhone in
  Safari, **This device** can't be turned on: it only says to add Sunfleck to the Home
  Screen first, with no button.
- **13:** P2 watered the avocado but didn't add the amount. P1 used **Add details or another
  day…** next to the water button; P3 watered first, then added the amount in the history.

## SUS scores

| | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | 4 | 1 | 5 | 1 | 5 | 1 | 5 | 1 | 4 | 1 | 95 |
| P2 | 4 | 1 | 4 | 2 | 4 | 1 | 5 | 2 | 4 | 1 | 85 |
| P3 | 5 | 1 | 5 | 1 | 4 | 1 | 5 | 3 | 5 | 1 | 92.5 |

**Average:** 90.8 (lowest 85, highest 95). Round 1: 62.5, from two people (37.5 and 87.5),
so compare loosely, but this is well above the usual average of about 68, and above 80
("good"). As in round 1, ease ratings were high even on tasks not done: 13 of the 14 W or H
results were rated 6 or 7. The task results matter more than the ratings.

## Round 1's problems

Did the fix from 1.0 work? **Yes** (nobody hit it), **partly** (fewer people, or more
slowly), **no** (as in round 1), or **not seen** (the task didn't reach it). A *partly* or
*no* also goes under [new problems](#new-problems), with its severity.

| # | Round 1 problem | Fixed by | Task | Worked? | Notes |
|---|---|---|---|---|---|
| U1 | Snooze can't be found | **Put off care** on a plant's page; **Later** on Today | 6 | Partly | P3 at once from Today; P2 after trying schedules and care plans; P1 had nothing to put off. See U14 |
| U2 | Soil feedback on the wrong watering; past care logged as today | **Add earlier care**; the question says which watering | 5 | Partly | P2 and P3 did it. P1 logged today, with the right soil. See U15 |
| U3 | Watering a room's plants at once isn't found | **Water all 2 in Living room**; a room's page | 4 | Partly | P2 and P3 watered plant by plant. See U16 |
| U4 | Rooms are called "locations"; a room wasn't saved | "Rooms and spots"; **Getting started**; a question before leaving unsaved | 1, 2 | Yes | Everyone set up and added a room with a window |
| U5 | The plant form is long, and its room easy to miss | Room after the name; **More details** | 3 | Partly | P2 thought they were done before saving. See U17 |
| U6 | Cropping can't be found | Tapping the cover; **Crop** after adding a photo | 8 | Partly | P1 and P2 cropped; P3 missed the camera button and the crop step. See U18 |
| U7 | The light check is misread | The answer and advice first | 7 | Yes | All three found the answer and what to do |
| U8 | Inviting someone saves the household instead | **Invite someone** in its own card | 11 | No | P1 and P2 pressed the household name's **Save**. See U13 |
| U9 | The account menu goes unnoticed | **Settings** behind the gear | 11, 12 | Partly | All found Settings, but after detours (profile, Today, care guide, Plants). See U20 |
| U10 | The evening reminder looks like the whole setup | **This device** first | 12 | No | All three saved the times and stopped. On an iPhone in Safari, This device has no button. See U12 |
| U11 | Date fields' calendar button isn't noticed | Not changed (phones use their own picker) | 5, 6 | Yes | P2 and P3 set dates without trouble on the phone's picker |

## New problems

One row per problem, however many people hit it, numbered on from round 1. Severity: 4
catastrophe, 3 major, 2 minor, 1 cosmetic (see the
[test plan](usability-test.md#scoring-and-rating)). Problems rated 3 or 4 are fixed before 1.2.

| # | Problem (what happened, where) | Who hit it | Severity | Fix, or issue |
|---|---|---|---|---|
| U12 | **Reminders seem set up when they aren't** (U10 again). On an iPhone in Safari, **This device** is a line of text with no button; the times and their **Save** below look like the whole setup, and saving them with nowhere to send says nothing about it | P1, P2, P3 | 3 | Fixed in [#241](https://github.com/mazelado/sunfleck/pull/241): on iPhone, **This device** lists the steps to add Sunfleck to the Home Screen; while no channel exists, the times and saving them say nothing is sent yet |
| U13 | **Inviting someone saves the household instead** (U8 again). The invite card's **Create invitation** is missed; the household name's **Save**, the last button on the page, is pressed instead. P2 also took the member list's role menu for part of inviting, and tried to make the only Admin a Gardener | P1, P2 | 3 | Fixed in [#241](https://github.com/mazelado/sunfleck/pull/241): the household name's **Save** stays off until the name changes; leaving with an email typed but nobody invited asks first. Not done: no role menu on your own row when you're the only Admin |
| U14 | **Put off is found late from a plant's page** (U1, partly). P2 tried adding a schedule and the care plans first. (P1's task didn't test it: see the differences at the top) | P2 | 2 | Fixed in [#254](https://github.com/mazelado/sunfleck/pull/254): when care is due, the **⋯** next to its button is a **Later** button, as on Today |
| U15 | **Past care logged as today** (U2, partly). P1 logged today's watering instead of yesterday's, unsure it was right. One in three, on a task done now and then, but the wrong date teaches the prediction wrongly | P1 | 2 | Fixed in [#250](https://github.com/mazelado/sunfleck/pull/250): the confirmation after one-tap care offers **Add details or another day…** |
| U16 | **Water all for a room isn't used** (U3, partly). Watering plant by plant still gets it done, just with more taps | P2, P3 | 1 | [#244](https://github.com/mazelado/sunfleck/issues/244): later; nothing lost |
| U17 | **A new plant isn't saved** (U5, partly). P2 said they were done with the form still open. The question before leaving only shows when leaving, which they hadn't | P2 | 2 | [#245](https://github.com/mazelado/sunfleck/issues/245): not reproduced; **Save** stays in view on an emulated iPhone. To try on a real iPhone, with the keyboard open |
| U18 | **Adding a photo to a plant is uneven** (U6, partly). P3 missed the camera button on the cover and added it from the history, then missed **Crop**; P2 took **Edit** for editing the photo; P1 added it to another plant (cause not noted) and it didn't become the cover. P3 asked for a crop frame that's easier to stretch in every direction | P1, P2, P3 | 2 | Partly fixed in [#253](https://github.com/mazelado/sunfleck/pull/253): the cover's button says **Add a photo**, and **Crop** stands out and stays longer. Still open in [#246](https://github.com/mazelado/sunfleck/issues/246): the crop frame's handles |
| U19 | **The pot size is hard to change.** All three looked in the care guide or tapped the pot in **About** before finding **Edit** at the top; the slowest task (2 minutes each) and the lowest ease (5 to 6). P3's hardest task | P1, P2, P3 | 2 | Fixed in [#251](https://github.com/mazelado/sunfleck/pull/251): **Change** next to the pot in **About** opens the form at the pot size |
| U20 | **Settings is found after detours** (U9, partly). P1 looked in their profile, P2 in Today, the care guide and Plants, P3 in the plant's watering section | P1, P2, P3 | 2 | Fixed in [#252](https://github.com/mazelado/sunfleck/pull/252): the gear at the top is labelled **Settings** |
| U21 | **The amount of water is easy to skip.** It's a second step (**Add details or another day…**, or the history), after the water button | P2 | 2 | Fixed in [#250](https://github.com/mazelado/sunfleck/pull/250), with U15: **Add details or another day…** in the confirmation |
| U22 | **The care guide is hard to read**, and is looked in for things it doesn't hold (the pot). "A lot of numbers and letters" (P2) | P1, P2, P3 | 1 | Later: plain words before figures in the care guide |
| U23 | **The password rules come as a surprise** in setup | P2, P3 | 1 | Later: show the rules under the field before typing |
| U24 | **Use my location is missed** when adding the home, so the weather has no place | P1, P3 | 1 | Later: say what the location is for next to the button |

## What went well

- **Setting up (task 1):** all three, ease 7, with **Getting started**; P1 and P2 called it
  the easiest thing.
- **The light check (task 7):** all three found the answer and what to do (round 1: one in
  two, misread).
- **Toxicity (task 10):** all three, at once, from the plant's page.
- **The care history (task 14):** all three found how often the soil was right, after a
  little scrolling.
- **Dates (task 5):** the phone's own date picker gave no trouble.
- **SUS 90.8**, up from 62.5. P2 and P3 said they'd use it; P1 would "if I cared about my
  plants".

## What they said

- "I'm not sure I did that right." (P1, task 5)
- "It's due in 11 days, it's fine." (P1, task 6, on the dragon tree)
- "I don't know." (P1, task 8)
- "I don't like to take care of plants." (P1, beside SUS question 1)
- "It was easy to navigate." (P1, beside SUS question 2)
- "It's technology, I'm never comfortable with technology." (P1, beside SUS question 9)
- "If I cared about my plants, yes." (P1, would they use it)
- "The app is pretty cool." (P1, debrief)
- "I don't know if I did that right." (P2, task 11)
- "If you go to care guide there were a lot of numbers and letters." (P2, debrief)
- "If it needs internet to work." (P2, what would stop them using it)
- "Just needed to read." (P3, task 7)
- "Took me a while." (P3, task 9)
- "Maybe make the crop tool able to expand in all directions more easily." (P3, debrief)
- "Just takes a little bit to get used to." (P3, debrief)

## Not covered

What this test couldn't show, and how to check it another way:

- Android phones: all three used iPhones.
- Notifications from the Home Screen app: nobody added Sunfleck to the Home Screen, so web
  push on iPhone wasn't tried.
- Putting off care that's actually due (task 6): see the differences at the top.
- Using it without internet, which P2 asked about.
- AI features and plant identification (off during the test).
- Reminders arriving over days, and the evening reminder.
- Large households, many plants, more than one person caring at once.
- Re-framing a profile picture (1.1): it needs the participant's own photo, so it isn't a
  task.
- How the history and the soil summary read after months of a person's own answers, rather
  than the demo's.
