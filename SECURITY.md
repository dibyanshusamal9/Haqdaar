# Security and data handling

Store API credentials and database URLs in ignored environment files or deployment secret stores.
Only public service URLs belong in `NEXT_PUBLIC_*` variables. Root `.env.example` contains
placeholders; configure a private curator access code before shared use.

Citizens submit sensitive socioeconomic profile fields. Collect only fields needed for matching;
avoid names and identity documents. Match logs retain matching fields and results; transcripts
and audio are not intended as persistent match-log data. Audio/text sent to external providers
still leaves the application boundary. Review provider handling before production use.

The current curator mechanism is a shared access code, not a complete multi-user identity system.
Use HTTPS, restrict deployment/database access, and assess authentication/rate limiting and
retention requirements before production. Do not post secrets or personal data in public issues.
Report suspected vulnerabilities privately to the project maintainers through an established
private channel; no dedicated public security email is configured in this repository.

If credentials leak, revoke/rotate them first, then remove exposed material and inspect logs.
Do not assume deleting a committed file removes it from Git history.
