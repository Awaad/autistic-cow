"""CLI: `python -m district_gen extract ...`

Only the extract stage is wired for now. Downstream subcommands (simplify,
gameplay, emit, report) land after real extract data returns.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .bbox import BBox, KYRENIA_HARBOR_CENTER, KYRENIA_HARBOR_RADIUS_M
from .extract import fetch_overpass, fetch_overture
from .ir import normalize_overpass, normalize_overture
from .report import build_report


def _resolve_bbox(args: argparse.Namespace) -> BBox:
    lat, lon = args.center
    return BBox.from_center(lat, lon, args.radius)


def cmd_extract(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    bbox = _resolve_bbox(args)
    ir_dir = out_dir / "ir"
    ir_dir.mkdir(parents=True, exist_ok=True)

    providers = ["osm", "overture"] if args.provider == "both" else [args.provider]
    for provider in providers:
        if provider == "osm":
            res = fetch_overpass(bbox, out_dir, endpoint=args.overpass_url, force=args.force)
            ir = normalize_overpass(res.raw, bbox.as_tuple())
        else:
            res = fetch_overture(bbox, out_dir, force=args.force)
            ir = normalize_overture(res.raw.get("features", []), bbox.as_tuple())
        (ir_dir / f"{provider}.json").write_text(
            json.dumps(ir.to_dict(), indent=2, sort_keys=True) + "\n"
        )
        src = "cache" if res.from_cache else "network"
        print(f"[{provider}] {src}: {ir.counts()} -> {ir_dir / (provider + '.json')}",
              file=sys.stderr)
    return 0


def cmd_report(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    report = build_report(out_dir)
    report_path = out_dir / "report.json"
    report_path.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n")
    size = report_path.stat().st_size
    for provider, summ in report["providers"].items():
        print(f"[{provider}] {summ['counts']} | "
              f"levels {summ['buildings']['levels_coverage_pct']}% | "
              f"named POIs {summ['pois']['named_pct']}%", file=sys.stderr)
    rec = report["coverage_recommendation"]
    print(f"[recommendation] default={rec.get('default')} — {rec.get('reason')}",
          file=sys.stderr)
    print(f"[report] {size} bytes -> {report_path}  (Report Ready)",
          file=sys.stderr)
    return 0
 
 
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="district_gen")
    sub = p.add_subparsers(dest="command", required=True)
 
    ex = sub.add_parser("extract", help="pull + cache raw map data, emit normalized IR")
    ex.add_argument("--provider", choices=["osm", "overture", "both"], default="both")
    ex.add_argument("--center", nargs=2, type=float, metavar=("LAT", "LON"),
                    default=list(KYRENIA_HARBOR_CENTER))
    ex.add_argument("--radius", type=float, default=KYRENIA_HARBOR_RADIUS_M,
                    metavar="METERS")
    ex.add_argument("--out", default="./out/kyrenia-harbor")
    ex.add_argument("--overpass-url",
                    default="https://overpass-api.de/api/interpreter")
    ex.add_argument("--force", action="store_true", help="ignore cache, refetch")
    ex.set_defaults(func=cmd_extract)
 
    rp = sub.add_parser("report", help="distill IR into a compact report.json (send me this)")
    rp.add_argument("--out", default="./out/kyrenia-harbor")
    rp.set_defaults(func=cmd_report)
    return p
 
def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())