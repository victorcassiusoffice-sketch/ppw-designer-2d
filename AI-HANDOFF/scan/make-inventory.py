"""Builds AI-HANDOFF/INVENTORY.md from the six scan notes in this folder.

Run from the repo root:  python AI-HANDOFF/scan/make-inventory.py
Add --stats to print the counts only and write nothing.

The words at the top of INVENTORY.md come from _inventory-head.md (written by hand).
Everything below them is copied from the notes, so the notes stay the one place to edit.
"""
import re
import sys
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / "INVENTORY.md"

TOOL_NOTES = [
    ("TOOLS-PLAN", "The 2D plan and the toolbar"),
    ("BUILD-3D-WALK", "The 3D build view and the walk"),
    ("SERVICES-TRADES", "Pipes, cables, fixtures and trades"),
    ("CITY-SITE-ECO", "City, land, garden and eco"),
]


def sections(text):
    """Splits a note into {number: (title, body)} by its '## N. Title' headings."""
    found = {}
    matches = list(re.finditer(r"^## (\d+)\. (.+)$", text, flags=re.M))
    for index, match in enumerate(matches):
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        found[int(match.group(1))] = (match.group(2).strip(), text[match.end():end].strip("\n"))
    return found


def table_rows(body):
    """The data rows of the first markdown table in a section body, as lists of cells."""
    rows = []
    seen_rule = False
    for line in body.splitlines():
        if not line.startswith("|"):
            if rows:
                break
            continue
        cells = [cell.strip() for cell in line.strip().strip("|").split("|")]
        if not seen_rule:
            if all(re.fullmatch(r":?-+:?", cell) for cell in cells):
                seen_rule = True
            continue
        rows.append(cells)
    return rows


def best_key(cell):
    """Reduces a 'best mode' cell to one of a few plain names for counting."""
    low = cell.lower()
    order = [
        ("blk", "Block-style dig and place"),
        ("block", "Block-style dig and place"),
        ("fp", "First person with powers"),
        ("first person", "First person with powers"),
        ("3d", "3D build view"),
        ("plan", "2D plan"),
        ("2d", "2D plan"),
    ]
    hits = [(low.find(key), name) for key, name in order if key in low]
    if not hits:
        return "Other (a sheet, a map or a panel)"
    return min(hits)[1]


def read(name):
    path = HERE / f"{name}.md"
    return path.read_text(encoding="utf-8") if path.exists() else None


def main():
    stats_only = "--stats" in sys.argv
    out = []
    tool_total = 0
    best = Counter()
    per_area = []
    inventory_total = 0
    caps_total = 0

    tool_blocks = []
    for name, title in TOOL_NOTES:
        text = read(name)
        if text is None:
            print(f"missing note: {name}.md")
            continue
        parts = sections(text)
        rows = table_rows(parts[2][1])
        block = [f"### {title}", "",
                 "| Tick | Tool | Best mode | First person with powers | 3D build view | Block-style dig and place | Missing on the web | Needed in the game |",
                 "|---|---|---|---|---|---|---|---|"]
        for cells in rows:
            if len(cells) < 8:
                continue
            tool = re.sub(r"^\d+\s+", "", cells[0])
            best[best_key(cells[5])] += 1
            block.append(f"| [ ] | {tool} | {cells[5]} | {cells[2]} | {cells[3]} | {cells[4]} | {cells[6]} | {cells[7]} |")
            tool_total += 1
        block.append("")
        block.append(f"Where each tool works on the web today, with file and line: `scan/{name}.md`, section 2.")
        block.append("")
        tool_blocks.append("\n".join(block))
        inventory_rows = len(table_rows(parts[1][1]))
        inventory_total += inventory_rows
        per_area.append((title, len(rows), inventory_rows))

    if stats_only:
        print(f"tools: {tool_total}")
        for key, count in best.most_common():
            print(f"  best in {key}: {count}")
        for title, tools, items in per_area:
            print(f"  {title}: {tools} tools, {items} inventory lines")
        return

    head = (HERE / "_inventory-head.md").read_text(encoding="utf-8").rstrip("\n")
    counts = "\n".join(f"| {key} | {count} |" for key, count in best.most_common())
    head = head.replace("{{TOOL_TOTAL}}", str(tool_total)).replace("{{BEST_TABLE}}", counts)
    out.append(head)
    out.append("")
    out.append("## Part 1. The tools, mode by mode (the list to tick)")
    out.append("")
    out.append("One row per tool. \"Best mode\" is where the tool is at home; the three middle columns say how the same tool is used in each play mode. FP = first person with powers. 3D = the 3D build view. BLK = block-style dig and place.")
    out.append("")
    out.extend(tool_blocks)

    out.append("## Part 2. The design format on one page")
    out.append("")
    fmt = read("FORMAT")
    if fmt is None:
        out.append("(The design format note is not written yet: `scan/FORMAT.md`.)")
        out.append("")
    else:
        fparts = sections(fmt)
        for number in (1, 2, 3):
            if number in fparts:
                out.append(f"### {fparts[number][0]}")
                out.append("")
                out.append(fparts[number][1])
                out.append("")
        out.append("Server routes that carry a design, formats in and out, sample designs, and what a second front must do: `scan/FORMAT.md`, sections 4 to 8.")
        out.append("")

    out.append("## Part 3. Everything else, one line each")
    out.append("")
    out.append("Verdicts: KEEP = works, leave it. FRIENDLIER = keep it and make it simpler (the note says how). GAME = bring it into the Unreal game.")
    out.append("")
    for name, title in TOOL_NOTES:
        text = read(name)
        if text is None:
            continue
        parts = sections(text)
        out.append(f"### {title}: tools, views, panels and data")
        out.append("")
        out.append(parts[1][1])
        out.append("")

    routes = read("ROUTES-SERVER-TESTS")
    if routes is not None:
        rparts = sections(routes)
        for number in (1, 2, 3, 4, 5, 6):
            if number in rparts:
                out.append(f"### {rparts[number][0]}")
                out.append("")
                out.append(rparts[number][1])
                out.append("")
                inventory_total += len(table_rows(rparts[number][1]))

    if fmt is not None:
        fparts = sections(fmt)
        if 5 in fparts:
            out.append(f"### {fparts[5][0]}")
            out.append("")
            out.append(fparts[5][1])
            out.append("")

    out.append("### Caps and limits")
    out.append("")
    cap_sources = [(name, title) for name, title in TOOL_NOTES] + [("ROUTES-SERVER-TESTS", "Server, catalogue and tests")]
    for name, title in cap_sources:
        text = read(name)
        if text is None:
            continue
        for number, (heading, body) in sections(text).items():
            if heading.lower().startswith("caps"):
                out.append(f"#### {title}")
                out.append("")
                out.append(body)
                out.append("")
                caps_total += len(table_rows(body))

    text = "\n".join(out).rstrip("\n") + "\n"
    text = text.replace("{{INVENTORY_TOTAL}}", str(inventory_total)).replace("{{CAPS_TOTAL}}", str(caps_total))
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT} : {len(text.splitlines())} lines, {tool_total} tools, {inventory_total} inventory lines, {caps_total} caps")


if __name__ == "__main__":
    main()
