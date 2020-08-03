import json
import pickle
import os
import sys
import numpy



# TODO:
#   visualize extensions due to (data point, LF, data point+LF)
#   sort by data points that added the largest number of extensions (to train or to val????) 
#   ask dan about other parameters. e.g., expected class balance?
# =====================
#   sort by most similar to given data point?
#   visualize clusters of data points / highlight a slice of data?
# =====================
#   functionality for creating a slice manually?  (location of inaccuracies? location of disagreements?)


# HACK(kayvonf): convert from fp32 to fp64 in order to serialize to JSON
# JSON library doesn't serialize float32 values.
def float32_to_float64(x):			
	return [ numpy.float64(item) for item in x]

class WeakDB:

	LINDEN_TRAINING_SET = "train"
	LINDEN_VAL_SET = "val"

	DATAPOINT_TYPE_IMAGE_URL = "image_url"
	DATAPOINT_TYPE_TEXT = "string"

	CLOSEST_LIST_SIZE = 20
	SAMPLE_LIST_SIZE =  50

	def __init__(self):

		self.linden_src_dir = ""
		self.target_dir = ""

		self.dump_name = ""					# name of the debug dump
		self.description = ""				# human readable description of the dump

		self.num_lf = 0
		self.lf_names = [];					# human-readable names of labeling functions

		self.num_train = 0					# number of datapoints in the training set
		self.num_val = 0					# number of datapoints in the val set

		self.lf_matrix = []					# (num_train+num_val) x num_lf matrix (LF results before extension)
		self.prob_labels = []				# label model output (before extension)

		self.extended_lf_matrix = []		# (num_train+num_val) x num_lf matrix (LF results after extension)
		self.extended_prob_labels = []	    # label model output (after extension)

		# description of the datapoints (for introspection during debugging)
		self.datapoint_type = WeakDB.DATAPOINT_TYPE_IMAGE_URL
		self.datapoints = []				# holds either a text string or an image URL (for preview in viz)

		self.ground_truth_labels = []		# ground truth labels

		self.sorted_dists = []				# list of lists of k-nn indices (in closest to farthest order) 


	# path generation for output json files (these are the files lfviz expects to load)

	def get_dump_info_json_filename(self):
		filename = "%s.json" % (self.dump_name)
		return os.path.join(self.target_dir, filename)

	def get_lf_matrix_json_filename(self, ext_type):
		filename = "%s_lfmatrix_%s.json" % (self.dump_name, ext_type)
		return os.path.join(self.target_dir, filename)

	def get_prob_labels_json_filename(self, ext_type):
		filename = "%s_prob_labels_%s.json" % (self.dump_name, ext_type)
		return os.path.join(self.target_dir, filename)

	def get_ground_truth_labels_json_filename(self):
		filename = "%s_ground_truth_labels.json" % self.dump_name
		return os.path.join(self.target_dir, filename)

	def get_datapoints_json_filename(self):
		filename = "%s_datapoints.json" % self.dump_name
		return os.path.join(self.target_dir, filename)

	def get_distances_json_filename(self):
		filename = "%s_sorted_dists.json" % self.dump_name
		return os.path.join(self.target_dir, filename)

	# FIXME(kayvonf): remove these once we sync with Linden
	# input pickle files (from Linden)

	def get_linden_lf_matrix_pkl_filename(self, split):
		filename = "%s_%s.pkl" % (self.dump_name, split)
		return os.path.join(self.linden_src_dir, filename)

	def get_linden_lf_threshold_pkl_filename(self):
		filename = "%s_lf_thresholds.pkl" % self.dump_name
		return os.path.join(self.linden_src_dir, filename)
     
	def get_linden_dist_matrix_pkl_filename(self, split):
		filename = "%s_%s_dists.pkl" % (self.dump_name, split)
		return os.path.join(self.linden_src_dir, filename)

	def get_linden_image_paths_pkl_filename(self, split):
		filename = "%s_%s_paths.pkl" % (self.dump_name, split)
		return os.path.join(self.linden_src_dir, filename)


	# helper: this method does the heavy lifting of turning a row in an input
	# distance matrix into a row of sorted (by distance) datapoint indices
	def process_dists_row(self, dists_row, query_idx=-1):

		pairs = [(x, dists_row[x]) for x in range(len(dists_row))]
		pairs.sort(reverse=True, key=(lambda x : x[1]))
		
		if query_idx >= 0 and query_idx != pairs[0][0]:
			print("WARNING: closest datapoint to datapoint %d is datapoint %d (expected %d). Often a sign of duplicate data." % (query_idx, pairs[0][0], query_idx));

		# Build three lists:
		# The first is a list of the top N closest items to the query.
		# The second is a sampling of SAMPLE_LIST_SIZE elements 
		# The third is a rank ordering of the datapoints (closest to farthest)

		closest_n = []
		sampled_n = []
		ranking = []

		sample_skip = int(len(dists_row) / WeakDB.SAMPLE_LIST_SIZE);
		num_processed = 0

		for (idx,dist) in pairs:

			# throw out the nearest neighbor datapoint if its the same as the current datapoint
			if query_idx >= 0 and query_idx == idx:
				continue

			ranking.append(idx)

			# store in closest-N list
			if len(closest_n) < WeakDB.CLOSEST_LIST_SIZE:
				closest_n.append((idx, dist))

			# store in sorted samples list
			if len(sampled_n) < WeakDB.SAMPLE_LIST_SIZE and num_processed % sample_skip == 0:
				sampled_n.append((idx, dist))

			num_processed = num_processed + 1

		# FIXME(kayvonf): right now just returing the rank ordering until I figure out what
		# I'd do with the additional information in the visualizer

		#return {"ranking" : ranking, "closest" : closest_n, "sampling" : sampled_n}
		return ranking;


	# FIXME(kayvonf): This is a function that I expect to go away soon
	# It loads Linden's pkl files for the tennis task.  It should be deprecated and Liden should just
	# directly call WeakDB methods to initialize a WeakDB structure
	def load_linden(self, src_dir, target_dir, dump_name):

		self.linden_src_dir = src_dir
		self.target_dir = target_dir
		self.dump_name = dump_name

		# HACK(kayvonf): hardcoded since this is whole function is just a stop gap for Linden's data dumps
		self.description = "Backhand slice detection (true=slice backhand, false=topspin backhand)"
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

		lf_train_data = pickle.load( open(self.get_linden_lf_matrix_pkl_filename(WeakDB.LINDEN_TRAINING_SET), "rb") )
		lf_val_data = pickle.load( open(self.get_linden_lf_matrix_pkl_filename(WeakDB.LINDEN_VAL_SET), "rb") )

		self.num_train = len(lf_train_data)
		self.num_val = len(lf_val_data)
		self.num_lf = int((len(lf_train_data[0]) - 3) / 2)

		print("Initializing WeakDB from Linden's files... %s" % self.dump_name)
		print("   Source PKL dir:   %s" % self.linden_src_dir)
		print("   JSON Target dir:  %s" % self.target_dir)
		print("   Num LF:           %d" % self.num_lf)
		print("   Num train:        %d" % self.num_train)
		print("   Num val:          %d" % self.num_val)

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
		datapoints_train = pickle.load(open(self.get_linden_image_paths_pkl_filename(WeakDB.LINDEN_TRAINING_SET), "rb"))
		datapoints_val = pickle.load(open(self.get_linden_image_paths_pkl_filename(WeakDB.LINDEN_VAL_SET), "rb"))
		for row in datapoints_train:
			self.datapoints.append(row)
		for row in datapoints_val:
			self.datapoints.append(row)

		# process the distance matrices
		self.sorted_dists = []
		train_dist_matrix = pickle.load(open(self.get_linden_dist_matrix_pkl_filename(WeakDB.LINDEN_TRAINING_SET), "rb"))
		val_dist_matrix = pickle.load(open(self.get_linden_dist_matrix_pkl_filename(WeakDB.LINDEN_VAL_SET), "rb"))
		cur_row_idx = 0
		for row in train_dist_matrix:
			self.sorted_dists.append(self.process_dists_row(float32_to_float64(row), query_idx=cur_row_idx))
			cur_row_idx=cur_row_idx+1
		for row in val_dist_matrix:
			self.sorted_dists.append(self.process_dists_row(float32_to_float64(row)))


	# writes the weakdb dump to a collection of json files that can be read by lfviz
	def save_json(self):
		
		dump_info = { "name" : self.dump_name,
					  "description" : self.description,
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

		with open(self.get_distances_json_filename(), "wt") as f:
			f.write(json.dumps(self.sorted_dists))	
