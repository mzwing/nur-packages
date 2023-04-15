{ sources
, stdenv
, lib
, makeWrapper
, electron
, makeDesktopItem
, nodePackages
, imagemagick
, ...
}:

let
  desktopItem = makeDesktopItem {
    name = "Baiyuanneko's Blog Generator";
    desktopName = "bbg";
    comment = "A static blog generator based on Electron Technology.";
    icon = "bbg";
    exec = "bash -c \"bbg %u > /dev/null\"";
    categories = [ "Office" ];
  };
in
stdenv.mkDerivation rec {
  inherit (sources.bbg) pname version src;

  nativeBuildInputs = [
    makeWrapper
    nodePackages.asar
  ];

  dontUnpack = true;

  installPhase = ''
    mkdir -p "$out/bin"
    makeWrapper "${electron}/bin/electron" "$out/bin/bbg" \
      --add-flags "$out/share/bbg/app.asar"
    install -D "$src" "$out/share/bbg/app.asar"
    install -D "${desktopItem}/share/applications/"* \
      --target-directory="$out/share/applications/"
    asar extract-file "$src" resources/icon.png
    icon=icon.png
    icon_dir="$out/share/icons/hicolor"
    for s in 16 24 32 48 64 128 256 512; do
      size="''${s}x''${s}"
      echo "create icon \"$size\""
      mkdir -p "$icon_dir/$size/apps"
      ${imagemagick}/bin/convert -resize "$size" "$icon" "$icon_dir/$size/apps/bbg.png"
    done
  '';

  meta = with lib; {
    description = "A static blog generator based on Electron Technology.";
    homepage = "https://github.com/bbg-contributors/bbg";
    license = licenses.unlicense;
    maintainers = with maintainers; [ mzwing ];
  };
}
