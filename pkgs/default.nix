{ ... }:

{
  sources = callPackage ../_sources/generated.nix { };

  bbg = callPackage ./bbg { };
}
