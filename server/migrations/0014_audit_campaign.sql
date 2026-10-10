-- What a campaign's log is asked for every few seconds: the latest entry
-- that narrows what someone may see (a note or picture turned leaders'-only,
-- a role changed). Notes and pictures add its seq to every member's own, so
-- a device asks again and drops what it may no longer show (security review,
-- independent check of AUTHZ-3).
CREATE INDEX audit_log_campaign ON audit_log (campaign_id, action, seq);
