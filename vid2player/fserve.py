import os
from flask import Flask, send_from_directory, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)


def dirs(path):
    return [d for d in os.listdir(path)
            if (os.path.isdir(os.path.join(path, d)) and not d.startswith("__"))]


@app.route("/fs")
def file_structure():
    fs = { video: dirs(video) for video in dirs(".") }
    return jsonify(fs)


@app.route("/frames/<path:d>")
def send_frame_names(d):
    frames = [f for f in os.listdir(d) if os.path.isfile(os.path.join(d, f))]
    return jsonify(frames)


@app.route("/frame/<path:f>")
def send_frame(f):
    return send_from_directory(".", f)
