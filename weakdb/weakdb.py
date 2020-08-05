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

	DATAPOINT_TYPE_IMAGE_URL = "image_url"
	DATAPOINT_TYPE_IMAGE_URL_SEQ = "image_url_seq"
	DATAPOINT_TYPE_TEXT = "text"

	CLOSEST_LIST_SIZE = 20
	SAMPLE_LIST_SIZE =  50

	def __init__(self, num_train=0, num_val=0, num_lf=0):

		self.dump_name = ""					# name of the debug dump
		self.description = ""				# human readable description of the dump

		self.num_lf = num_lf
		self.lf_names = []					# human-readable names of labeling functions

		self.num_train = num_train			# number of datapoints in the training set
		self.num_val = num_val				# number of datapoints in the val set

		self.lf_matrix = []					# (num_train+num_val) x num_lf matrix (LF results before extension)
		self.prob_labels = []				# label model output (before extension)

		self.extended_lf_matrix = []		# (num_train+num_val) x num_lf matrix (LF results after extension)
		self.extended_prob_labels = []	    # label model output (after extension)

		# description of the datapoints (for introspection during debugging)
		self.datapoint_type = WeakDB.DATAPOINT_TYPE_IMAGE_URL
		self.datapoints = []				# holds either a text string or an image URL (for preview in viz)

		self.ground_truth_labels = []		# ground truth labels

		self.sorted_dists = []				# list of lists of k-nn indices (in closest to farthest order)

		# set default LF names
		for i in range(self.num_lf):
			self.lf_names.append("LF%2d" % i)


	def set_name(self, dump_name):
		assert len(dump_name) > 0
		self.dump_name = dump_name

	def set_description(self, description):
		self.description = description

	def set_lf_names(self, lf_names):
		assert len(lf_names) == self.num_lf
		self.lf_names = lf_names

	def set_lf_matrix(self, lf_matrix):
		assert len(lf_matrix) == (self.num_train + self.num_val) * self.num_lf;
		self.lf_matrix = lf_matrix

	def set_extended_lf_matrix(self, extended_lf_matrix):
		assert len(extended_lf_matrix) == (self.num_train + self.num_val) * self.num_lf;
		self.extended_lf_matrix = extended_lf_matrix

	def set_prob_labels(self, prob_labels):
		assert len(prob_labels) == (self.num_train + self.num_val)
		self.prob_labels = prob_labels

	def set_extended_prob_labels(self, extended_prob_labels):
		assert len(extended_prob_labels) == (self.num_train + self.num_val)
		self.extended_prob_labels = extended_prob_labels

	def set_ground_truth(self, ground_truth_labels):
		assert len(ground_truth_labels) == (self.num_train + self.num_val)
		self.ground_truth_labels = ground_truth_labels

	def set_datapoints(self, datapoint_type, datapoints):
		assert len(datapoints) == (self.num_train + self.num_val)
		self.datapoint_type = datapoint_type
		self.datapoints = datapoints

	# similarity matrix should be (num_train + num_val) * num_train elements
	# higher number is more similar
	def set_similarity_matrix(self, similarity_matrix):
		assert len(similarity_matrix) == ((self.num_train + self.num_val) * self.num_train)
		self.sorted_dists = []
		for row_idx in range(self.num_train + self.num_val):
			row = similarity_matrix[row_idx*self.num_train : (row_idx+1)*self.num_train]
			if row_idx < self.num_train:
				self.sorted_dists.append(self.process_dists_row(row, query_idx=row_idx))
			else:
				self.sorted_dists.append(self.process_dists_row(row))
		
	# path generation for output json files (these are the files lfviz expects to load)

	def get_dump_info_json_filename(self, target_dir):
		filename = "%s.json" % (self.dump_name)
		return os.path.join(target_dir, filename)

	def get_lf_matrix_json_filename(self, target_dir, ext_type):
		filename = "%s_lfmatrix_%s.json" % (self.dump_name, ext_type)
		return os.path.join(target_dir, filename)

	def get_prob_labels_json_filename(self, target_dir, ext_type):
		filename = "%s_prob_labels_%s.json" % (self.dump_name, ext_type)
		return os.path.join(target_dir, filename)

	def get_ground_truth_labels_json_filename(self, target_dir):
		filename = "%s_ground_truth_labels.json" % self.dump_name
		return os.path.join(target_dir, filename)

	def get_datapoints_json_filename(self, target_dir):
		filename = "%s_datapoints.json" % self.dump_name
		return os.path.join(target_dir, filename)

	def get_similarity_json_filename(self, target_dir):
		filename = "%s_sorted_dists.json" % self.dump_name
		return os.path.join(target_dir, filename)

	# FIXME(kayvonf): remove these once we sync with Linden
	# input pickle files (from Linden)

	def get_linden_lf_matrix_pkl_filename(self, linden_src_dir, split):
		filename = "%s_%s.pkl" % (self.dump_name, split)
		return os.path.join(linden_src_dir, filename)

	def get_linden_lf_threshold_pkl_filename(self, linden_src_dir):
		filename = "%s_lf_thresholds.pkl" % self.dump_name
		return os.path.join(linden_src_dir, filename)
     
	def get_linden_similarity_matrix_pkl_filename(self, linden_src_dir, split):
		filename = "%s_%s_dists.pkl" % (self.dump_name, split)
		return os.path.join(linden_src_dir, filename)

	def get_linden_image_paths_pkl_filename(self, linden_src_dir, split):
		filename = "%s_%s_paths.pkl" % (self.dump_name, split)
		return os.path.join(linden_src_dir, filename)

	# helper: this method does the heavy lifting of turning a row in an input
	# distance matrix into a row of sorted (by distance) datapoint indices
	def process_dists_row(self, dists_row, query_idx=-1):

		pairs = [(x, dists_row[x]) for x in range(len(dists_row))]
		pairs.sort(reverse=True, key=(lambda x : x[1]))
		
		if query_idx >= 0 and query_idx != pairs[0][0]:
			print("WARNING: closest datapoint to datapoint %d is datapoint %d (expected %d). Often a sign of duplicate data." % (query_idx, pairs[0][0], query_idx))

		# Build three lists:
		# The first is a list of the top N closest items to the query.
		# The second is a sampling of SAMPLE_LIST_SIZE elements 
		# The third is a rank ordering of the datapoints (closest to farthest)

		closest_n = []
		sampled_n = []
		ranking = []

		sample_skip = max(1, int(len(dists_row) / WeakDB.SAMPLE_LIST_SIZE))
		num_processed = 0

		for (idx,dist) in pairs:

			# throw out the nearest neighbor datapoint if it is the same as the query datapoint
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
		return ranking


	# FIXME(kayvonf): This is a function that I expect to go away soon
	# It loads Linden's pkl files for the tennis task.  It should be deprecated and Liden should just
	# directly call WeakDB methods to initialize a WeakDB structure
	def load_linden(self, linden_src_dir, dump_name):

		LINDEN_TRAINING_SET = "train"
		LINDEN_VAL_SET = "val"

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

		lf_train_data = pickle.load( open(self.get_linden_lf_matrix_pkl_filename(linden_src_dir, LINDEN_TRAINING_SET), "rb") )
		lf_val_data = pickle.load( open(self.get_linden_lf_matrix_pkl_filename(linden_src_dir, LINDEN_VAL_SET), "rb") )

		self.num_train = len(lf_train_data)
		self.num_val = len(lf_val_data)
		self.num_lf = int((len(lf_train_data[0]) - 3) / 2)

		print("Initializing WeakDB from Linden's files... %s" % self.dump_name)
		print("   Source PKL dir:   %s" % linden_src_dir)
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
		datapoints_train = pickle.load(open(self.get_linden_image_paths_pkl_filename(linden_src_dir, LINDEN_TRAINING_SET), "rb"))
		datapoints_val = pickle.load(open(self.get_linden_image_paths_pkl_filename(linden_src_dir, LINDEN_VAL_SET), "rb"))
		for row in datapoints_train:
			self.datapoints.append("%s-1.jpg" % row[0:-4])
		for row in datapoints_val:
			self.datapoints.append("%s-1.jpg" % row[0:-4])

		# process the distance matrices
		self.sorted_dists = []
		train_similarity_matrix = pickle.load(open(self.get_linden_similarity_matrix_pkl_filename(linden_src_dir, LINDEN_TRAINING_SET), "rb"))
		val_similarity_matrix = pickle.load(open(self.get_linden_similarity_matrix_pkl_filename(linden_src_dir, LINDEN_VAL_SET), "rb"))
		cur_row_idx = 0
		for row in train_similarity_matrix:
			self.sorted_dists.append(self.process_dists_row(float32_to_float64(row), query_idx=cur_row_idx))
			cur_row_idx=cur_row_idx+1
		for row in val_similarity_matrix:
			self.sorted_dists.append(self.process_dists_row(float32_to_float64(row)))


	# writes the weakdb dump to a collection of json files that can be read by lfviz
	def save_json(self, target_dir):
		
		has_extended_data = (len(self.extended_lf_matrix) != 0)
		has_similarity_data = (len(self.sorted_dists) != 0)
		has_ground_truth  = (len(self.ground_truth_labels) != 0)

		dump_info = { "name" : self.dump_name,
					  "description" : self.description,
					  "num_lf" : self.num_lf,
					  "num_train" : self.num_train,
					  "num_val" : self.num_val,
					  "datatype" : self.datapoint_type,
					  "lf_names" : self.lf_names,
					  "has_extended_data" : has_extended_data,
					  "has_similarity_data" : has_similarity_data,
					  "has_ground_truth"  : has_ground_truth
					} 

		with open(self.get_dump_info_json_filename(target_dir), "wt") as f:
			f.write(json.dumps(dump_info))

		with open(self.get_lf_matrix_json_filename(target_dir, "noext"), "wt") as f:
			f.write(json.dumps(self.lf_matrix))

		with open(self.get_prob_labels_json_filename(target_dir, "noext"), "wt") as f:
			f.write(json.dumps(self.prob_labels))

		with open(self.get_datapoints_json_filename(target_dir), "wt") as f:
			f.write(json.dumps(self.datapoints))

		if has_extended_data:
			with open(self.get_lf_matrix_json_filename(target_dir, "ext"), "wt") as f:
				f.write(json.dumps(self.extended_lf_matrix))

			with open(self.get_prob_labels_json_filename(target_dir, "ext"), "wt") as f:
				f.write(json.dumps(self.extended_prob_labels))

		if has_ground_truth:
			with open(self.get_ground_truth_labels_json_filename(target_dir), "wt") as f:
				f.write(json.dumps(self.ground_truth_labels))

		if has_similarity_data:
			with open(self.get_similarity_json_filename(target_dir), "wt") as f:
				f.write(json.dumps(self.sorted_dists))	

