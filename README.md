# klabel

* [Click here](http://graphics.stanford.edu/~kayvonf/scratch/klabel/lfviz.html) for the latest lfviz demo on tennis data.
* [Click here](http://graphics.stanford.edu/~kayvonf/scratch/klabel/klabel.html) for a klabel demo.

# Getting Started

[server.py](server.py) is a simple Flask server that you can run on your local box for development.  For LFViz, the server just serves static files.  For data labeling support does run meaningful logic. 

    export FLASK_APP=server.py
    flask run

## Getting Started with LFViz

1. Create the directory `lfviz_config/` underneath the directory containing `lfviz.html`. This is where `lfviz.html` looks for configuration files specified in url parameters (see step 4).
2. Create a WeakDB data dump with name `<DUMPNAME>`, placing the files anywhere in your web tree.  Let's call that directory `<DUMPDIR>`, so the main info file of the dump is `<DUMPDIR>/<DUMPNAME>.json`
   * See the example in [weakdb/dummy.py](weakdb/dummy.py) to learn how to create a data dump. This example shows you how to populate a [WeakDB](weakdb/weakdb.py) class with the appropriate outputs and intermediates from Epoxy, and then dump to json for use in lfviz.
3. Create a lfviz configuration file `<MYCONFIG>.json` that points to your data dump.
   * Set parameter value `dump_url` to the url of the data dump info file (e.g., `"dump_url" : "<DUMPDIR>/<DUMPNAME>.json"`). 
   * See the example configuration file in [config_examples/lfviz_config.json](config_examples/lfviz_config.json).
4. Open `lfviz.html` in a browser. Set the query string parameter `lfviz.html?config=<MYCONFIG>` to load your WeakDB data dump using lfviz.

## Getting Started with a New Data Labeling Session

1. Create the directory `labeling_results/` in the top level of your web tree.
2. Create a labeling task and place the task description `.json` file in `labeling_results/`.
   * See [weakdb/lvis_labeling_task.py](weakdb/lvis_labeling_task.py) for an example of how to create a labeling task for a category in the VLIS val set.
3. Open `labeling.html`.  You can type in the task id in the text entry box, or for convenience stick both the task id and the labeler name into url parameters (i.e. `labeling.html?task_id=<TASK_ID>&labeler=<LABELER_NAME>`)
4. Label away!  Results will be stored back in the labeling task's json file.
