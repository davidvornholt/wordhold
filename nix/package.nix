# wordhold, compiled with `bun build --compile`, with its agent skills in
# share/wordhold-cli/skills/<skill>. passthru.skills names them.
{
  bun,
  callPackage,
  lib,
  stdenvNoCC,
  version,
}:
let
  pname = "wordhold-cli";
  # The files git doesn't ignore; package-source.nix says what that protects.
  src = import ./package-source.nix { inherit lib; } ../.;
  skills = builtins.attrNames (
    lib.filterAttrs (_name: type: type == "directory") (builtins.readDir ../apps/cli/skills)
  );
  # The CLI's runtime dependencies only; the compiled binary bundles them.
  # bun-lock-deps.nix fetches them by the hashes in bun.lock.
  nodeModules = callPackage ./bun-lock-deps.nix {
    inherit bun src;
    name = "${pname}-node-modules";
    installFlags = [
      "--filter"
      "@wordhold/cli"
    ];
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
