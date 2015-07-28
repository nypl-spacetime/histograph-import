# histograph-import

histograph-import can bulk import datasets from one or more directories containing multiple Histograph datasets.

## Installation

Easy:

    npm install -g histograph/import

## Usage

Also easy.

Create a [Histograph configuration file](https://github.com/histograph/config), and set the environment variable `HISTOGRAPH_CONFIG` to the absolute path of this file, for example:

    export HISTOGRAPH_CONFIG=/Users/bert/code/histograph/config/histograph.json

To use histograph-import, `histograph.json` should contain a section named `import` containing an array `dirs`:

```json
{
  "import": {
    "dirs": [
      "relative/or/absolute/path/to/directory/with/histograph/datasets",
      "/Users/bert/Downloads/histograph-data",
      "..."
    ]
  }
}
```

histograph-import expects each directory to contain a set of subdirectories containing data for one dataset. Each dataset subdirectory should contain a JSON file containing dataset metadata, and NDJSON files containing PITs, relations, or both. __Important__: histograph-import expects files to adhere to the following naming convention - files in the directory `dataset1` should be named `dataset1.dataset.json`, `dataset1.pits.ndjson` and `dataset1.relations.ndjson`.

![](dirs.png)

Running `histograph-import` will import PITs and relations from all subdirectories of directory set in the configuration file. You can also run `node index.js <dataset1> <dataset2> ...` to only import a selection of data datasets into Histograph. For example, you can run:

    histograph-import tgn

This will import only data from the subdirectory `tgn` into Histograph.

For information about the installation and usage of all of Histograph's components, see [histograph.io](http://histograph.io).

## Remove dataset(s) from Histograph

histograph-import can also remove datasets from Histograph.

To clear __all__ datasets:

    histograph-import --clear

To clear a selection of datasets, run

    histograph-import --clear <dataset1> <dataset2> ...

## License

Copyright (C) 2015 [Waag Society](http://waag.org).

The source for Histograph is released under the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
