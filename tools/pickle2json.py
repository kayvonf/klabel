import json
import pickle
import os
import sys


DIR_PREFIX = "lfviz_assets"

SHOTS = ["forehand", "backhand"]
SPLITS = ["train", "val"]


def get_lf_matrix_filename(shot, split):
	filename = "%s_%s.pkl" % (shot, split)
	return os.path.join(DIR_PREFIX, filename)

def get_dist_matrix_filename(shot, split):
	filename = "%s_%s_dists.pkl" % (shot, split)
	return os.path.join(DIR_PREFIX, filename)

def get_image_paths_filename(shot, split):
	filename = "%s_%s_dists.pkl" % (shot, split)
	return os.path.join(DIR_PREFIX, filename)	

def get_lf_threshold_filename(shot):
	filename = "lf_thresholds.pkl"
	return os.path.join(DIR_PREFIX, filename)

# TODO:
#   bring up the old data
#   add in ground truth (support for dev set and val set)
#   sort by LM and LM+ext scores
#   visualize LF matrix before and after extension
#   visualize extensions due to (data point, LF, data point+LF)
#   sort by data points that added the largest number of extensions (to train or to val????) 
#   ask dan about other parameters. e.g., expected class balance?
# =====================
#   sort by most similar to given data point?
#   visualize clusters of data points / highlight a slice of data?
# =====================
#   functionality for creating a slice manually?  (location of inaccuracies? location of disagreements?)

class WeakDBDump:

	TRAINING_SET = "train"
	VAL_SET = "val"

	DATAPOINT_TYPE_IMAGE_URL = "image_url"
	DATAPOINT_TYPE_TEXT = "string"

	def __init__(self):
		self.dump_name = ""
		self.num_lf = 0
		self.num_train = 0
		self.num_val = 0

		self.lf_names = [];					# human-readable names of labeling functions

		self.lf_matrix = []					# (num_train+num_val) x num_lf matrix (LF results before extension)
		self.prob_labels = []				# label model output (before extension)

		self.extended_lf_matrix = []		# (num_train+num_val) x num_lf matrix (LF results after extension)
		self.extended_prob_labels = []	    # label model output (before extension)

		self.datapoint_type = WeakDBDump.DATAPOINT_TYPE_IMAGE_URL
		self.datapoints = []				# holds either a text string or an image URL

		self.ground_truth_labels = []


	def load_linden(self, dump_dir, dump_name):

		self.base_dir = dump_dir
		self.dump_name = dump_name

		# HACK(kayvonf): hardcoded this is whoel function is just a stopgap
		self.lf_names = ["Ball velocity 1", "Ball velocity 2", "Wrist 1", "Wrist 2", "Human"]

		# Linden's pkl format is a table with 2*num_lF + 2 columns
		# -- The first num_lf columns are LF output
		# -- The next num_lf columns are extended LF output
		# -- The next column is LM output on original LF output
		# -- The next column is LM output on extended LF output
		# -- The last column is the ground truth label

		# The code below converts Linden's input into a format where there are two tables.
		# One for the LF matrix prior to extension, and another for the LF matrix after the extension.
		# These tables contain *both* training and val set data.  

		lf_train_data = pickle.load( open(self.get_lf_matrix_pkl_filename(WeakDBDump.TRAINING_SET), "rb") )
		lf_val_data = pickle.load( open(self.get_lf_matrix_pkl_filename(WeakDBDump.VAL_SET), "rb") )

		self.num_train = len(lf_train_data)
		self.num_val = len(lf_val_data)
		self.num_lf = int((len(lf_train_data[0]) - 3) / 2)

		print("Loading WeakDB dump from Linden's files... %s" % self.dump_name)
		print("   Basedir:    %s" % self.base_dir)
		print("   Num LF:     %d" % self.num_lf)
		print("   Num train:  %d" % self.num_train)
		print("   Num val:    %d" % self.num_val)

		# convert pre-extension results
		self.lf_matrix = []
		self.prob_labels = []
		for row in lf_train_data:
			for lf in range(self.num_lf):
				self.lf_matrix.append(row[lf])
			self.prob_labels.append(row[2*self.num_lf])

		for row in lf_val_data:
			for lf in range(self.num_lf):
				self.lf_matrix.append(row[lf])
			self.prob_labels.append(row[2*self.num_lf])

		# convert post-extension results
		self.extended_lf_matrix = []
		self.extended_prob_labels = []
		for row in lf_train_data:
			for lf in range(self.num_lf):
				self.extended_lf_matrix.append(row[self.num_lf + lf])
			self.extended_prob_labels.append(row[2*self.num_lf+1])

		for row in lf_val_data:
			for lf in range(self.num_lf):
				self.extended_lf_matrix.append(row[self.num_lf + lf])
			self.extended_prob_labels.append(row[2*self.num_lf+1])

		# process the ground truth labels
		self.ground_truth_labels = []
		for row in lf_train_data:
			self.ground_truth_labels.append(row[2*self.num_lf+2])
		for row in lf_val_data:
			self.ground_truth_labels.append(row[2*self.num_lf+2])

		# now process the datapoint descriptors
		self.datapoints = []
		datapoints_train = pickle.load(open(self.get_image_paths_pkl_filename(WeakDBDump.TRAINING_SET), "rb"))
		datapoints_val = pickle.load(open(self.get_image_paths_pkl_filename(WeakDBDump.VAL_SET), "rb"))
		for row in datapoints_train:
			self.datapoints.append(row)
		for row in datapoints_val:
			self.datapoints.append(row)

		# now look at the distance matrices
		# train_dist_matrix = pickle.load(open(self.get_dist_matrix_pkl_filename(WeakDBDump.TRAINING_SET), "rb"))
		# print("Train dist matrix is: %d x %d" % (len(train_dist_matrix), len(train_dist_matrix[0])))

		# val_dist_matrix = pickle.load(open(self.get_dist_matrix_pkl_filename(WeakDBDump.VAL_SET), "rb"))
		# print("Val dist matrix is: %d x %d" % (len(val_dist_matrix), len(val_dist_matrix[0])))


	def save_json(self):
		
		dump_info = { "name" : self.dump_name,
					  "num_lf" : self.num_lf,
					  "num_train" : self.num_train,
					  "num_val" : self.num_val,
					  "datatype" : self.datapoint_type,
					  "lf_names" : self.lf_names
					} 

		with open(self.get_dump_info_json_filename(), "wt") as f:
			f.write(json.dumps(dump_info))

		with open(self.get_lf_matrix_json_filename("noext"), "wt") as f:
			f.write(json.dumps(self.lf_matrix))

		with open(self.get_prob_labels_json_filename("noext"), "wt") as f:
			f.write(json.dumps(self.prob_labels))

		with open(self.get_lf_matrix_json_filename("ext"), "wt") as f:
			f.write(json.dumps(self.extended_lf_matrix))

		with open(self.get_prob_labels_json_filename("ext"), "wt") as f:
			f.write(json.dumps(self.extended_prob_labels))

		with open(self.get_ground_truth_labels_json_filename(), "wt") as f:
			f.write(json.dumps(self.ground_truth_labels))

		with open(self.get_datapoints_json_filename(), "wt") as f:
			f.write(json.dumps(self.datapoints))

	# output json files (for lfviz)

	def get_dump_info_json_filename(self):
		filename = "%s.json" % (self.dump_name)
		return os.path.join(self.base_dir, filename)

	def get_lf_matrix_json_filename(self, ext_type):
		filename = "%s_lfmatrix_%s.json" % (self.dump_name, ext_type)
		return os.path.join(self.base_dir, filename)

	def get_prob_labels_json_filename(self, ext_type):
		filename = "%s_prob_labels_%s.json" % (self.dump_name, ext_type)
		return os.path.join(self.base_dir, filename)

	def get_ground_truth_labels_json_filename(self):
		filename = "%s_ground_truth_labels.json" % self.dump_name
		return os.path.join(self.base_dir, filename)

	def get_datapoints_json_filename(self):
		filename = "%s_datapoints.json" % self.dump_name
		return os.path.join(self.base_dir, filename)

	# input pickle files (from Linden)

	def get_lf_matrix_pkl_filename(self, split):
		filename = "%s_%s.pkl" % (self.dump_name, split)
		return os.path.join(self.base_dir, filename)

	def get_lf_threshold_pkl_filename(self):
		filename = "%s_lf_thresholds.pkl" % self.dump_name
		return os.path.join(self.base_dir, filename)
     
	def get_dist_matrix_pkl_filename(self, split):
		filename = "%s_%s_dists.pkl" % (self.dump_name, split)
		return os.path.join(self.base_dir, filename)

	def get_image_paths_pkl_filename(self, split):
		filename = "%s_%s_paths.pkl" % (self.dump_name, split)
		return os.path.join(self.base_dir, filename)	


db = WeakDBDump()
db.load_linden("lfviz_assets", "backhand")
db.save_json();

