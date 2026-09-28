# Saves from the running campaign

`core/test/parity/saves.parity.test.ts` loads every `*.json` here in the
legacy app and in `core/`, compares them, and walks each warband on from
where the campaign left it. A campaign file is opened next to each warband it
holds.

## Adding a save

The repository is public. Never copy a save in by hand; clean it first:

```sh
npm run sanitize-save -- ~/Downloads/grey-penitents.json
npm run sanitize-save -- ~/Downloads/roster.txt core/test/saves/rob-round-6.json
```

The script reads a warband save, a campaign file or the readable text export,
writes the cleaned copy here (or to the path given) and lists what it took out:
the story, warriors' backgrounds, chronicle notes and corrected entries,
battle accounts, casualty remarks, house-rule notes, and the players' names in
a campaign file ("Player 1", "Player 2", …). Warband and warrior names stay,
because the chronicle already publishes them — rename any that are not public
before committing. The suite fails on a file that is not clean.

## The examples

`example-grey-penitents.json` and `example-campaign.json` are invented: three
battles of the Grey Penitents, and a campaign file with them, the Silver
Caravan and Clan Skrittle. They were built with `core/` actions and written by
the legacy app, so they have the shape of real exports, and they keep the
suite running before any real save is here.
