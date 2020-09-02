# klabel for Vid2Player

This branch is designed for manual annotations of tennis videos for Vid2Player project.

### File Structure
Before you start, download the video frames and put them under `klabel/vid2player/fileserver/` in the following file structure:
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

### Install
1. Install flask for local file server
```
pip3 install flask flask-cors
```

2. Enter `klabel/vid2player/fileserver` and launch the file server
```
bash ./launch.sh
```

### Get started

1. Enter `kalbel/vid2player/` in your file browser and choose to open it in chrome, read the instructions on the page and take a look at the example annotations, you can also watch this video to get started. Then you are ready to go.

2. After you finish labeling, just click `Persist Annotations` and save the json file


### For using Olimar as file server 
In case you are short on space in your local disk, you can use olimar.stanford.edu as the remote file server, but it will be slower. You need to ask for a user account before doing the following. 
1. Copy server over: `scp -r fserve.py cristobal@olimar.stanford.edu:/mnt/hdd-www/www/racket2game/labeler/fserve.py`
2. SSH to Olimar: `ssh username@olimar.stanford.edu -L 1234:localhost:1234`. (Flag will forward the server to localhost)
3. Navigate to images: `cd ../../mnt/hdd-www/www/racket2game/labeler`
4. Run the server: `export FLASK_APP=fserve.py && python3 -m flask --host=0.0.0.0 --port=1234`
5. Locally, make sure `var server_url = "http://localhost:1234"`
