# histograph-import

Running `node index.js` will import PITs and relations from all subdirectories of directory set in `config.json`.

Histograph IO must be running, on host & port specified in `config.json`

You can also run `node index.js <source1> <source2> ...` to only import a selection of data sources into Histograph.

### Remove source(s) from Histograph

histograph-import can also remove sources from Histograph.

To clear __all__ sources:

    node index.js --clear

To clear a selection of sources, run

    node index.js --clear <source1> <source2> ...
