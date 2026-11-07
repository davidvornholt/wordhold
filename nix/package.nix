# wordhold, compiled with `bun build --compile`, with its agent skills in
# share/wordhold-cli/skills/<skill>. passthru.skills names them.
{
  bun,
  lib,
  stdenvNoCC,
  version,
}:
let
  pname = "wordhold-cli";
  # Keeps dependencies, build output, and local state, which a dirty checkout or
  # a path: flake would otherwise copy, out of the store.
  # lib.fileset can't exclude a directory by name at any depth, so this filters
  # the source by name instead.
  src = lib.cleanSourceWith {
    src = lib.cleanSource ../.;
    filter =
      path: _type:
      !builtins.elem (baseNameOf path) [
        ".direnv"
        ".env.local"
        ".output"
        ".tanstack"
        ".turbo"
        "dist"
        "node_modules"
        "playwright-report"
        "test-results"
      ];
  };
  skills = builtins.attrNames (
    lib.filterAttrs (_name: type: type == "directory") (builtins.readDir ../apps/cli/skills)
  );
  # The CLI's runtime dependencies only; the compiled binary bundles them.
  # The name holds Bun's version and a digest of bun.lock, so a change to either
  # installs them again and fails on a stale hash instead of silently reusing
  # the old dependencies.
  lockDigest = builtins.substring 0 12 (builtins.hashFile "sha256" ../bun.lock);
  nodeModules = stdenvNoCC.mkDerivation {
    name = "${pname}-node-modules-bun-${bun.version}-${lockDigest}";
    inherit src;
    nativeBuildInputs = [ bun ];
    dontConfigure = true;
    buildPhase = ''
      runHook preBuild
      export HOME=$TMPDIR BUN_INSTALL_CACHE_DIR=$TMPDIR/bun-cache
      bun install --frozen-lockfile --production --ignore-scripts --no-progress --filter @wordhold/cli
      runHook postBuild
    '';
    installPhase = ''
      runHook preInstall
      mkdir "$out"
      find . -type d -name node_modules -prune -print0 | tar --null --files-from=- -cf - | tar -C "$out" -xf -
      runHook postInstall
    '';
    dontFixup = true;
    outputHash = "sha256-aPrO/A2n+URwq2D1asarbNbHx/C+dq2Oqkqlvn5DeP0=";
    outputHashAlgo = "sha256";
    outputHashMode = "recursive";
    impureEnvVars = lib.fetchers.proxyImpureEnvVars;
  };
in
stdenvNoCC.mkDerivation {
  inherit pname version src;
  nativeBuildInputs = [ bun ];
  dontConfigure = true;
  buildPhase = ''
    runHook preBuild
    export HOME=$TMPDIR
    cp -r --no-preserve=mode ${nodeModules}/. .
    cd apps/cli
    bun run build
    runHook postBuild
  '';
  installPhase = ''
    runHook preInstall
    install -Dm755 dist/wordhold "$out/bin/wordhold"
    mkdir -p "$out/share/${pname}"
    cp -r skills "$out/share/${pname}/skills"
    runHook postInstall
  '';
  # Bun appends the bundled program to its own executable; leave it intact.
  dontStrip = true;
  dontPatchELF = true;

  passthru = { inherit nodeModules skills; };
  meta = {
    description = "Command-line tool for reading and adding to a Wordhold vocabulary";
    homepage = "https://github.com/davidvornholt/wordhold";
    mainProgram = "wordhold";
  };
}
