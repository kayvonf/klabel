from flask import Flask, jsonify, request, abort
import uuid
import os
import json


LABELING_RESULTS_DIR = 'labeling_results'

app = Flask(__name__, static_url_path='/', static_folder='')


###############################################################
# functionality for supporting labeling tasks
###############################################################


def make_filename(name):
	return os.path.join(LABELING_RESULTS_DIR, "%s.json" % name)

# report API errors
@app.errorhandler(404)
def resource_not_found(e):
    return jsonify(error=str(e)), 404

# return information about a labeling task
# For now just return all information
@app.route('/labeling_api/get_task')
def get_labels():
	task_id = request.args.get('taskid')
	filename = make_filename(task_id)
	if os.path.exists(filename):
		with open(filename, "rt") as f:
			task_data = json.load(f)
			return jsonify(task_data)
	else:
		abort(404, description="Task %s DOES NOT exist" % task_id)

@app.route('/labeling_api/store_labels')
def store_labels():

	# todo:
	#   -- expects: task_id, labeler_id (case insensitive), list of all labels
	#   -- check to see if file exists
	#   -- parse the file json 
	#   -- add or update a labeler row

	# update the task json file on disk
	return "Store_labels not implemented!"

