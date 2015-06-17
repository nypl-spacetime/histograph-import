# histograph-import

histograph-import can bulk import source data from a directory containing multiple Histograph source data files.

You can set the directory histograph-import uses in the [Histograph configuration file](https://github.com/histograph/config).

Prerequisites:

- Run `npm install`
- [Histograph Core](https://github.com/histograph/core) must be running
- [Histograph API](https://github.com/histograph/api) must be running

## Import data into Histograph

Running `node index.js` will import PITs and relations from all subdirectories of directory set in the configuration file. You can also run `node index.js <source1> <source2> ...` to only import a selection of data sources into Histograph.

## Remove source(s) from Histograph

histograph-import can also remove sources from Histograph.

To clear __all__ sources:

    node index.js --clear

To clear a selection of sources, run

    node index.js --clear <source1> <source2> ...

## License

The source for Histograph is released under the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version.
