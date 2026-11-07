# Usability test results (1.0, round 1)

Two sessions, run with the [test plan](usability-test.md) and filled in from the moderator's
notes. No names or other details about the participants: they're P1 and P2.

- **Version tested:** `main` at about commit `c8cf911` (with the Today menu fix, #166, and
  the cover photo button, #167), on 2026-11-06 and 2026-11-07
- **Moderator:** the maintainer · **Note-taker:** none

**Differences from the plan**, to weigh the results by:
- **Desktop:** both sessions were on a desktop PC, not the participants' phones, so a stored
  photo stood in for a new one (task 8).
- **Task 1 skipped:** the moderator judged first-time setup too technical for these
  participants. In practice it's done by whoever installs Sunfleck.
- **Starting state:** in P2's part A, the demo household seems to have been loaded already: they
  saw an existing place and the aloe. That likely contributed to the plant going into the
  wrong home in task 3.
- **Only two people:** the plan asks for three to five, so the SUS average is very rough.

## Participants

| | Plants | Phone | Plant apps before | Comfort with apps (own words) |
|---|---|---|---|---|
| P1 | — | (desktop) | — | — |
| P2 | — | (desktop) | — | — |

## Task results

Result per participant: D done, H done with help, N not done, W wrong but thought done.
Ease is the median SEQ (1 = very hard, 7 = very easy). Times weren't recorded.

| # | Task | P1 | P2 | Done alone | Median time | Ease |
|---|---|---|---|---|---|---|
| 1 | Set up the app | — | — | skipped | — | — |
| 2 | Add a home and a room with a window | N | N | 0/2 | — | 3 |
| 3 | Add a plant | W | W | 0/2 | — | 6 |
| 4 | Water the living room's plants | W | W | 0/2 | — | 5 |
| 5 | Add yesterday's watering, with damp soil | W | W | 0/2 | — | 5.5 |
| 6 | Put off a plant's watering until Monday | N | W | 0/2 | — | 2.5 |
| 7 | Check a plant's light | D* | W | 1/2 | — | 4 |
| 8 | Add a photo, and crop it | N | N | 0/2 | — | 4 |
| 9 | Change a pot size | D | D | 2/2 | — | 4.5 |
| 10 | Is a plant safe for a cat? | D | D | 2/2 | — | 6.5 |
| 11 | Invite someone | D | W | 1/2 | — | 5 |
| 12 | Set up a morning reminder | W | D | 1/2 | — | 5.5 |

\* P1 found the light check and its verdict, but suggested their own fix rather than reading
the app's advice.

**What happened, briefly:**
- **2:**
  - P1 made the place and started a room, but the room wasn't saved and it had no window.
  - P2 named the place "living room", then couldn't find how to add a room ("There's no add
    button anywhere!").
- **3:**
  - P1 ended with no care profile and not in the room. They thought they were done twice
    before the end of the form.
  - P2 put the plant in a room of another home ("how do I add it to a room?").
- **4:** both watered plants one at a time from Plants, without regard to the room. Neither
  used Today's **Water all** for the room.
- **5:** both tapped **Still wet** on the timeline, which marked the previous watering.
  Neither recorded a watering yesterday; P2 recorded today's watering and a fertilizing.
- **6:**
  - Neither found snooze. P1 spent over 25 clicks across every page ("when?") and rated
    the task 1.
  - P2 turned on evening notifications instead.
- **7:** P2 read "Is this spot bright enough?" as saying the light was fine ("it's good").
- **8:** both added the photo, but neither found **Crop**. P2 tapped, right-clicked and
  dragged the cover photo. P1 used the new camera button on the cover, then gave up.
- **11:** P1 found the account menu after visiting every page. P2 typed the email and pressed
  the household's **Save**, so no invitation was made.
- **12:** P1 turned on the evening reminder and thought that was it, without adding a way to
  be reached. P2 added "this device", which counts.

## SUS scores

| | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Q9 | Q10 | Score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P1 | 5 | 2 | 4 | 1 | 4 | 1 | 5 | 2 | 5 | 2 | 87.5 |
| P2 | 2 | 4 | 2 | 5 | 4 | 1 | 2 | 4 | 1 | 2 | 37.5 |

**Average:** 62.5 (lowest 37.5, highest 87.5). That's below the usual average of about 68.
The two scores are far apart, and with two people the average is only a rough figure. P1
rated tasks as easy (6 or 7) even when they weren't done, a common pattern: the task results
matter more than the ease ratings here.

## Problems

Severity: 4 catastrophe, 3 major, 2 minor, 1 cosmetic (see the
[test plan](usability-test.md#scoring-and-rating)). Rated higher for daily tasks (4 to 6)
and when both participants hit a problem. Problems rated 3 or 4 are fixed before 1.0.

| # | Problem (what happened, where) | Who hit it | Severity | Fix, or issue |
|---|---|---|---|---|
| U1 | **Snooze can't be found.** It's only in the ⋯ menu of a row on Today; a plant's page and its **More care** menu don't offer it (H11 predicted this) | P1, P2 | 4 | Offer **Put off…** on a plant's page, and show Today's ⋯ as a labelled button |
| U2 | **Soil feedback lands on the wrong watering, and past care is logged as today.** The timeline's "How was the soil?" chips on the last watering look like the way to say the soil is damp now. Nothing on a plant's page suggests care can be logged for another day. The wrong data teaches the predictions wrongly | P1, P2 | 4 | Say which watering the chips are for ("…when watered on 3 Nov"), and add **Add earlier care…** beside the care buttons |
| U3 | **Watering a room's plants at once isn't found.** Today has **Water all** per room, but neither looked there; Plants and a room's page have no way to do it | P1, P2 | 3 | Name the room on Today's button ("Water all 2 in Living room"), and add **Water all** to a room's page |
| U4 | **Rooms are called "locations".** P2 couldn't find how to add a room, and named the place itself "living room". P1's room wasn't saved (cause not yet reproduced) | P1, P2 | 3 | Say "room or spot" in the interface where it says "location"; reproduce P1's unsaved room |
| U5 | **The plant form is long and its room is easy to miss.** Both thought they'd finished partway down; P2 couldn't tell how to put the plant in a room; "Care profile" confused P1 (H7, H8) | P1, P2 | 3 | H7 and H8: room near the top, rarely used fields under "More details", care profile only without a species |
| U6 | **Cropping can't be found.** It's only in the photo viewer, opened from the Photos card. The cover photo isn't tappable | P1, P2 | 3 | Tapping the cover opens the viewer; after adding a photo, offer **Crop** in the confirmation |
| U7 | **The light check is misread.** Its title is a question, and the answer is in a table below | P2 | 3 | Lead with the answer and the advice ("Too dark here for it: move it closer to a window…"), then the table (H4) |
| U8 | **Inviting someone saves the household instead.** The email field and the household's **Save** look like one form | P2 | 3 | Put **Invite someone** in its own card, with its button right below the field |
| U9 | **The account menu goes unnoticed.** Household, notifications and care types are behind the avatar ("I just noticed there was a menu here") | P1, P2 | 2 | Label the avatar button, or add a "More" tab |
| U10 | **The evening reminder looks like the whole setup.** Turning it on without a way to be reached does nothing | P1 | 2 | Lead the page with "Get reminders on this device" |
| U11 | **Date fields' calendar button isn't noticed** | P1, P2 | 1 | Open the calendar when the field is tapped |

## What went well

- **Toxicity (task 10):** both answered at once, from the notice at the top of the plant.
- **Pot size (task 9):** both changed it through **Edit**.
- **P1** found most things through exploring, and called the app "easy to use, fun,
  useful".

## What they said

- "What's that mean? Oh, well, says optional." (P1, the care profile field)
- "Oh, LOWest!" (P1, the room's typical temperature range)
- "when?" (P1, looking for snooze in **More care**)
- "Add a wizard to walk you through the steps." (P1, debrief)
- "There's no add button anywhere!" (P2, looking for how to add a room)
- "How do I add it to a room?" (P2, after adding a plant)
- "I just noticed there was a menu here." (P2, the account menu)
- "It wasn't simple to add a plant or a house…" (P2, debrief)
- "Once I know the app, yes; I don't yet know where to find things." (P2, debrief)

## Not covered

What this test couldn't show, and how to check it another way:

- Phones: both sessions were on a desktop. The next round should use phones, as planned.
- First-time setup (task 1, skipped).
- AI features and plant identification (off during the test).
- Reminders arriving over days, and the evening reminder.
- Large households, many plants, more than one person caring at once.
