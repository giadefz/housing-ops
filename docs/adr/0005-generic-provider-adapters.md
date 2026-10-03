# Generic provider adapters, command-adapter primary

Status: accepted.

A provider is any adapter implementing the port — primarily an external
command (python, node, anything) emitting the documented listing-JSON v1
interchange, secondarily a TS module for npm libraries or plain HTTP. We
ship no hand-rolled portal scrapers by default: we reuse external tools,
keep bundled examples thin and replaceable, and normalize everything at the
interchange boundary.

Considered options: one in-house scraper per portal (rejected — portals
change constantly and each one widens our ToS surface). Pushdown of hard
constraints survives only as provider arguments, an optimization the local
pipeline always re-validates.
