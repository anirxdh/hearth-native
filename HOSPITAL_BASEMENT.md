# The Hospital Basement Gate

A release gate, not a metaphor. A caregiver's worst moments happen in places
with no signal: a hospital basement, a parking garage, a rural highway. Every
release of Hearth must pass this checklist **in airplane mode** on a physical
device before it ships. No exceptions, no "it should be fine."

## Setup

1. Install the release candidate on a device seeded with the demo family.
2. Force-quit the app.
3. Enable airplane mode AND turn off Wi-Fi.
4. Reopen the app.

## The checklist

Every item must pass with zero network:

- [ ] App cold-starts to the home dashboard in under 3 seconds
- [ ] Today's Digest shows the correct lead action with correct day counts
- [ ] Every patient record opens: all six tabs render with data
- [ ] Activity charts draw for every range (7d / 30d / 90d / 1y)
- [ ] The ER sheet opens instantly (within 2 taps of home) and print preview renders
- [ ] The one-pager opens and print preview renders, including the Daily needs table
- [ ] The everyone portfolio opens and print preview renders all people
- [ ] Every emergency guide opens; all pictograms render; print preview works
- [ ] A medication can be added with a fill; the runway computes; the digest updates
- [ ] A vital, an observation, a history event, and a lab can each be added and appear
- [ ] A document can be added from the photo library and viewed (camera needs no network either)
- [ ] Refill notifications remain scheduled (Settings shows the pending count)
- [ ] The access log opens and shows prior entries
- [ ] Killing the app mid-write (add a med, force-quit at the confirm) relaunches cleanly
- [ ] No screen shows a spinner that never resolves, an error toast, or a blank state

## After airplane mode

- [ ] Encrypted backup exports and the share sheet opens (share can need network; the export must not)
- [ ] Privacy shield: app switcher snapshot shows plain paper, not care data
- [ ] With Face ID lock on: backgrounding then foregrounding demands Face ID

## Sign-off

| Release | Date | Device | iOS | Pass | Notes |
|---|---|---|---|---|---|
| (record each run here) | | | | | |
