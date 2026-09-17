# Document blob cleanup

## Model: delayed garbage collection

1. Soft-delete sets `deletedAt` and keeps `storageKey` (audit/history).
2. Cron job (`DocumentBlobGcJob`, daily 03:00) purges blobs where:
   - `deletedAt <= now - DOCUMENT_BLOB_RETENTION_DAYS` (default **30**)
   - `purgedAt` is null
   - `storageKey` is set
   - no other non-purged document references the same key
3. On success: delete object (local/S3/MinIO), set `storageKey = null`, `purgedAt = now`.
4. Failures are logged; row is left for retry (idempotent).

Env: `DOCUMENT_BLOB_RETENTION_DAYS=30`
