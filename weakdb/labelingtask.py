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
		self.categories = {}

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

	def set_categories(self, categories):

		# number keys are used in the viewer
		assert len(categories) <= 10

		self.categories = {}
		
		# start with 1 for ease of UI in labeler (0 key is not next to 1 key)
		index = 1
		for c in categories:
			self.categories[c] = index
			index = index+1
			if index == 10:
				index = 0

	def set_category_mapping(self, categories):
		assert len(categories) <= 10
		self.categories = categories

	def load(self, filename):
		print("Not implemented...")

	def save(self, target_dir):

		task_info = {
			"task_id" : self.task_id,
			"description" : self.description,
			"categories" : self.categories,
			"datapoint_urls" : self.datapoint_urls,
			"labeler_results" : {}
		}

		if len(self.model_scores) != 0:
			assert len(self.model_scores) == len(self.datapoint_urls)
			task_info["model_scores"] = self.model_scores

		with open(self.get_task_filename(target_dir), "wt") as f:
			f.write(json.dumps(task_info))
