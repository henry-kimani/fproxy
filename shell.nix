let
  nixpkgs = fetchTarball "https://github.com/NixOS/nixpkgs/tarball/nixos-unstable";
  pkgs = import nixpkgs { config={}; overlay=[]; };
in

  pkgs.mkShellNoCC {
    packages = with pkgs; [
      nix-ld
      electron
    ];

    shellHook = ''
      export NODE_ENV="development";
      zsh
    '';
  }

