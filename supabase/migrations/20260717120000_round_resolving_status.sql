-- CAS idempotency for resolve-round (§3.3): claim planning → resolving
-- before computing; stale 'resolving' rows are reset by the sweep.
alter type round_status add value if not exists 'resolving' after 'planning';
