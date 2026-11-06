# How easy Sunfleck is to use

Measured rather than judged by feel: what the core tasks cost a person in taps, fields and
page changes, with a budget for each that the browser tests check. Started in 0.7 Gardenia
(#97). A task test with a few people, scored with the System Usability Scale, follows in 1.0.

## How it's measured

`frontend/e2e/effort.e2e.ts` does each task the way a person would, at phone size (a Pixel 7),
in the demo household (`manage.py demo_household`), and counts:

- **Taps**: buttons, links, checkboxes, options and menu items. Choosing from a dropdown is
  two: one to open it, one for the option.
- **Fields**: text typed into a field, or a photo chosen.
- **Page changes**: a new address. Dialogs and menus don't count.

A task starts on the page a person would be on, usually Today or one of the main tabs, and
getting there isn't counted. The counts come from what the test does, so they're the shortest
way through, not what a new person would take; the task test in 1.0 covers that.

Run them with the other browser tests: `make e2e` (or `npm run e2e` in `frontend/`). Each
task's cost is printed, and is in the HTML report (`frontend/e2e/report`).

## Budgets

The budget for each task is its cost when it was first measured, so a task can't quietly get
harder. When a change makes a task cost more on purpose, raise its budget in the test and say
why in the pull request; when one gets cheaper, lower it.

| Task | Starts on | Taps | Fields | Page changes |
|---|---|---|---|---|
| Water every plant in a room that needs it | Today | 1 | 0 | 0 |
| Log a watering | Today | 1 | 0 | 0 |
| Snooze care | Today | 2 | 0 | 0 |
| Log care from a plant's page, with how the soil was | Plants | 3 | 0 | 1 |
| Find a plant by name | Today | 2 | 1 | 2 |
| Add a plant to a room, with its species | Today | 7 | 3 | 3 |
| Accept a new plant's suggested routine | The plant | 1 | 0 | 0 |
| Add a photo of a plant | Plants | 2 | 1 | 1 |
| Water a plant every 5 days instead of the predicted interval | Plants | 4 | 1 | 1 |
| Change a plant's pot size | Plants | 3 | 1 | 3 |
| Add a room, with a window | Today | 8 | 1 | 4 |
| Move a plant to another room | Places | 4 | 0 | 1 |
| Give a plant a grow light its room doesn't have yet | Plants | 6 | 0 | 3 |
| Invite someone to the household | Today | 3 | 1 | 1 |
| Put care in a calendar app | Today | 4 | 0 | 1 |

Measured on 2026-11-05, for 0.7.

## What the numbers say

- **Everyday care is cheap.** Watering, a whole room at once, and snoozing take one or two
  taps from Today, without leaving it.
- **Giving a plant a light its room doesn't have** took leaving the plant form for the room's
  page and coming back; with #98 it's 6 taps without losing the form.
- **Adding a room with a window** is the costliest task: 8 taps over 4 pages, since the
  window is added on the room's page after the room is saved. Adding windows in the room's
  form would save a page and a tap or two.
- **A new plant's routine is a second step** on its page after saving. Offering it in the
  plant form, or accepting it by default, would make adding a plant one step.
- **Changing a plant's pot** goes through the edit page and back (3 page changes) for one
  field. Fine for now; editing in place is a 1.0 design question.

## Dead ends

Screens that need something they can't create, so the person has to leave, make it and come
back, often losing what they'd typed.

| Where | What's missing | Issue |
|---|---|---|
| Plant form | A window or grow light the room doesn't have | #98, fixed in 0.7 |
| Plant form, with no places yet | A place and a room: the link leaves the form | #120 |
| Logging care, adding a schedule | A care type the household doesn't have yet | #121, fixed in 0.8 |
| Today, in a new household | Any pointer to adding a place and a first plant | #122 |

## Limits

- Taps measure effort, not whether the screens are understood; the task test in 1.0 covers
  that.
- The counts are for the demo household, at phone size. Wider screens show the same pages.
- No usage analytics: a self-hosted app shouldn't phone home.
