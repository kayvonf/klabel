from flask import Flask, jsonify, request, abort
import uuid
import os
import json

# HACK(kayvonf): remove me
import sys
sys.path.append('weakdb')
from labelingtask import LabelingTask


LABELING_RESULTS_DIR = 'labeling_results'

app = Flask(__name__, static_url_path='/', static_folder='')


###############################################################
# functionality for supporting labeling tasks
###############################################################


def make_filename(name):
	return os.path.join(LABELING_RESULTS_DIR, "%s.json" % name)


# report API errors using JSON responses
@app.errorhandler(404)
def resource_not_found(e):
    return jsonify(error=str(e)), 404


# return information about a labeling task
# For now just return all information
@app.route('/labeling_api/get_task')
def get_labels():
	task_id = request.args.get('task_id')
	filename = make_filename(task_id)

	if os.path.exists(filename):
		task = LabelingTask()
		task.load(filename)
		return jsonify(task.to_dict())
	else:
		abort(404, description="Task %s does not exist" % task_id)


# accept an updated set of labels from the client
# the provided information will be:
#  -- a task id
#  -- a labeler name
#  -- and a list of categorical labels for all task datapoints
#
# The function will update the task's json file with this information.
# If the labeler's results already existed, we'll replace them. If there are no
# results for this labeler we'll add the labeler
@app.route('/labeling_api/store_labels', methods=["POST"])
def store_labels():

	incoming_data = request.get_json()

	task_id = incoming_data["task_id"]
	labeler_name = incoming_data["labeler_name"]
	labels = incoming_data["labels"]
	labeling_times = incoming_data["labeling_times"]

	filename = make_filename(task_id)

	if os.path.exists(filename):
		task = LabelingTask()
		task.load(filename)

		# FIXME(kayvonf): shouldn't be a 404
		if task.get_num_datapoints() != len(labels):
			error_msg = "Incorrect number of datapoints: got %d, expected %d" % (len(results), task.get_num_datapoints())
			abort(404, description=error_msg)

		task.add_labeler_results(labeler_name, labels)
		task.add_labeling_times(labeler_name, labeling_times)
		task.save(filename)

	return jsonify("Success")




