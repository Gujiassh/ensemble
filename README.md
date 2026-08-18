# Ensemble

> Plan, coordinate, and review coding-agent work from one focused desktop workspace.

Ensemble turns agent work into a visible, controllable workflow. Arrange roles and tasks on an organization canvas, define how work moves, and follow each run from assignment to artifact. Keep human approval where it matters without losing momentum.

## Why Ensemble

Coding-agent work is easy to scatter across terminals, chat threads, and output folders. Ensemble brings ownership, dependencies, handoffs, decisions, and deliverables into one operating view so people can understand the work and change its direction when needed.

## How it works

1. **Create a workspace** around a project directory and choose the execution engine that fits it. `pi` is the default Runner, and Runner adapters remain replaceable.
2. **Compose an orchestration** from roles, seats, groups, tasks, dependencies, handoffs, deliverables, and approval gates.
3. **Run and supervise** the workflow. Follow progress, inspect artifacts, approve results, add instructions, pause, cancel, retry, or rework tasks.

## Core capabilities

- Start with a single agent or compose a multi-agent workflow.
- Make responsibility and execution order explicit.
- Track live run state, human attention points, handoffs, and artifacts in context.
- Keep files, diffs, reports, and structured results attached to the run that produced them.
- Save and reuse workflow configurations across workspaces.
- Use light, dark, system, or custom themes without changing the meaning of a status.
- Configure the interface language and agent output language independently. The interface supports multiple locales, including `en-US` and `zh-CN`.
- Run as a standalone desktop application on Windows, macOS, and Linux.

## Designed for

- **Independent developers** who want one or more agents to take on issues, features, and fixes.
- **Technical leads** who need a clear view of responsibility, progress, dependencies, and human approval points.
- **Agent builders** who want to assemble reusable workflows from roles, Runner adapters, and execution rules.

Ensemble is focused on coding-agent orchestration. It is not a general-purpose workflow builder, a customer-support platform, or an IDE replacement.

## Documentation

- [Product definition](docs/01-product.md)
- [Design language and interaction model](docs/08-design-language.md)
- [Design system](docs/ssot/design-system.md)
- [Languages and internationalization](docs/ssot/i18n.md)
- [Desktop platform requirements](docs/ssot/platform-adaptation.md)

## Contributing

Contributions are welcome. For a substantial change, open an issue first so the product behavior and API boundaries can be discussed before implementation.

## License

Ensemble is released under the [MIT License](LICENSE).
