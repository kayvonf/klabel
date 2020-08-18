import json
import os
import uuid



class LabelingTask:

	def __init__(self):
		self.task_id = self.generate_task_id()
		self.description = ""
		self.datapoint_urls = []
		self.datapoint_boxes = []
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

	def set_datapoint_boxes(self, datapoint_boxes):
		self.datapoint_boxes = datapoint_boxes

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

		# will replace prior results for the labeler if they exist
		if labeler_name in self.labeler_results:	
			self.labeler_results[labeler_name]["labels"] = labels
		else:
			self.labeler_results[labeler_name] = { "labels": labels}

	def add_labeling_times(self, labeler_name, labeling_times):
		assert len(labeling_times) == self.get_num_datapoints()

		# will replace prior results for the labeler if they exist
		if labeler_name in self.labeler_results:
			self.labeler_results[labeler_name]["labeling_times"] = labeling_times
		else:
			self.labeler_results[labeler_name] = { "labeling_times" : labeling_times}

	def get_labeler_results(self, labeler_name):
		if labeler_name in self.labeler_results:
			return self.labeler_results[labeler_name]["labels"]
		return []

	def print_stats(self):

		counts = [0 for x in range(10)]
		num_labels = 0
		for cat in self.labeler_results["kayvonf"]["labels"]:
			if cat != -1:
				num_labels = num_labels + 1
			counts[cat] = counts[cat] + 1

		print("Number of labeled datapoints: %d of %d" % (num_labels, len(self.datapoint_urls)))

		print("Labeling Results:")
		for i in range(10):
			idx = i + 1
			if idx == 10:
				idx = 0

			# find name
			for name, value in self.categories.items():
				if value["value"] == idx:
					print("    %s: %d" % (name, counts[idx]))

		min_time = 100000.0
		min_index = -1
		max_time = -1000000.0
		min_index = -1
		avg_time = 0.0
		count = 0
		for idx in range(len(self.labeler_results["kayvonf"]["labeling_times"])):
			if idx == 0:
				continue

			time = self.labeler_results["kayvonf"]["labeling_times"][idx]
			if time > 0.0:
				avg_time = avg_time + time
				count = count + 1
				if time > max_time:
					max_time = time
					max_index = idx
				if time < min_time:
					min_time = time
					min_index = idx

		avg_time = avg_time / count
		print("Labeling time info:")
		print("    min: %.4f, max: %.4f, avg: %.4f" % (min_time / 1000.0, max_time / 1000.0, avg_time / 1000.0))
		print("    min index: %d" % min_index)
		print("    max index: %d" % max_index)

	def to_dict(self):
		task_info = {
			"task_id" : self.task_id,
			"description" : self.description,
			"categories" : self.categories,
			"datapoint_urls" : self.datapoint_urls,
			"datapoint_boxes" : self.datapoint_boxes,
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
			if "datapoint_boxes" in task_info:
				self.datapoint_boxes = task_info["datapoint_boxes"]
			self.labeler_results = task_info["labeler_results"]		

	def save(self, filename):
		with open(filename, "wt") as f:
			f.write(json.dumps(self.to_dict()))


