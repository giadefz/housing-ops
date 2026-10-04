# Extension trust: explicit approvals with hash checks

Status: accepted.

User-authored code (`.local/` filters, providers, publishers) runs in-process
and gets no sandbox — instead it gets a trust ritual: it must pass its
`check`/`test` command, then earn explicit approval recorded in
`config/extensions.yml` under `approvals:`. A file whose hash changed is
refused at load until re-approved.

Consequence: enabling an extension is always two steps (check, then approve),
and updates to approved code visibly void the approval rather than sliding
through silently.
