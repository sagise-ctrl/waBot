{ pkgs }: {
  deps = [
    pkgs.nodejs_22
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.python311Packages.gspread
    pkgs.python311Packages.google-auth
  ];
}
