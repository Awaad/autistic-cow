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
from .ir import normalize_overpass, normalize_overture, Poi
from .report import build_report
from .roles import classify, validate_config
from .project import load_ir, project_ir
from .simplify import ProjectedIR, SimplifiedBuilding, simplify
from .gameplay import build_gameplay, load_gameplay_config, validate_child_safety
from . import emit as emitter
from .curate import build_curation
from .seed_sql import emit_seed


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


def cmd_roles(args: argparse.Namespace) -> int:
    if args.classify:
        provider, _, category = args.classify.partition(":")
        c = classify(Poi(f"{provider}:x", [0.0, 0.0], category, args.name, {}))
        print(json.dumps({"role": c.role, "subtype": c.subtype,
                          "name_tier": c.name_tier, "gameplay": c.gameplay}, indent=2))
        return 0
    counts = validate_config()  # raises if a category is claimed by two roles
    print(f"allowlist OK — venue={counts['venue']} zone={counts['zone']} "
          f"smashable={counts['smashable']} categories; named-backdrop default for the rest",
          file=sys.stderr)
    return 0

def cmd_project(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    proj_dir = out_dir / "projected"
    proj_dir.mkdir(parents=True, exist_ok=True)
    providers = ["osm", "overture"] if args.provider == "both" else [args.provider]
    for provider in providers:
        ir_path = out_dir / "ir" / f"{provider}.json"
        if not ir_path.exists():
            print(f"[{provider}] no IR at {ir_path}; run extract first", file=sys.stderr)
            continue
        ir = load_ir(ir_path)
        pir = project_ir(ir, sea_bearing_deg=args.sea_bearing,
                         half_extent_m=args.half_extent)
        (proj_dir / f"{provider}.json").write_text(
            json.dumps(pir.to_dict(), indent=2, sort_keys=True) + "\n")
        print(f"[{provider}] projected {pir.counts()} | bounds {pir.bounds} | "
              f"sea_bearing={args.sea_bearing}°", file=sys.stderr)
    return 0

def cmd_simplify(args: argparse.Namespace) -> int:
    from dataclasses import asdict
    out_dir = Path(args.out)
    simp_dir = out_dir / "simplified"
    simp_dir.mkdir(parents=True, exist_ok=True)
    providers = ["osm", "overture"] if args.provider == "both" else [args.provider]
    for provider in providers:
        pj_path = out_dir / "projected" / f"{provider}.json"
        if not pj_path.exists():
            print(f"[{provider}] no projected file at {pj_path}; run project first",
                  file=sys.stderr)
            continue
        pir = ProjectedIR.from_dict(json.loads(pj_path.read_text()))
        buildings = simplify(pir)
        (simp_dir / f"{provider}.json").write_text(
            json.dumps([asdict(b) for b in buildings], indent=2, sort_keys=True) + "\n")
        before, after = len(pir.buildings), len(buildings)
        merged = before - after
        pct = round(100 * merged / before, 1) if before else 0.0
        status = "UNDER" if after <= 350 else "OVER"
        print(f"[{provider}] {before} footprints -> {after} colliders "
              f"(merged {merged}, -{pct}%) | budget 350: {status}", file=sys.stderr)
    return 0

def cmd_gameplay(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    gp_dir = out_dir / "gameplay"
    gp_dir.mkdir(parents=True, exist_ok=True)
    provider = args.provider
    simp_path = out_dir / "simplified" / f"{provider}.json"
    proj_path = out_dir / "projected" / f"{args.poi_provider}.json"
    if not simp_path.exists() or not proj_path.exists():
        print("need both simplified/ and projected/ files; run project + simplify first",
              file=sys.stderr)
        return 1
    buildings = [SimplifiedBuilding(**d) for d in json.loads(simp_path.read_text())]
    geo_proj = ProjectedIR.from_dict(json.loads((out_dir / "projected" / f"{provider}.json").read_text()))
    poi_proj = ProjectedIR.from_dict(json.loads(proj_path.read_text()))
    # bounds from the GEOMETRY provider; POIs from the POI provider (hybrid)
    layer = build_gameplay(provider, geo_proj.bounds, buildings, poi_proj.pois, seed=args.seed)
 
    excl = load_gameplay_config()["camel"]["child_exclusion_m"]
    validate_child_safety(layer, excl)  # HARD GATE (ADR-019) — raises to fail the build
 
    (gp_dir / f"{provider}.json").write_text(
        json.dumps(layer.to_district_dict(), indent=2, sort_keys=True) + "\n")
    print(f"[{provider}] children={len(layer.childZones)} lanes={len(layer.camelLanes)} "
          f"beer={len(layer.beerSpots)} venues={len(layer.venues)} "
          f"smashables={len(layer.smashables)} backdrop={len(layer.backdrop)} "
          f"| child-safety: PASS", file=sys.stderr)
    for w in layer.warnings:
        print(f"  ! {w}", file=sys.stderr)
    return 0


def cmd_emit(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    gp_path = out_dir / "gameplay" / f"{args.provider}.json"
    if not gp_path.exists():
        print(f"no gameplay file at {gp_path}; run gameplay first", file=sys.stderr)
        return 1
    d = json.loads(gp_path.read_text())
    emit_dir = out_dir / "emit"
    emit_dir.mkdir(parents=True, exist_ok=True)
    slug = args.slug
 
    (emit_dir / f"{slug}-gen.geom.ts").write_text(emitter.emit_geom(d, use_overture=True))
    (emit_dir / f"{slug}-gen.play.ts").write_text(emitter.emit_play(d))
    (emit_dir / f"{slug}-gen.ts").write_text(emitter.emit_index(slug))
    (emit_dir / f"{slug}-ar-candidates.json").write_text(emitter.emit_ar_candidates(d))
    (emit_dir / "ATTRIBUTION.txt").write_text(emitter.emit_attribution(use_overture=True))
 
    # inline budget check (full curation report later)
    colliders = len(d["buildings"])
    dynamic = (len(d["smashables"]) + d["stallCount"] + d["crateCount"] + d["scooterCount"])
    c_ok = "OK" if colliders <= 350 else "OVER"
    dyn_ok = "OK" if dynamic <= 250 else "OVER"
    print(f"[emit] {slug}-gen.ts + .geom.ts + .play.ts -> {emit_dir}", file=sys.stderr)
    print(f"[budget] static colliders {colliders}/350 {c_ok} | "
          f"dynamic bodies {dynamic}/250 {dyn_ok} | "
          f"lanes {len(d['camelLanes'])} | venues {len(d['venues'])} | "
          f"backdrop {len(d['backdrop'])}", file=sys.stderr)
    if colliders > 350 or dynamic > 250 or len(d["camelLanes"]) < 2:
        print("  ! budget/lane check failed — crop with project --half-extent or curate",
              file=sys.stderr)
    return 0


def cmd_curate(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    d = json.loads((out_dir / "gameplay" / f"{args.provider}.json").read_text())
    rep = build_curation(d)
    (out_dir / "curation.json").write_text(json.dumps(rep, indent=2, sort_keys=True) + "\n")
    b, i = rep["budget"], rep["invariants"]
    print(f"[curate] SHIP={rep['ship']}", file=sys.stderr)
    print(f"  colliders {b['static_colliders']['value']}/350 "
          f"| dynamic {b['dynamic_bodies']['value']}/250 "
          f"| lanes {i['camel_lanes']['value']} (min 2)", file=sys.stderr)
    diff = rep["diff_vs_hand_authored"]["buildings"]
    print(f"  buildings vs hand-authored: {diff['generated']} vs {diff['hand_authored']} "
          f"({diff['ratio']}x) — the curation-cost finding", file=sys.stderr)
    for w in rep["warnings"]:
        print(f"  ! {w}", file=sys.stderr)
    return 0 if rep["ship"] else 2

def cmd_seed(args: argparse.Namespace) -> int:
    out_dir = Path(args.out)
    d = json.loads((out_dir / "gameplay" / f"{args.provider}.json").read_text())
    sql = emit_seed(d, region_slug=args.region, district_slug=args.slug,
                    scene_asset_key=f"{args.slug}-gen")
    path = out_dir / "emit" / f"{args.slug}-seed.sql"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(sql)
    print(f"[seed] {sql.count('INSERT INTO venues')} venues -> {path}", file=sys.stderr)
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
 
    rp = sub.add_parser("report", help="distill IR into a compact report.json")
    rp.add_argument("--out", default="./out/kyrenia-harbor")
    rp.set_defaults(func=cmd_report)
    
    rl = sub.add_parser("roles", help="validate the POI allowlist / classify a category")
    rl.add_argument("--classify", metavar="PROVIDER:CATEGORY",
                    help="e.g. overture:bar or osm:bench")
    rl.add_argument("--name", default="Sample", help="name to test named-backdrop logic")
    rl.set_defaults(func=cmd_roles)
    
    pj = sub.add_parser("project", help="WGS84 IR -> scene-metre coords (UTM36N)")
    pj.add_argument("--provider", choices=["osm", "overture", "both"], default="both")
    pj.add_argument("--out", default="./out/kyrenia-harbor")
    pj.add_argument("--sea-bearing", type=float, default=0.0,
                    help="compass degrees toward the sea (0=N, 90=E); curation knob")
    pj.add_argument("--half-extent", type=float, default=None,
                    help="crop to +/- this many metres (real scale kept); omit for full cell")
    pj.set_defaults(func=cmd_project)
    
    sp = sub.add_parser("simplify", help="projected footprints -> BuildingSpec boxes + terrace merge")
    sp.add_argument("--provider", choices=["osm", "overture", "both"], default="osm")
    sp.add_argument("--out", default="./out/kyrenia-harbor")
    sp.set_defaults(func=cmd_simplify)
    
    gp = sub.add_parser("gameplay", help="place children/lanes/beer/venues from POI roles")
    gp.add_argument("--provider", choices=["osm", "overture"], default="osm",
                    help="which simplified geometry to build on (hybrid: osm)")
    gp.add_argument("--poi-provider", choices=["osm", "overture"], default="overture",
                    help="which projected POIs to place (hybrid: overture)")
    gp.add_argument("--out", default="./out/kyrenia-harbor")
    gp.add_argument("--seed", type=int, default=1)
    gp.set_defaults(func=cmd_gameplay)
    
    em = sub.add_parser("emit", help="district -> split geom/play/index .ts + attribution")
    em.add_argument("--provider", choices=["osm", "overture"], default="osm")
    em.add_argument("--out", default="./out/kyrenia-harbor")
    em.add_argument("--slug", default="kyrenia-harbor")
    em.set_defaults(func=cmd_emit)
    
    cu = sub.add_parser("curate", help="perf-budget gate + invariants + diff vs hand-authored")
    cu.add_argument("--provider", choices=["osm", "overture"], default="osm")
    cu.add_argument("--out", default="./out/kyrenia-harbor")
    cu.set_defaults(func=cmd_curate)
    
    sd = sub.add_parser("seed", help="emit region/district/venue seed SQL")
    sd.add_argument("--provider", choices=["osm", "overture"], default="osm")
    sd.add_argument("--out", default="./out/kyrenia-harbor")
    sd.add_argument("--slug", default="kyrenia-harbor")
    sd.add_argument("--region", default="north-cyprus")
    sd.set_defaults(func=cmd_seed)
    
    return p
 
def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())