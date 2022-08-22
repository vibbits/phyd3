# PhyD3

A phylogenetic tree viewer.

## Installation

Using npm:
```bash
npm install @vibbioinfocore/phyd3
```

Using yarn:
```bash
yarn add @vibbioinfocore/phyd3
```

## Usage

```javascript
import { makeCompatTable, phyloxml } from "@vibbioinfocore/phyd3-parser-compat";
import { build } from "@vibbioinfocore/phyd3";

const xml = "<phyloxml><phylogeny rooted='true'><clade><name>A</name></clade></phylogeny></phyloxml>";

const parser = new DOMParser();
const doc = parser.parseFromString(xml, "text/xml");
const svg = build(makeCompatTable(phyloxml.parse(doc)));

// insert svg.node() somewhere in your document
```

### Options


### Parsing

PhyD3 does not perform any parsing. You can use a compatible parser such as [Phylio]() or
[phyd3-compat-parser]() or use any another parser. If you use another parser you will have to
transform the result into a structure that PhyD3 expects. This is described below. As an example,
see [phyd3-compat-parser::makeCompatTable()]().

```typescript
{
  "metadata": Array<Metadata>, // A metadata structure for each phylogeny (there may only be one)
  "nodes": Array<Node>,        // All nodes in all phylogenies
  "edges": Array<Edge>         // All edges between nodes (this will form a disconnected graph)
}
```

This is what a metadata structure looks like:
```typescript
{
  name: string | undefined,        // The name of this phylogeny
  description: string | undefined, // A description of this phylogeny
  parent: number,                  // The unique numeric identifier of the root node for this phylogeny
  rooted: boolean                  // Whether this phylogeny is rooted of not
}
```

An edge looks like this:
```typescript
{
  source: number, // The unique identifier of the starting node for this edge
  sink: number,   // The unique numeric identifier of the ending node for this edge
  length: number  // The length of the edge
}
```

And finally, this is a node.
```typescript
{
  name: string,
  event: "Clade" | "Taxa" | "Hybrid" | "LateralGeneTransfer" | "Recombination",
  ref: number, // The unique identifier for this node
  attributes: Map<string, Attribute> // A set of attributes
}
```

Attributes may either be scalar values, lists, or sub-mappings:
```typescript
type Attribute
  = {tag: "numeric", value: number}
  | {tag: "text",    value: string}
  | {tag: "bool",    value: boolean}
  | {tag: "list",    value: Array<Attribute>}
  | {tag: "mapping", value: Map<string, Attribute>}
```


## Citation

When using PhyD3, please cite:

>Kreft, L; Botzki, A; Coppens, F; Vandepoele, K; Van Bel, M
>
>[**"PhyD3: a phylogenetic tree viewer with extended phyloXML support for functional genomics data visualization"**](https://academic.oup.com/bioinformatics/article-abstract/doi/10.1093/bioinformatics/btx324/3835380/PhyD3-a-phylogenetic-tree-viewer-with-extended)
>
>Bioinformatics (2017) PMID 28525531 doi:10.1093/bioinformatics/btx324.

