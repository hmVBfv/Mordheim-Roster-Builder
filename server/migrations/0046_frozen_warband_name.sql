-- A warband that leaves a campaign is shown there under the name it had when it left (security review AUTHZ-6): what its owner calls it
-- afterwards is theirs. The name is written at the moment of leaving, into the rows that name the warband in battles (participants) and
-- marks (tags); while it is in the campaign the column stays empty and the warband's own name shows. What left before this migration
-- keeps showing the current name: there is nothing to freeze that was not already given up.
ALTER TABLE battle_participants ADD COLUMN warband_name TEXT;
ALTER TABLE tags ADD COLUMN warband_name TEXT;
