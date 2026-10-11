# Scheduling

Deterministic scans are cheap and headless, so run them on a timer and let the
judgement loop happen in a session later. housing-ops ships **no scheduler** —
just recipes (D27). Run `housing-ops scan` from cron or launchd and the fetch →
filter → store half runs with zero AI cost.

Every command prints its JSON envelope to stdout and its logs to stderr, so
redirect stderr to a log and stdout wherever you want the result.

## cron

```cron
# twice a day: 08:00 and 20:00
0 8,20 * * * cd /path/to/housing-ops && /usr/bin/env node dist/adapters/primary/cli/main.js scan >> /tmp/housing-ops.log 2>&1
```

`cd` into the checkout, or set `HOUSING_OPS_ROOT=/path/to/housing-ops` in the
environment. Add `--provider daft` to sweep one portal.

## launchd (macOS)

`~/Library/LaunchAgents/com.housing-ops.scan.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key><string>com.housing-ops.scan</string>
    <key>WorkingDirectory</key><string>/path/to/housing-ops</string>
    <key>ProgramArguments</key>
    <array>
      <string>/usr/bin/env</string>
      <string>node</string>
      <string>dist/adapters/primary/cli/main.js</string>
      <string>scan</string>
    </array>
    <key>StandardOutPath</key><string>/tmp/housing-ops.out</string>
    <key>StandardErrorPath</key><string>/tmp/housing-ops.err</string>
    <key>StartCalendarInterval</key>
    <array>
      <dict><key>Hour</key><integer>8</integer><key>Minute</key><integer>0</integer></dict>
      <dict><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>
    </array>
  </dict>
</plist>
```

Load it with `launchctl load ~/Library/LaunchAgents/com.housing-ops.scan.plist`.

## Notifying without the agent

A scan emits pipeline events. Point a publisher (see
`docs/design/publishers.md`) at `offer.passed` and a scheduled scan can ping you
the moment an offer clears your filters — no session needed. The agent is for
judgement, not for noticing.
