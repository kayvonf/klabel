from labelingtask import LabelingTask
import glob
import os

ASSETS_DIR = "lfviz_assets" 
LVIS_DIR = "lvis_val2017"
FULL_DIR = os.path.join(ASSETS_DIR, LVIS_DIR)

datapoints = []

for f in glob.glob(os.path.join(FULL_DIR, "*.jpg")):
	datapoints.append(f)

#datapoints = datapoints[0:10];

task = LabelingTask()
task.set_description("Label the VENDING MACHINE category in LVIS val set")
task.set_datapoints(datapoints)
task.set_category_mapping( {
	"vending machine" : {"value" : 1, "color" : "rgba(103, 191, 92, .75)" },
	"background"      : {"value" : 2, "color" : "rgba(237, 102, 93, .75)" },
	"not sure"        : {"value" : 9, "color" : "rgba(255, 193, 86, .75)" }, 
	"flag"            : {"value" : 0, "color" : "rgba(255, 193, 86, .75)" } })

filename = os.path.join("labeling_results", "%s.json" % task.task_id)
task.save(filename)

print("Created labeling task: %s" % task.task_id)