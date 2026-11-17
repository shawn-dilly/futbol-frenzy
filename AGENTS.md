# Codex / T3 entry point

Read [CLAUDE.md](CLAUDE.md) for the shared project design, architecture, standards, commands, and workflow. This file maps that workflow to Codex / T3; `.claude/agents/` is Claude Code configuration and does not configure Codex agents or tools.

For milestone plan work, use **gpt-6.1-terra** for implementation and **gpt-6.1-sol** for independent verification, including visual verification when applicable. These choices override legacy plan references to Claude models, agents, tools, or skills. Discover the actual model catalog and delegation capabilities available in the current harness before dispatching; if the requested model or independent reviewer is unavailable, report that limitation rather than claiming the review occurred or silently substituting a model.

Work on one plan task at a time. Give the implementer the task brief and project standards; have it report changes, checks and their results, and any gaps. An independent reviewer then checks the brief, diff, standards, and evidence before the next task. For visual work, the verifier runs the game, inspects screenshots against the mockups, and reports observations and gaps. This brief → implementation → report → independent review contract is the portable equivalent of legacy references to `superpowers:subagent-driven-development`; it does not require Claude plugin scripts or skills. Follow the active harness and user instructions on whether delegation is permitted.

Inspect the working tree before starting. Preserve existing unfinished work, do not reset or overwrite it, and stage only the files belonging to the authorized task. Report any conflicts or checks blocked by that work.

Follow the milestone completion, commit, and verified push rule in the shared `CLAUDE.md` Workflow.
