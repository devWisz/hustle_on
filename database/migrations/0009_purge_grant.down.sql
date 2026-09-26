-- 0009, reversed: back to the state 0008 left, where nothing but the owner may
-- purge. Rolling this back also disables the API's scheduled purge, which logs
-- the failure and carries on — it does not break requests.
REVOKE EXECUTE ON FUNCTION purge_expired_auth(interval) FROM sardhana_app;
