# YouVersion Live Provider Canary - 2026-07-30

## Scope

Resolve the prior YouVersion `401` and establish whether Threadlight can use the existing App Key
for attributed Scripture retrieval in Railway production. Credential values were never printed,
returned by an API, or committed.

## Diagnosis

Threadlight already matched the current YouVersion requirements:

- base URL `https://api.youversion.com/v1`;
- App Key in the `X-YVP-App-Key` request header;
- numeric BSB Bible ID `3034`;
- bracketed `language_ranges[]=en` when resolving a Bible by abbreviation.

The existing key now returns `200` from both `/v1/bibles/3034` and
`/v1/bibles/3034/passages/JHN.3.16`. The same key had returned `401` in the earlier hosted test.
Because no adapter or credential change was required, the evidence is consistent with provider-side
activation or propagation completing after that test. Railway production had remained intentionally
pinned to the verified AO Lab fallback.

## Verification

| Layer | Result | Evidence |
| --- | --- | --- |
| Direct YouVersion API | Passed | Bible `3034` and John 3:16 returned `200`. |
| Threadlight provider adapter | Passed | Returned John 3:16, translation BSB, YouVersion attribution, and a `bible.com` source link. |
| Authenticated production preview | Passed | Returned Psalm 55:22 through `gloo + youversion`; Scripture retrieval completed in `970.8 ms`, total response time `17,148.1 ms`. |
| No-login public demo | Passed | The grief scenario returned Psalm 34:18 (BSB) with `Berean Standard Bible · Scripture text via YouVersion`; trace was `gloo + youversion`, total response time `16,728.8 ms`. |
| Connector readiness after reconcile | Passed | Discord and YouTube remained running and ready with no new provider error. |

## Production State

The saved Railway configuration now selects YouVersion with Bible `3034`. The active application
deployment remains `08674910-2067-4f00-9c17-7320829499ad`; this was a protected configuration
change, not a code deployment.

No new YouVersion account or App Key was created. No Discord, YouTube OAuth, AI provider,
permission, or persistent-volume setting changed.

## Conclusion

`PASS - LIVE PROVIDER` for the required YouVersion integration. The current public demo provides a
credential-free judge-facing canary with real Gloo and YouVersion trace data and attributed
Scripture.
