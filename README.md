# Ensemble

> A local-first desktop workspace for orchestrating coding agents.

Ensemble gives developers and technical leads one calm place to design, run, and supervise agent workflows. Define roles, tasks, handoffs, approvals, and deliverables on an organization canvas, then step in when human judgment is needed.

## Why Ensemble

Working with multiple coding agents often means switching between terminals, chat windows, and scattered output files. Ensemble keeps the workflow, live run state, and resulting artifacts together while keeping people in control of important decisions.

## Core capabilities

- Start with a single agent or compose a multi-agent workflow.
- Create a workspace around a project directory and choose its default Runner. `pi` is the default Runner, while the adapter remains replaceable.
- Model roles, seats, groups, tasks, dependencies, handoffs, deliverables, and approval gates.
- Observe live runs and intervene with approvals, instructions, pause, cancel, retry, or rework actions.
- Inspect artifacts such as files, diffs, reports, and structured results in the context of the run that produced them.
- Work locally by default, without requiring an account or cloud sync for the first release.
- Use light, dark, system, or custom themes, with `en-US` and `zh-CN` as the first locales. The interface language and agent output language are configured independently.
- Target Windows, macOS, and Linux with a bundled runtime rather than a user-managed Python or Node installation.

## Designed for

- **Independent developers** who want one or more agents to take on issues, features, and fixes.
- **Technical leads** who need a clear view of responsibility, progress, dependencies, and human approval points.
- **Agent builders** who want to assemble reusable workflows from roles, Runner adapters, and execution rules.

Ensemble is focused on coding-agent orchestration. It is not intended to be a general-purpose workflow builder, a customer-support platform, or an IDE replacement.

## Project status

Ensemble is early-stage open-source software. The product direction is established, but the desktop runtime, API, and user experience are still being rebuilt. Interfaces and behavior may change, and there is no packaged public release yet.

## Documentation

- [Product goals and scope](docs/01-product.md)
- [Design language and interaction model](docs/08-design-language.md)
- [Design system source of truth](docs/ssot/design-system.md)
- [Internationalization](docs/ssot/i18n.md)
- [Cross-platform delivery requirements](docs/ssot/platform-adaptation.md)
- [Product rebuild specification](docs/specs/m6-product-rebuild.md)

## Contributing

Contributions are welcome. For a substantial change, open an issue first so the product behavior and API boundaries can be discussed before implementation.

## License

Ensemble is released under the [MIT License](LICENSE).
