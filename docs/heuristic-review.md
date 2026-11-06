# Heuristic review (1.0)

An expert walk-through of the app against Jakob Nielsen's ten usability heuristics, done
before the [usability test](usability-test.md) and alongside it: it finds problems that need
no participants, and gives the test things to watch for. It complements the click counts in
[usability.md](usability.md), which measure effort but not understanding.

- **Version:** `main` after the 1.0 design pass and photo cropping (#155, #156, #157), on
  2026-11-06.
- **How:** every page and the main dialogs, at phone size, in the demo household, as a
  Gardener and as an Admin, in light and dark mode. The reviewer also built the app, which is
  a known blind spot: it's what the usability test is for.
- **Severity:** 4 catastrophe, 3 major, 2 minor, 1 cosmetic, as in the
  [test plan](usability-test.md#scoring-and-rating).

## Summary

No catastrophes. One major problem: deleting a window or grow light takes one tap, with no
confirmation and no undo. The minor problems are mostly about wording and density:
- names in capitals;
- units and settings that read like system data;
- a long plant form and plant page.

| Severity | Problems | Before 1.0 |
|---|---|---|
| 4 | none | |
| 3 | H1 | Fixed before 1.0 |
| 2 | H2–H9 | H2, H3 and H5 are small: fixed before 1.0. The rest wait for the usability test, which shows how much they matter |
| 1 | H10–H12 | Later |

## Problems

### H1. Deleting a window or grow light can't be undone (severity 3)

**Heuristics:** error prevention; user control and freedom.

On a room's page, each window and grow light has an edit pencil and a red bin icon side by
side. One tap on the bin deletes the light at once, with no confirmation and no undo.
Deleting a light also removes it from the plants it reaches, with their distances from it,
so their light estimates and watering change. The two icons are small and close together.

**Fix:** ask before deleting, saying which plants it reaches. This is the same dialog as
for deleting a room.

### H2. Deleting a harvest can't be undone (severity 2)

**Heuristics:** error prevention; user control and freedom.

The bin icon beside each harvest deletes it at once. It's less costly than H1, since one
harvest is easy to log again, but the amount and notes are lost.

**Fix:** ask before deleting, showing which harvest, as for H1.

### H3. Names in capitals (severity 2)

**Heuristics:** aesthetic and minimalist design; consistency and standards.

The 1.0 look shows card and section headings in small capitals ("CARE SCHEDULE"). Some of
those headings are names rather than labels, and read worse in capitals:
- plugin names, e.g. "PLANT IDENTIFICATION (PL@NTNET)", which also wraps;
- care profile names on a plant's and a species' page, e.g. "TROPICAL AROID".

**Fix:** keep the small-capital style for section labels, and show names as they're written.

### H4. Light in mol/m²/day (severity 2)

**Heuristic:** match between the system and the real world.

A room's page lists each window's light by season as numbers in mol/m²/day (the daily light
integral). Hardly anyone knows that unit. The light check on a plant's page explains it and
says "A bit low" in words, but the room's page shows only the numbers.

**Fix:** lead with words (dim, medium, bright, very bright) and keep the numbers as
secondary detail. *Watch in the test:* task 7.

### H5. A place's page leads with system details (severity 2)

**Heuristic:** match between the system and the real world.

A place's page shows its time zone and coordinates under its name ("Europe/Amsterdam ·
52.3700, 4.8900"). People recognise a place by its name and where it is, not by numbers.

**Fix:** drop the coordinates from the page heading (they're in the edit form and the map),
and keep the time zone only where it matters.

### H6. Notification channels ask for an "Apprise URL" (severity 2)

**Heuristic:** match between the system and the real world.

Adding a notification channel asks for a name and an "Address (Apprise URL)". The examples
(`ntfys://…`, `tgram://…`, `mailto://user:password@…`) are written for technical people. The
simple choice, **This device** (Web Push), is shown first, which helps, but the form below it
still looks like the main way.

**Fix:** make **This device** the clear first choice. Fold the Apprise form under "Other
ways: ntfy, Telegram, email…", and later offer the common services by name. *Watch in the
test:* task 12.

### H7. The plant form is long on a phone (severity 2)

**Heuristic:** aesthetic and minimalist design.

Adding a plant shows about eleven fields and two sets of choices on one long page, with
**Save** only at the end. Status is shown when adding, though a new plant is nearly always
Active. Only the name is required.

**Fix:** when adding, hide Status, and fold pot, soil, "got it on" and notes into "More
details". *Watch in the test:* task 3.

### H8. "Care profile" before people know what it is (severity 2)

**Heuristics:** match between the system and the real world; recognition rather than recall.

The plant form has a "Care profile" choice right after the species, with the placeholder
"optional". When the species is known, the field says which profile comes with it, but the
idea of a care profile isn't explained on the form, and it looks like something to fill in.

**Fix:** with H7, move it under "More details", or show it only when no species is chosen.
*Watch in the test:* task 3.

### H9. A plant's page is long (severity 2)

**Heuristic:** aesthetic and minimalist design.

A plant's page has about twelve cards. Daily things come first (care rings, the care
buttons, the schedule), but cards used once, such as the QR label and Propagate, sit between
the plant's details and its photos and history.

**Fix:** move the rarely used actions (print a label, write an NFC tag, propagate) into a
menu by **Edit**, so photos and history come sooner.

### H10. Plant cards' bars have no labels (severity 1)

**Heuristic:** recognition rather than recall.

The three thin bars on each plant card (water, fertilizer, light) show only small icons.
Screen readers get the words, but sighted people learn the meaning from a plant's page.
Probably fine once learned.

### H11. Skip, snooze and "log with details" are in a ⋯ menu (severity 1)

**Heuristic:** flexibility and efficiency of use; recognition rather than recall.

On Today, the done button is visible. The other actions on care are in the ⋯ menu beside it,
which keeps rows short but hides them. *Watch in the test:* task 6. If people don't find the
snooze, raise this.

### H12. "Log" (severity 1)

**Heuristic:** match between the system and the real world.

"Log with details" and similar labels use "log", which is app language. Plain verbs such as
"Add details" or "Note it" may be clearer. *Watch in the test:* task 5.

## What works well

- **Visibility of system status:**
  - care marked done says so, with **Undo**;
  - Today shows how many plants need care;
  - the care rings say in words what they show.
- **Explaining itself:** **Why?** beside each predicted schedule, the light check's advice in
  words, and every plugin saying exactly what it sends.
- **Error prevention elsewhere:** deleting plants, rooms, photos, people and care types asks
  first, and adding plants and rooms doesn't lose what's been typed (#98, #120).
- **Consistency:**
  - one card style and one heading style;
  - the same done button everywhere;
  - destructive actions always in red, with a bin icon.
- **Accessibility:** contrast checked in both modes, every action named for screen readers,
  and motion reduced when asked.
