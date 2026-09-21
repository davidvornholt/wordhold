# Wordhold

Vocabulary practice from photographed textbook pages, with spaced repetition and pronunciation audio.

## Development

Use the Bun version in `package.json`:

```sh
bun install
just dev
```

`just dev` generates the environment, starts PostgreSQL, applies migrations, and starts the app at `http://localhost:3000`. Keep port 3000 free for the configured GitHub OAuth callback. Configuration lives in `config/dev.yaml`, encrypted values in `secrets/dev.yaml`, and machine overrides in ignored `config/dev.local.yaml`; secret shapes are in `secrets/dev.example.yaml`.

Run `bun run check:fix` for the full gate. See [database operations](packages/db/README.md) for backfills required when upgrading old databases and [provider operations](apps/web/README.md) for credential rotation and verification. Run `provider:verify` in `apps/web` before deploying a changed judge or sentence provider.

## Deployment

[personal-infra](https://github.com/davidvornholt/personal-infra) owns `https://wordhold.vornholt.online`. Back up PostgreSQL and `WORDHOLD_DATA_DIR` together; the latter contains original page images and generated audio.

Label a same-repository, non-draft PR `pr-preview` for `https://<number>.pr.wordhold.vornholt.online`. Remove the label to tear it down. If teardown fails, rerun the failed `pr-preview-deploy.yml` workflow through GitHub Actions.

## Preview credential rotation

Rotate the preview age identity without creating a decryption gap. First add the new recipient beside the old recipient in `.sops.yaml`, re-encrypt `secrets/pr-preview.yaml` with `sops updatekeys`, and merge that pull request. Then replace the environment's `SOPS_AGE_KEY`. Finally remove the old recipient and re-encrypt in a second pull request.

Rotate the preview SSH key in three reviewed steps. First add the new public key to the `personal-infra` Wordhold preview controller. Next replace `ci.ssh_private_key` in `secrets/pr-preview.yaml` and its pinned SHA-256 fingerprint in `.github/workflows/pr-preview-deploy.yml`. Remove the old public key from `personal-infra` only after a labeled preview deploys through the new key.

When the server SSH host key changes, verify the new fingerprint through the provider console before changing the pinned `known_hosts` entry in `.github/workflows/pr-preview-deploy.yml`. Never learn a replacement key from the same network connection it is meant to authenticate.
