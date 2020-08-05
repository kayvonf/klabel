import random
import weakdb


# This script demonstrates how to populate a WeakDB dump with data.
#
# The script creates a bunch of dummy data, creates a weakdb dump from that data,
# and then saves the dump as json. The datapoint descriptions in the dump assume
# there is a directory of images located at: dummy_imgs/image_XX.jpg

num_lf = 15
num_train = 40
num_val = 20
num_total = num_train + num_val

# create random lf names
lf_names = []
for i in range(num_lf):
	lf_names.append("Labeling Func %d" % i)

# create a random lf matrix
lf_matrix = []
for i in range(num_total*num_lf):
	value = random.randint(-1,1)
	lf_matrix.append(value)

# create extended lf matrix
extended_lf_matrix = []
for i in range(num_total*num_lf):
	if lf_matrix[i] == 0:	
		extended_lf_matrix.append(random.randint(-1,1))
	else:
		extended_lf_matrix.append(lf_matrix[i])

# create random label model output
prob_labels = []
for i in range(num_total):
	value = random.random()
	prob_labels.append(value)

# create random extended label model output
extended_prob_labels = []
for i in range(num_total):
	value = random.random()
	extended_prob_labels.append(value)

# create random ground truth data
ground_truth = []
for i in range(num_total):
	value = random.randint(-1,1)
	ground_truth.append(value)

# create random distance matrix
# (but set distance of datapoint to itself to 1.0) to emulate reality
sim_matrix = []
for i in range(num_total):
	for j in range(num_train):
		if i == j:
			sim_matrix.append(1.0)
		else:
			sim_matrix.append(random.random())

# create random datapoints
datapoints = []
for i in range(num_total):
	datapoints.append("dummy_imgs/image_%02d.jpg" % random.randint(0,7))

# now create the weakdb dump from all the dummy data

db = weakdb.WeakDB(num_train, num_val, num_lf)

db.set_name("dummy")
db.set_description("This is a demo of creating a weakdb debug dump for the visualizer.")
db.set_lf_names(lf_names)
db.set_lf_matrix(lf_matrix)
db.set_prob_labels(prob_labels)
db.set_extended_lf_matrix(extended_lf_matrix)
db.set_extended_prob_labels(extended_prob_labels)
db.set_ground_truth(ground_truth)
db.set_datapoints(weakdb.WeakDB.DATAPOINT_TYPE_IMAGE_URL, datapoints)
db.set_similarity_matrix(sim_matrix)

# all the output json files will be saved to this directory
target_dir = "lfviz_assets"
db.save_json(target_dir)


