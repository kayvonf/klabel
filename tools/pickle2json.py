import pickle
import json


PREFIX = "lfviz_assets/"
INPUT_LF_MATRIX_FILENAME = "backhandslice.pkl"
INPUT_PATH_FILENAME = "backhandpaths.pkl"

OUTPUT_LF_MATRIX_FILENAME = "backhandslice_lfmatrix.json"
OUTPUT_LM_FILENAME = "backhandslice_lm.json"
OUTPUT_PATH_FILENAME = "backhandslice_paths.json"


# convert image paths
filename_data = pickle.load( open(PREFIX + INPUT_PATH_FILENAME, "rb") )
output = open(PREFIX + OUTPUT_PATH_FILENAME, "wt")
output.write(json.dumps(filename_data))
output.close

# convert lf matrix
lf_data = pickle.load( open(PREFIX + INPUT_LF_MATRIX_FILENAME, "rb") )
print("There are %d rows." % len(lf_data))
print("There are %d LFs." % len(lf_data[0]))
print(lf_data[0])

# 0-3 -- bounding box
# 4-8 -- LF outputs
# 9   -- LM no extension
# 10  -- LM with extension

lf_only = [];
lm_output = [];
for x in lf_data:
	lf_only.append([x[4], x[5], x[6], x[7], x[8]])
	lm_output.append(x[9]);

output = open(PREFIX + OUTPUT_LF_MATRIX_FILENAME, "wt")
output.write(json.dumps(lf_only))
output.close()

output = open(PREFIX + OUTPUT_LM_FILENAME, "wt")
output.write(json.dumps(lm_output))
output.close()



