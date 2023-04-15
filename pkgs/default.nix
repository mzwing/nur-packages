{ lib, newScope, selfLib }:

lib.makeScope newScope (
  self:
  let
    inherit (self) callPackage;
  in
  {
    sources = callPackage ../_sources/generated.nix { };

    bbg = callPackage ./bbg { };
  }
)
