# klabel

## Core

### `klabel.js`
Central file that manages annotation and frame state. Must be given images to
process by front-end UI.

### `kmath.js`
Math utils and classes, e.g. `Point2D` and `BBox2D`

### `kutils.js`
General utils, e.g. downloading a file

## Examples

### `basic`
Example of UI which loads in local images from `/files`

### `vid2player`
Example which loads in images from a file server. Allows annotations to be
saved in localStorage, and persisted to a JSON

Expects the file system of following structure:

```
├── fserve.py
├── video1
│   ├── point1
│   │   ├── 00001227.jpg
│   │   └── 00001228.jpg
│   └── point2
│       ├── 00001260.jpg
│       └── 00001261.jpg
└── video2
    └── point1
    └── point2
    └── point3
```

| End-point                           | Return value |
|-------------------------------------|---------------------------------------|
| `/fs`                               | Representation of file system |
| `/frames/{video}/{point}`           | List of files for given point |
| `/frame/{video}/{point}/{filename}` | Single frame from a point.  |

Install
1. 'pip3 install flask flask-cors'

Sample server available: `fserve.py`. To run:
1. Copy `fserve.py` to filesystem, update domain in `vid2player.html`.
2. Run the server: `export FLASK_APP=fserve.py && flask run --port=1234`

For Olimar:
1. Copy server over: `scp -r fserve.py cristobal@olimar.stanford.edu:/mnt/hdd-www/www/racket2game/labeler/fserve.py`
2. SSH to Olimar: `ssh cristobal@olimar.stanford.edu -L 1234:localhost:1234`. (Flag will forward the server to localhost)
3. Navigate to images: `cd ../../mnt/hdd-www/www/racket2game/labeler`
4. Run the server: `export FLASK_APP=fserve.py && python3 -m flask --host=0.0.0.0 --port=1234`
5. Locally, make sure `var server_url = "http://localhost:1234"`
