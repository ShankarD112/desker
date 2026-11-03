#!/usr/bin/env python3
"""Reproducible tiny synthetic FASTQ alignment tutorial; standard library only.

This is an exact-string teaching aligner, NOT a production aligner (no quality,
reverse-complement, indels, multi-mapping or realistic RNA-seq quantification).
"""
from pathlib import Path
import argparse, json

ROOT = Path(__file__).resolve().parent

def read_fasta(path):
    result, name = {}, None
    for line in path.read_text().splitlines():
        if line.startswith(">"):
            name = line[1:].split()[0]
            result[name] = ""
        elif name:
            result[name] += line.strip().upper()
    return result

def read_fastq(path):
    lines = path.read_text().splitlines()
    if len(lines) % 4: raise ValueError("FASTQ must have four lines per read")
    for i in range(0, len(lines), 4):
        head, seq, plus, qual = lines[i:i + 4]
        if not head.startswith("@") or not plus.startswith("+") or len(seq) != len(qual):
            raise ValueError(f"Malformed FASTQ record at line {i+1}")
        yield head[1:].split()[0], seq.upper()

def align(sequence, genome, mismatches=0):
    hits = []
    for chrom, ref in genome.items():
        for pos in range(len(ref) - len(sequence) + 1):
            if sum(a != b for a, b in zip(sequence, ref[pos:pos+len(sequence)])) <= mismatches:
                hits.append((chrom, pos))
                if len(hits) > 1: return None, "ambiguous"
    return (hits[0], "mapped") if hits else (None, "unmapped")

def run(reference="v1", trim=False, mismatches=0):
    genome = read_fasta(ROOT / f"reference_{reference}.fa")
    counts = {chrom: 0 for chrom in genome}
    records = []
    for name, raw in read_fastq(ROOT / "reads_100.fastq"):
        seq = raw[:-6] if trim and raw.endswith("GGGGGG") else raw
        match, status = align(seq, genome, mismatches)
        if match: counts[match[0]] += 1
        records.append({"read": name, "status": status,
                        "contig": match[0] if match else None,
                        "start": match[1] if match else None,
                        "trimmed": len(seq) != len(raw)})
    return {"reference": reference, "trim": trim, "mismatches": mismatches,
            "total": len(records), "mapped": sum(v["status"] == "mapped" for v in records),
            "counts": counts, "reads": records}

if __name__ == "__main__":
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--reference", choices=("v1", "v2"), default="v1")
    p.add_argument("--trim", action="store_true", help="Trim synthetic GGGGGG adapter suffix")
    p.add_argument("--mismatches", type=int, choices=(0, 1), default=0)
    args = p.parse_args()
    print(json.dumps(run(args.reference, args.trim, args.mismatches), indent=2))
