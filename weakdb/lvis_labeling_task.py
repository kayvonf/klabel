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
task.set_description("Label the VENDING MACHINE category in LVIS val set")
task.set_datapoints(datapoints)
task.set_category_mapping( {
	"vending machine" : { "idx" : 1, "color" : "#67bf5c" },
	"background"      : {"idx" : 2, "color" : "#ed665d" },
	"not sure"        : {"idx" : 9, "color" : "#ffff00" }, 
	"flag"            : {"idx": 0, "color" : "#ffff00"} })

task.save("labeling_results")

print("Created labeling task: %s" % task.task_id)