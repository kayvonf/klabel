import json
import os
import uuid

# todo: merge datafiles from different instances (to avoid folks from needing to hit the same server)

class LabelingTask:

	def __init__(self):
		self.task_id = self.generate_task_id()
		self.name = "task_%s" % self.task_id
		self.datapoint_urls = []
		self.model_scores = []

	def generate_task_id(self):
		return uuid.uuid4().hex

	def get_task_filename(self, target_dir):
		return os.path.join(target_dir, "%s.json" % self.task_id)

	def set_description(self, description):
		self.description = description

	def set_datapoints(self, datapoint_urls):
		self.datapoint_urls = datapoint_urls

	def set_model_scores(self, model_scores):
		self.model_scores = model_scores

	def load(self, filename):
		print("Not implemented...")

	def save(self, target_dir):

		task_info = {
			"task_id" : self.task_id,
			"description" : self.description,
			"datapoint_urls" : self.datapoint_urls,
			"labeler_results" : {}
		}

		if len(self.model_scores) != 0:
			assert len(self.model_scores) == len(self.datapoint_urls)
			task_info["model_scores"] = self.model_scores

		with open(self.get_task_filename(target_dir), "wt") as f:
			f.write(json.dumps(task_info))
