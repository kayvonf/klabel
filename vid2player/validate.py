
# Script takes a JSON of annotations and validates the following ruels:
# (1) Serves must be at beginning of point
# (2) Every shot must have an associated bounce
# (3) Pairs shots and bounces are on opposite sides
# (4) Each shot alternates sides

import json
from collections import defaultdict

JSON_PATH = "test.json";
NET_CUTOFF = 0.5
ERRORS = []


def dd_to_d(dd):
    if isinstance(dd, defaultdict):
        return {k: dd_to_d(v) for k, v in dd.items()}
    return dd


def side(p):
    # TODO: finetune this to the correct value
    return p.y > NET_CUTOFF


def load(path):
    return json.load(open(path, "r"))

    
def parse(j):
    # { vid => { pid => [ annotation ] } }
    sequence = defaultdict(lambda: defaultdict(list))

    for f, annotations in j.items():
        # Parse filename to get identifiers
        vid, pid, fid = f.split(".")[0].split("/")[-3:]
        fid = int(fid)

        # Parse annotations
        data = json.loads(annotations)
        # Filter out only the "point" types
        data = [a for a in data if a["type"] == 1]

        if len(data) > 1:
            ERRORS.append("{} {} {}: Only expected one annotation per frame.".format(vid, pid, fid))
            continue

        # Take the single point type
        data = data[0]

        # Massage into new data structure
        annotation = {
            "fid":  int(fid),
            "x":    data["pt"]["x"],
            "y":    data["pt"]["y"],
            "type": data["note"],
        }

        sequence[vid][pid].append(annotation)

    # Sort by frame id
    for vid, points in sequence.items():
        for pid, annotations in points.items():
            sequence[vid][pid] = sorted(annotations, key=lambda a: a["fid"])

    return dd_to_d(sequence)


def validate(sequence):
    for vid, points in sequence.items():
        for pid, frames in points.items():
            for fid, annotation in enumerate(frames):
                if fid == 0 and annotation["type"] != "serve":
                    ERRORS.append("{} {} {}: Points should start with serves.".format(vid, pid, fid))

    return ERRORS


def display(errors):
    print("ERRORS:", len(errors))
    for err in errors:
        print(err)


def pipeline(path):
    j = load(path)
    s = parse(j)
    e = validate(s)
    display(e)


pipeline(JSON_PATH)
