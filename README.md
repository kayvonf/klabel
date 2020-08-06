# klabel

For help with generating assets for use in lfviz, see the example in [weakdb/dummy.py](weakdb/dummy.py).  This example shows you how to populate a [WeakDB](weakdb/weakdb.py) class with the appropriate outputs and intermediates from Epoxy, and then dump to json for use in lfviz.

* [Click here](http://graphics.stanford.edu/~kayvonf/scratch/klabel/lfviz.html) for the latest lfviz demo on tennis data.
* [Click here](http://graphics.stanford.edu/~kayvonf/scratch/klabel/klabel.html) for a klabel demo.

## Getting started with LFViz.

1. Create the directory `lfviz_config/` in the directory containing `lfviz.html`. This is where `lfviz.html` looks for configuration files specified via the url parameters.
2. Create a WeakDB data dump with name `<DUMPNAME>`, placing the files anywhere in your web tree.  Let's call that directory `<DUMPDIR>`, so the main info file of the dump is `<DUMPDIR>/<DUMPNAME>.json`
   * See the example in [weakdb/dummy.py](weakdb/dummy.py) to learn how to create a data dump.
3. Create a lfviz configuration file `<MYCONFIG>.json` that points to your data dump.
   * Set parameter value `dump_url` to the url of the data dump info file (e.g., `"dump_url" : "<DUMPDIR>/<DUMPNAME>.json"`.) 
   * See the example configuration file in [config_examples/lfviz_config.json](config_examples/lfviz_config.json).
4. Open `lfviz.html` in a browser, and set query string parameter `lfviz.html?config=<MYCONFIG>` to load your WeakDB data dump using lfviz.
