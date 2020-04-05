# klabel

## Core

### `klabel.js`
Central file that manages annotation and frame state. Must be given images to process by front-end UI.

### `kmath.js`
Math utils and classes, e.g. `Point2D` and `BBox2D`

## Examples

### `basic`
Example of UI which loads in local images from `/files`

### `vid2player`
Example which loads in images from a file server. Expects the file system of following structure:

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

Sample server available: `fserve.py`. To run:
1. Copy `fserve.py` to filesystem, update domain in `vid2player.html`.
2. Run the server: `export FLASK_APP=fserve.py && flask run --port 1234`
