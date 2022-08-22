import { create } from "d3-selection";
import {
  HierarchyPointLink,
  HierarchyPointNode,
  stratify,
  tree,
} from "d3-hierarchy";
import { Link, linkHorizontal } from "d3-shape";

type Group = {
  id: number;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  depth: number;
  foregroundColor: string;
  backgroundColor: string;
  label: string;
};

export interface Options {
  scaleY: number;
  scaleX: number;
  translateX: number;
  translateY: number;
  height: number;
  width: number;
  margin: number;
  scaleStep: number;
  nodeHeight: number;
  nodeHeightStep: number;
  textLength: number;
  domainWidth: number;
  domainWidthStep: number;
  graphWidth: number;
  graphWidthStep: number;
  domainLevel: number;
  domainLevelStep: number;
  outline: number;
  popupWidth: number;
  maxDecimalsSupportValues: number;
  maxDecimalsLengthValues: number;
  nanColor: string;
  foregroundColor: string;
  backgroundColor: string;
  branchLengthColor: string;
  supportValuesColor: string;
  showNodesType: "only leaf" | "only inner";
  treeWidth: number | "auto";
  showFullTaxonomy: boolean;
  showLabels: boolean;
  showDomains: boolean;
  dynamicHide: boolean;
  invertColors: boolean;
  lineupNodes: boolean;
  showSupportValues: boolean;
  showLengthValues: boolean;
  showTaxonomy: boolean;
  showTaxonomyColors: boolean;
  showDomainNames: boolean;
  showDomainColors: boolean;
  showGraphs: boolean;
  showGraphLegend: boolean;
  showNodeNames: boolean;
  showPhylogram: boolean;
  pinnedNodes: number[];
  groups: Map<number, Group>;
  drawBranch: Link<any, HierarchyPointLink<Node>, HierarchyPointNode<Node>>;
}

export type Metadata = {
  name: string | undefined;
  description: string | undefined;
  parent: number;
  rooted: boolean;
};

type NumericAttr = { tag: "numeric"; value: number };
type TextAttr = { tag: "text"; value: string };
type BoolAttr = { tag: "bool"; value: boolean };
type ListAttr = { tag: "list"; value: Array<Attribute> };
type MapAttr = { tag: "mapping"; value: Map<string, Attribute> };
type Attribute = NumericAttr | TextAttr | BoolAttr | ListAttr | MapAttr;

export type Node = {
  name: string;
  event: "Clade" | "Taxa" | "Hybrid" | "LateralGeneTransfer" | "Recombination";
  ref: number; // A unique identifier
  attributes: Map<string, Attribute>;
};

export type Edge = {
  source: number;
  sink: number;
  length: number;
};

export type Phylogeny = {
  metadata: Array<Metadata>;
  nodes: Array<Node>;
  edges: Array<Edge>;
};

const defaultOptions: Options = {
  scaleY: 1,
  scaleX: 1,
  translateX: 0,
  translateY: 0,
  height: 800,
  width: 800,
  margin: 20,
  scaleStep: 0.3,
  nodeHeight: 6,
  nodeHeightStep: 1,
  textLength: 100,
  domainWidth: 100,
  domainWidthStep: 100,
  graphWidth: 20,
  graphWidthStep: 10,
  domainLevel: 1,
  domainLevelStep: 10,
  outline: 0.3,
  popupWidth: 500,
  maxDecimalsSupportValues: 0,
  maxDecimalsLengthValues: 2,
  nanColor: "#fff",
  foregroundColor: "#000",
  backgroundColor: "#fff",
  branchLengthColor: "red",
  supportValuesColor: "blue",
  showNodesType: "only leaf",
  treeWidth: "auto",
  showFullTaxonomy: false,
  showLabels: true,
  showDomains: true,
  dynamicHide: false,
  invertColors: false,
  lineupNodes: true,
  showSupportValues: false,
  showLengthValues: false,
  showTaxonomy: true,
  showTaxonomyColors: true,
  showDomainNames: false,
  showDomainColors: true,
  showGraphs: true,
  showGraphLegend: true,
  showNodeNames: true,
  showPhylogram: false,
  pinnedNodes: [],
  groups: new Map(),
  drawBranch: linkHorizontal<
    HierarchyPointLink<Node>,
    HierarchyPointNode<Node>
  >()
    .x((d) => d.y)
    .y((d) => d.x),
};

export const build = (phylogeny: Phylogeny, opts?: Partial<Options>) => {
  const options: Readonly<Options> = { ...defaultOptions, ...(opts || {}) };

  const width = options.width - 2 * options.margin;
  const height = options.height - 2 * options.margin;

  const root: HierarchyPointNode<Node> = tree<Node>().size([height, width])(
    stratify<Node>()
      .id((node) => node.ref.toString())
      .parentId(
        (node) =>
          phylogeny.edges
            .filter((edge: Edge) => edge.sink === node.ref)[0]
            ?.source.toString() || null
      )(phylogeny.nodes)
  );

  const svg = create("svg")
    .attr("viewBox", [0, 0, options.width, options.height])
    .attr("width", `${options.width}px`)
    .attr("height", `${options.height}px`)
    .attr("overflow", "hidden")
    .attr("version", "1.1");

  svg
    .append("g")
    .attr("transform", `translate(${options.margin}, ${options.margin})`)
    .selectAll("path")
    .data(root.links())
    .join("path")
    .attr("d", options.drawBranch)
    .attr("fill", "none")
    .attr("stroke", options.foregroundColor);

  svg
    .append("g")
    .attr("transform", `translate(${options.margin}, ${options.margin})`)
    .selectAll("circle")
    .data(root.descendants())
    .join("circle")
    .attr("cx", (d) => d.y)
    .attr("cy", (d) => d.x)
    .attr("fill", options.foregroundColor)
    .attr("r", 2.5);

  svg
    .append("g")
    .attr("transform", `translate(${options.margin}, ${options.margin})`)
    .selectAll("text")
    .data(root.descendants())
    .join("text")
    .attr("x", (d) => d.y)
    .attr("y", (d) => d.x)
    .attr("transform", `translate(15, 0)`)
    .text((d) => d.data.name);
  return svg;
};

//const zoomed = (_evt: any) => {};
