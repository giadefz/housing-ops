# Extension trust: explicit approval plus hash pins

Status: accepted.

User-authored code (`.local/` filters, providers, publishers) runs in-process
and gets no sandbox — instead it gets a trust ritual: it must pass its
`check`/`test` command, then earn explicit approval recorded as a sha256 pin
in `config/extensions.yml`. A pinned file whose hash changed is refused at
load until re-approved.

Consequence: enabling an extension is always two steps (check, then approve),
and updates to approved code visibly invalidate the pin rather than sliding
through silently.
