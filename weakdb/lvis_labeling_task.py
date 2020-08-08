import labelingtask
import glob
import os

ASSETS_DIR = "lfviz_assets" 
LVIS_DIR = "lvis_val2017"
FULL_DIR = os.path.join(ASSETS_DIR, LVIS_DIR)

datapoints = []

for f in glob.glob(os.path.join(FULL_DIR, "*.jpg")):
	datapoints.append(f)

task = labelingtask.LabelingTask()
task.set_description("Binary labeling of images in LVIS val set")
task.set_datapoints(datapoints)

task.save("labeling_results")

print("Created labeling task: %s" % task.task_id)