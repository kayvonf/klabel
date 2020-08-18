from labelingtask import LabelingTask
import glob
import os

#
# This script is an example of how to create a labeling tasks from a
# list of image files in a directory.
#

ASSETS_DIR = "lfviz_assets" 
LVIS_DIR = "lvis_val2017"
IMAGE_DIR = os.path.join(ASSETS_DIR, LVIS_DIR)

# Assumes all the LVIS images are sitting in a directory. 
# Glob the directory to get a list of images for the labeling task
datapoints = []
for f in glob.glob(os.path.join(IMAGE_DIR, "*.jpg")):
	datapoints.append(f)

CATEGORY_TO_LABEL = "BEER BOTTLE"

task = LabelingTask()
task.set_description("Label the %s category in LVIS val set" % CATEGORY_TO_LABEL)
task.set_datapoints(datapoints)

# In addition to positive/negative for the category at hand, I created two additional
# categories for labelers to mark images that they are unsure about (enabling later review),
# or to flag anything that we might want to look at later. As one example, if I ever see an
# instance of another rare category I know we will need to label,
# I might flag it when labeling to save us time later.
#
# In this example, I chose to explicitly define the mapping of category names
# to keys and colors in klabel. An alternative is to set LabelingTask do  
# that for me by calling LabelingTask::set_categories(), which takes a list of
# category names and automatically assigns categories to keys/colors.
# However, I wanted to push the exception cases ("not sure" and "flag")
# to the right side of the keyboard and give them the same yellow-ish color.

task.set_category_mapping( {
	"beer bottle"     : {"value" : 1, "color" : "rgba(103, 191, 92, .75)" },
	"background"      : {"value" : 2, "color" : "rgba(237, 102, 93, .75)" },
	"hard negative"   : {"value":  8, "color" : "rgba(114, 158, 206, .75)"},
	"not sure"        : {"value" : 9, "color" : "rgba(255, 193, 86, .75)" }, 
	"flagged"         : {"value" : 0, "color" : "rgba(255, 193, 86, .75)" } })

# On my local box, I've configured the web server handling labeling requests to look
# for tabeling tasks in /labeling_results, so place the json file for the task there 
filename = os.path.join("labeling_results", "%s.json" % task.task_id)
task.save(filename)

# Now you can open this labeling task using labeling.html and start labeling
print("Created labeling task: %s" % task.task_id)