# Contributing

Thanks for your interest in contributing! This project is a self-hosted, open-source
plant care app for hobbyists, licensed under the [AGPL-3.0](LICENSE).

> **Getting started:** see the [development guide](docs/development.md) to set up your
> computer, and the [style guide](docs/STYLE_GUIDE.md) for coding conventions.

## Ground rules

- Be kind and constructive.
- For anything larger than a small fix, **open an issue first** so we can agree on the
  approach before you invest time in it.
- Keep pull requests focused: one feature or fix per PR.
- New behavior needs tests. Bug fixes should include a test that fails without the fix.
- All checks (linting, type checks, tests) must pass before a PR is reviewed.
- Follow the [style guide](docs/STYLE_GUIDE.md) and fill in the pull request template.

## AI-assisted contributions

AI tools (coding assistants, chat models, autocomplete) are **welcome** here. Many of us
use them, including the maintainer. What we don't accept is *unreviewed* AI output, often
called "vibe coding": code the submitter hasn't read, doesn't understand, or hasn't
tested.

The rule is simple: **you are the author of everything you submit, whatever tools helped
you write it.** In practice that means:

1. **Understand every line.** You should be able to explain what your change does and why,
   and answer review questions about it in your own words. "The AI wrote it" is not an
   answer to a review question.
2. **Run it and test it yourself.** Run the test suite locally, and exercise the feature in
   the running app. Include tests for the new behavior.
3. **Keep it small and intentional.** AI tools tend to produce sprawling changes: drive-by
   refactors, unused helpers, extra dependencies, verbose comments. Trim your PR down to
   what the change actually needs.
4. **Check facts and dependencies.** Verify that every library, function, and API the code
   uses actually exists and does what the code assumes. Don't add a new dependency
   without discussing it in the issue first.
5. **Respect licensing.** Don't submit code you have reason to believe is copied from a
   source whose license is incompatible with AGPL-3.0.
6. **Disclose significant AI assistance.** If an AI tool generated a substantial part of the
   PR, say so briefly in the PR description (for example, "Drafted with an AI assistant,
   reviewed and tested by me"). This isn't a penalty; it helps reviewers know where to
   look closely. Autocomplete-level help doesn't need a mention.
7. **Write your own PR description and review replies.** Use your own words in
   descriptions, issues, and discussions. Don't paste AI-generated walls of text.

Maintainers may close PRs that show signs of unreviewed AI output. Typical signs: code that
doesn't run, invented APIs, unrelated changes, or an author who can't explain the change.
This isn't personal. Reviewer time is the scarcest resource in an open-source project.

### AI and plant care content

The app itself includes AI features, such as plant identification and care suggestions.
Contributions to those features must:

- keep AI features **optional**, so the app is fully usable without any AI provider
  configured;
- never send a user's photos or data to a third-party service without the user having
  configured and enabled that service;
- present AI output as a suggestion, never as authoritative advice. This matters most
  for plant toxicity to pets and children.

The same care applies to the care dataset: values written with an AI tool's help must be
checked against real sources, which you cite in the file's `sources`.

## Reporting bugs and requesting features

Use GitHub Issues. For bugs, include the app version, how you run it (Docker or
otherwise), the database you use, the steps to reproduce, and what you expected to happen.

## Security issues

Please don't open public issues for security vulnerabilities. Contact the maintainer
privately through GitHub instead.

## License

By contributing, you agree that your contributions will be licensed under the
[AGPL-3.0](LICENSE), except contributions to the care dataset in `data/care/`, which are
licensed under [CC BY-SA 4.0](data/care/LICENSE) so other projects can reuse the data. See
[data/care/README.md](data/care/README.md) for how to contribute plant care values.
