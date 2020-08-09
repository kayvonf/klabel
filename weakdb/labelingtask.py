import json
import os
import uuid



class LabelingTask:

	def __init__(self):
		self.task_id = self.generate_task_id()
		self.description = ""
		self.datapoint_urls = []
		self.categories = {}
		self.labeler_results = {}

	def generate_task_id(self):
		return uuid.uuid4().hex

	def get_num_datapoints(self):
		return len(self.datapoint_urls)

	# meant to only be an internal method
	def get_task_filename(self, target_dir):
		return os.path.join(target_dir, "%s.json" % self.task_id)

	def set_description(self, description):
		self.description = description

	def set_datapoints(self, datapoint_urls):
		self.datapoint_urls = datapoint_urls

	# Set the list of category names
	# The klabeler UI keys and colors will be mapped to the categories automatically
	# The calledr should use set_category_mapping() if they want to explicitly
	# map certain keys and colors to the categories.
	def set_categories(self, categories):

		# number keys are used to label categorical data in klabel,
		# so cap at 10 categories
		assert len(categories) <= 10

		self.categories = {}
		
		# https://public.tableau.com/views/TableauColors/ColorPaletteswithRGBValues?%3Aembed=y&%3AshowVizHome=no&%3Adisplay_count=y&%3Adisplay_static_image=y

		# using Tableau 10 as defaults
		colors = [
			"rgba(103, 191, 92, .75)",
			"rgba(237, 102, 93, .75)",
			"rgba(255, 158, 74, .75)",
			"rgba(114, 158, 206, .75)",
			"rgba(173, 139, 201, .75)",
			"rgba(168, 120, 110, .75)",
			"rgba(237, 151, 202, .75)",
			"rgba(162, 162, 162, .75)",
			"rgba(205, 204, 93, .75)",
			"rgba(109, 204, 218, .75)",		
		]

		# create a category to key mapping. Start with 1 for ease of
		# UI in labeler (0 key is not next to 1 key)
		index = 1
		for c in categories:
			self.categories[c] = { "value": index, "color" : colors[index]}
			index = index+1
			if index == 10:
				index = 0

	# allows for client to explicitly map category names to key bindings and colors
	def set_category_mapping(self, categories):
		assert len(categories) <= 10
		self.categories = categories

	def add_labeler_results(self, labeler_name, labels):

		assert len(labels) == self.get_num_datapoints()

		canonical_name = labeler_name.lower()

		# will replace prior results for the labeler if they exist
		self.labeler_results[canonical_name] = labels

	def to_dict(self):
		task_info = {
			"task_id" : self.task_id,
			"description" : self.description,
			"categories" : self.categories,
			"datapoint_urls" : self.datapoint_urls,
			"labeler_results" : self.labeler_results
		}
		return task_info

	def load(self, filename):
		with open(filename, "rt") as f:
			task_info = json.load(f)
			self.task_id = task_info["task_id"]
			self.description = task_info["description"]
			self.categories = task_info["categories"]
			self.datapoint_urls = task_info["datapoint_urls"]
			self.labeler_results = task_info["labeler_results"]		

	def save(self, filename):
		with open(filename, "wt") as f:
			f.write(json.dumps(self.to_dict()))


