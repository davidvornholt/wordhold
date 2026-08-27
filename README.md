# Wordhold

Wordhold is a private language-learning application. It imports course material, schedules practice, and uses configured AI providers to prepare and grade exercises. The web app lives in `apps/web`; the database schema and migrations live in `packages/db`.

## Development

Install dependencies, generate the development environment, and start the app:

```bash
bun install --frozen-lockfile
just dev-env-generate
just dev-db-start
bun run dev
```

Run the complete repository gate before opening a pull request:

```bash
bun run check:fix
```

See [`apps/web/README.md`](apps/web/README.md) for the application configuration and production secret contract.

## Production releases

A successful exact-`main` run of `Publish container` publishes `ghcr.io/davidvornholt/wordhold:main`, proves anonymous access to its digest, and sends that digest to `davidvornholt/personal-infra`. The infrastructure repository opens a promotion pull request that changes its committed Wordhold image pin. Production changes only after that pull request passes its own gates, merges, deploys, and reads back the exact healthy digest at `https://wordhold.vornholt.online`.

The `standards-broker` GitHub App must be installed on both `wordhold` and `personal-infra`. Its Wordhold workflow token requests only Contents write access to `personal-infra`. The Wordhold GHCR package must grant this repository Write access under its Manage Actions access settings.

Follow a release with:

```bash
gh run list --repo davidvornholt/wordhold --workflow publish-container.yml --branch main --limit 5
gh pr list --repo davidvornholt/personal-infra --search 'head:image-bump/wordhold/'
curl --fail --silent --show-error https://wordhold.vornholt.online/api/health
```

## Pull request previews

An open, non-draft, same-repository pull request targeting `main` gets a preview when it carries the `pr-preview` label. Its URL is `https://<pull-request-number>.pr.wordhold.vornholt.online`. Removing the label, converting the pull request to draft, retargeting it, closing it, or failing its replacement build removes the preview. Destroy is idempotent, so a later lifecycle event retries a failed removal.

Create the label once:

```bash
gh label create pr-preview --repo davidvornholt/wordhold --color 1d76db --description 'Deploy an isolated pull request preview'
```

The `pr-preview` GitHub environment allows only the `main` deployment branch and contains exactly one environment secret, `SOPS_AGE_KEY`. That age identity decrypts only `secrets/pr-preview.yaml`. The file contains the SSH private key restricted by `personal-infra` to the Wordhold preview controller. The wildcard DNS record, host key, public deploy key, preview databases, containers, and Caddy routes belong to `personal-infra`.

Create the environment and its branch policy once:

```bash
gh api --method PUT repos/davidvornholt/wordhold/environments/pr-preview \
  -f 'deployment_branch_policy[protected_branches]=false' \
  -f 'deployment_branch_policy[custom_branch_policies]=true'
gh api --method POST repos/davidvornholt/wordhold/environments/pr-preview/deployment-branch-policies -f name=main
gh secret set SOPS_AGE_KEY --repo davidvornholt/wordhold --env pr-preview < /secure/path/to/preview-age-identity.txt
```

Audit the policy and its sole secret with:

```bash
gh api repos/davidvornholt/wordhold/environments/pr-preview/deployment-branch-policies
gh secret list --repo davidvornholt/wordhold --env pr-preview
```

If teardown fails, rerun the failed trusted consumer run. Do not invoke the host controller directly:

```bash
gh run list --repo davidvornholt/wordhold --workflow pr-preview-deploy.yml --limit 10
gh run rerun --repo davidvornholt/wordhold --failed <run-id>
```

## Preview credential rotation

Rotate the preview age identity without creating a decryption gap. First add the new recipient beside the old recipient in `.sops.yaml`, re-encrypt `secrets/pr-preview.yaml` with `sops updatekeys`, and merge that pull request. Then replace the environment's `SOPS_AGE_KEY`. Finally remove the old recipient and re-encrypt in a second pull request.

Rotate the preview SSH key in three reviewed steps. First add the new public key to the `personal-infra` Wordhold preview controller. Next replace `ci.ssh_private_key` in `secrets/pr-preview.yaml` and its pinned SHA-256 fingerprint in `.github/workflows/pr-preview-host-command.yml`. Remove the old public key from `personal-infra` only after a labeled preview deploys through the new key.

When the server SSH host key changes, verify the new fingerprint through the provider console before changing the pinned `known_hosts` entry in `.github/workflows/pr-preview-host-command.yml`. Never learn a replacement key from the same network connection it is meant to authenticate.
