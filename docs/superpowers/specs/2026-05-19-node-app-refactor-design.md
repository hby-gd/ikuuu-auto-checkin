# iKuuu Auto Checkin Node App Refactor Design

Date: 2026-05-19

## Goal

Refactor the current single-file GitHub Actions script into a small Node application with clear module boundaries, minimal dependencies, and basic automated tests.

The refactor keeps the current core behavior:

- Read account and session data from environment variables
- Check session validity before check-in
- Support multi-account execution
- Support `CHECK_ONLY=true`
- Write summary results to console and `GITHUB_OUTPUT`
- Send a single summary notification through ServerChan
- Exit with non-zero status when any account fails

The refactor intentionally removes Telegram support from the application design and makes GitHub Actions a thin runner only.

## Non-Goals

- Adding password-based login
- Adding browser automation or captcha bypass
- Supporting multiple notification providers
- Building a plugin system
- Adding TypeScript
- Introducing heavy validation or DI frameworks

## Problems in Current Structure

The current `main.js` mixes too many responsibilities:

- environment parsing
- host normalization
- cookie building
- session validation
- HTTP calls
- result formatting
- GitHub Actions output writing
- top-level error handling

This creates three concrete problems:

1. Changes to one concern easily break another because everything shares one file and one execution path.
2. Most logic is hard to test because it is coupled directly to `process.env`, `fetch`, and process exit behavior.
3. The GitHub Actions workflow still contains notification behavior that should belong to the application.

## Proposed Architecture

Use a small three-layer Node application structure:

- `cli`: process entrypoint only
- `app`: orchestration and use-case flow
- `domain`: pure business logic and result modeling
- `infra`: environment, HTTP, output, and notification integrations
- `shared`: small generic helpers with no domain meaning

This is intentionally lighter than a full ports-and-adapters system but still provides real boundaries.

## Directory Layout

```text
src/
  cli/
    main.js
  app/
    run-checkin.js
  domain/
    account.js
    session.js
    result.js
    errors.js
  infra/
    config/
      env.js
    http/
      ikuuu-client.js
    notify/
      server-chan.js
    output/
      github-output.js
  shared/
    time.js
    text.js
test/
  domain/
    account.test.js
    session.test.js
    result.test.js
  infra/
    config/
      env.test.js
```

## Module Responsibilities

### `src/cli/main.js`

- Start the application
- Call `runCheckin()`
- Catch top-level unexpected failures
- Set process exit code

This file must not contain business rules.

### `src/app/run-checkin.js`

- Load configuration through infra
- Construct runtime dependencies
- Run the account processing flow
- Aggregate results
- Write outputs
- Send notification
- Return final execution status

This file owns the application sequence, but not low-level parsing or HTTP details.

### `src/domain/account.js`

- Validate account shape
- Normalize account fields if needed
- Provide stable account identifiers for downstream use

### `src/domain/session.js`

- Extract `expire_in`
- Validate expire timestamp
- Determine whether a session is expired
- Format remaining session lifetime text
- Produce stable login/session status messages

### `src/domain/result.js`

- Define the result record shape for each account
- Build success and failure result objects
- Aggregate multiple account results
- Generate console summary text
- Generate notification text

This is the key module that prevents message formatting from being scattered.

### `src/domain/errors.js`

- Define a small set of domain-aware error types
- Distinguish configuration errors, session/auth errors, and remote response errors

This avoids passing ad hoc raw strings across the application.

### `src/infra/config/env.js`

- Read environment variables
- Parse JSON environment inputs
- Parse booleans
- Resolve `IKUUU_HOST` with fallback compatibility for legacy `HOST`
- Read optional `SCKEY`

This module becomes the only place allowed to read from `process.env`.

### `src/infra/http/ikuuu-client.js`

- Build `/user` and `/user/checkin` URLs
- Build cookie headers
- Execute requests with `fetch`
- Parse site responses
- Convert transport failures into domain errors

This module must not know about GitHub Actions or notification delivery.

### `src/infra/notify/server-chan.js`

- Send one summary notification to ServerChan
- No-op when `SCKEY` is absent
- Surface notification failures without corrupting core check-in results

### `src/infra/output/github-output.js`

- Write named outputs to `GITHUB_OUTPUT`
- No-op when not running in GitHub Actions

### `src/shared/*`

Only generic helpers belong here. This directory must not become a catch-all trash bin.

## Runtime Flow

The main use case flow is:

1. Load and validate environment configuration.
2. Create the iKuuu HTTP client.
3. Create the optional ServerChan notifier.
4. For each account:
   - validate account
   - resolve session for the account
   - fail early if session is expired
   - check session validity through `/user`
   - if not `CHECK_ONLY`, execute `/user/checkin`
5. Aggregate all account results.
6. Print summary to console.
7. Write summary to `GITHUB_OUTPUT`.
8. Send one ServerChan summary notification if configured.
9. Return a failing process status if any account failed.

## Error Handling Rules

There are two error classes in the design.

### Expected business errors

Examples:

- missing `ACCOUNTS`
- malformed `ACCOUNT_SESSIONS`
- missing account session mapping
- invalid `expire_in`
- expired session
- redirected login state
- invalid remote response shape

These errors should be converted into stable, readable Chinese messages and captured as per-account failures when possible.

### Top-level system errors

Examples:

- programming bug
- unexpected runtime exception
- broken notification implementation

These are caught once at the CLI boundary and reported as a top-level script execution failure.

## Notification Behavior

Notification support moves out of GitHub Actions and into application code.

Rules:

- Only ServerChan is supported after refactor.
- Only one summary notification is sent per run.
- Notification content is generated from the same aggregate result object used for console output.
- If notification sending fails, the application prints a notification failure message but does not overwrite the primary check-in outcome.

This keeps notification as a secondary concern instead of making it the source of truth for job status.

## GitHub Actions Changes

The workflow should be reduced to:

- checkout
- setup Node
- install dependencies
- run the app

The workflow should stop owning:

- Telegram notification logic
- ServerChan curl logic
- redundant result formatting

The application becomes the single place where result text is defined.

## Dependency Strategy

Keep dependencies minimal.

Allowed:

- one lightweight test framework if Node built-ins are insufficient

Preferred baseline:

- use Node built-in `node:test`
- use Node built-in `assert`
- use built-in `fetch`

Do not add schema validation frameworks, DI containers, or general utility libraries unless the design later proves they are necessary.

## Testing Strategy

Add focused unit tests around stable logic boundaries.

Initial required coverage:

- `domain/account.js`
  - valid account object
  - missing required fields
- `domain/session.js`
  - valid `expire_in`
  - invalid `expire_in`
  - expired session
  - remaining time formatting
- `domain/result.js`
  - single success result
  - mixed success/failure aggregation
  - summary message generation
- `infra/config/env.js`
  - valid env parsing
  - malformed JSON env handling
  - host fallback behavior
  - `CHECK_ONLY` boolean handling

Avoid real network tests in the first refactor pass. The HTTP module should be structured so its parsing and mapping can be tested with mocked responses later.

## Migration Plan

The refactor should happen in these stages:

1. Create `src/` structure and move current logic into modules without changing external behavior.
2. Introduce domain result objects and centralize summary rendering.
3. Move ServerChan notification into application code.
4. Simplify GitHub Actions workflow so it only runs the Node app.
5. Add tests for pure logic modules.
6. Verify the app locally with representative env data and run tests.

## Acceptance Criteria

The refactor is complete when all of the following are true:

- `main.js` is no longer the business logic container
- core logic lives under `src/`
- GitHub Actions is reduced to a thin runner
- only ServerChan notification remains
- current user-facing behavior remains consistent
- unit tests cover configuration parsing, session logic, and result aggregation
- a failed notification does not incorrectly mark a successful check-in as failed

## Risks and Mitigations

### Risk: Refactor changes output text unexpectedly

Mitigation:

- centralize text generation in `domain/result.js`
- verify current output examples against the new renderer

### Risk: Notification migration changes workflow behavior

Mitigation:

- treat notification as best-effort
- keep process exit behavior based on account results only

### Risk: Overengineering a tiny repository

Mitigation:

- keep layers shallow
- avoid new runtime dependencies
- prefer plain functions over abstractions

## Recommendation

Proceed with the three-layer small-app refactor described above, with ServerChan-only notification support and a lightweight built-in test strategy.
