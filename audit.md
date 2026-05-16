Let me search for current Fortify API documentation on this.Here's how to change the audit analysis value (Exploitable, Not an Issue, Suspicious, etc.) of an issue via the Fortify SSC REST API.

## The endpoint

```
POST /api/v1/projectVersions/{parentId}/issues/action/audit
```

You need an `AuditToken` (or `UnifiedLoginToken`) sent as `Authorization: FortifyToken <token>`.

## Required pieces before the call

1. **`parentId`** — the project version ID.
2. **`issueInstanceId`** (or `id`) of each issue you want to audit. Get these with `GET /api/v1/projectVersions/{parentId}/issues`.
3. **`revision`** — the current revision of each issue. This is the gotcha that bites most people (the conflict error in the OpenText thread): SSC uses optimistic concurrency, so you must include the latest `revision` returned from the GET, or you get `409 errorCode -12109`.
4. **The custom tag GUID for the "Analysis" tag** — it's a built-in tag but you reference it by its UUID. Get it from `GET /api/v1/customTags` (look for the one named `Analysis`). You also need the GUID of the value you want to set (e.g. "Not an Issue").

## Request body

```json
{
  "issues": [
    { "id": 12345, "revision": 0 }
  ],
  "customTagAudit": [
    {
      "customTagGuid": "87f2364f-dcd4-49e6-861d-f8d3f351686b",
      "textValue": "Not an Issue"
    }
  ],
  "comment": "Reviewed - false positive, sanitized upstream"
}
```

For non-text tags (single-select, like Analysis), some SSC versions want `newCustomTagIndex` with the value's index instead of `textValue`. Check what your Swagger UI shows for your version — they've shifted the schema between releases.

## curl example

```bash
curl -X POST "https://ssc.example.com/ssc/api/v1/projectVersions/6/issues/action/audit" \
  -H "Authorization: FortifyToken <your-token>" \
  -H "Content-Type: application/json" \
  -d @audit-payload.json
```

## Practical tips

The reliable pattern: `GET` issues → capture each `id` + `revision` → submit audit → if you're batch-processing, **re-GET before each subsequent call** because the prior audit incremented the revision. That's exactly the trap in the OpenText community thread you'd hit otherwise.

Best discovery path for your specific SSC version: hit `https://<your-ssc>/html/docs/api-reference/index.jsp` (the bundled Swagger UI), find `issue-of-project-version-controller` → `action/audit`, and copy the exact schema. Or open Chrome DevTools while auditing one issue in the UI and inspect the actual request — that's the canonical reference for what your server accepts.
