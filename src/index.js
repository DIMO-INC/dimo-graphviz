import G6 from "@antv/g6";
import insertCss from "insert-css";
import { isNumber, isArray } from "@antv/util";
import { GraphQLClient, gql, request } from 'graphql-request'
import './dataTable.js'
import './modal.js'
import './dimoGraphQLQueries.js'
import './dimoGraphQL.js'

import L from "leaflet";

insertCss(`
  .g6-component-contextmenu {
      position: absolute;
      z-index: 2;
      list-style-type: none;
      background-color: #363b40;
      border-radius: 6px;
      font-size: 14px;
      color: hsla(0, 0%, 100%, .85);
      transition: opacity .2s;
      text-align: center;
      padding: 0px 20px 0px 20px;
      box-shadow: 0 5px 18px 0 rgba(0, 0, 0, 0.6);
      border: 0px;
  }
  .g6-component-contextmenu ul {
      padding-left: 0px;
      margin: 0;
  }
  .g6-component-contextmenu li {
      cursor: pointer;
      list-style-type: none;
      list-style: none;
      margin-left: 0;
      line-height: 38px;
      font-size: 12px !important;
  }
  .g6-component-contextmenu li:hover {
      color: #aaaaaa;
  }
  .g6-component-tooltip {
      background-color: rgba(255, 255, 255, 0.8);
      padding: 0px 25px 0px 0px;
      box-shadow: rgb(174, 174, 174) 0px 0px 10px;
  }
  /* The Modal (background) */
  .modal {
      display: none;
      /* Hidden by default */
      /* position: fixed; */
      /* Stay in place */
      z-index: 10;
      overflow: auto;
      /* Enable scroll if needed */
      background-color: rgb(0, 0, 0);
      /* Fallback color */
      background-color: rgba(0, 0, 0, 0.4);
      /* Black w/ opacity */
  }
  .modal-header {
      text-align: center;
  }
  /* Modal Content/Box */
  .modal-content {
      background-color: #fefefe;
      margin: 15% auto;
      /* 15% from the top and centered */
      padding: 20px;
      border: 1px solid #888;
      width: 80%;
      /* Could be more or less, depending on screen size */
  }
`);

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}



const SMALLGRAPHLABELMAXLENGTH = 20;
let labelMaxLength = SMALLGRAPHLABELMAXLENGTH;
const DEFAULTNODESIZE = 200;
const DEFAULTAGGREGATEDNODESIZE = 200;





let graph = null;
let nodeMap = {};
let hiddenItemIds = [];

let largeGraphMode = true;
self.cachePositions = {};
let manipulatePosition = undefined;
let descreteNodeCenter;
let layout = {
  type: "",
  instance: null,
  destroyed: true
};
let expandArray = [];
let collapseArray = [];
let shiftKeydown = false;
let ctrlKeydown = false;
let altKeydown = false;
let dragX = undefined;
let dragY = undefined;
let dragdX = undefined;
let dragdY = undefined;
let CANVAS_WIDTH = 800,
  CANVAS_HEIGHT = 800;

var dragSelectedNodes = undefined;


const duration = 2000;
const animateOpacity = 0.6;
const animateBackOpacity = 0.1;
const virtualEdgeOpacity = 0.1;
const realEdgeOpacity = 0.2;

const darkBackColor = "rgb(43, 47, 51)";
const disableColor = "#777";
const theme = "dark";
const subjectColors = [
  "#5F95FF",
  "#61DDAA",
  "#F6BD16",
  "#9661BC",
  "#C91C25",
  "#D37099",
  '#EDE7A4',
  "#87412B"
];


const dimoProjectColorIndex = 0;
const dimoOrgColorIndex = 1;
const dimoFunctionColorIndex = 2;
const dimoDeviceColorIndex = 3;
const dimoResourceColorIndex = 4;
const dimoAggregateColorIndex = 5;
const dimoPersonColorIndex = 6;
const dimoTextColorIndex = 7;

const colorSets = G6.Util.getColorSetsBySubjectColors(
  subjectColors,
  darkBackColor,
  theme,
  disableColor
);


// DIMO stuff

const dimoOrgIcon = "https://dl.airtable.com/.attachmentThumbnails/f17c35f9affd107e60b57b5ac91e84aa/03673739";
const dimoProjectIcon = "https://api.iconify.design/mdi-crane.svg";
const dimoFunctionIcon = "https://api.iconify.design/mdi-function.svg";
const dimoDeviceIcon = "https://api.iconify.design/mdi-chip.svg";
const dimoResourceIcon = "https://api.iconify.design/emojione-monotone:letter-r.svg"
const dimoPeopleIcon = "https://api.iconify.design/akar-icons:person.svg"


self.classToIcon = {
                      "[Org]":dimoOrgIcon,
                      "[Project]":dimoProjectIcon,
                      "[Function]":dimoFunctionIcon,
                      "[Device]":dimoDeviceIcon,
                      "[Resource]":dimoResourceIcon,
                      "[People]":dimoPeopleIcon,
}





self.graphInit = false;


const edgeColor = "#7DC1E3"



const global = {
  node: {
    style: {
      fill: "#2B384E"
    },
    labelCfg: {
      style: {
        fill: "#acaeaf",
        stroke: "#191b1c"
      }
    },
    stateStyles: {
      focus: {
        fill: "#2B384E"
      }
    }
  },
  edge: {
    style: {
      stroke: edgeColor,
      realEdgeStroke: edgeColor, //'#f00',
      realEdgeOpacity,
      strokeOpacity: realEdgeOpacity
    },
    labelCfg: {
      style: {
        fill: edgeColor,
        realEdgeStroke: edgeColor, //'#f00',
        realEdgeOpacity: 0.5,
        stroke: "#191b1c"
      }
    },
    stateStyles: {
      focus: {
        stroke: edgeColor // '#3C9AE8',
      }
    }
  }
};

// Custom super node
G6.registerNode(
  "dimo-aggregated-node",
  {
    draw(cfg, group) {
      let width = 225,
        height = 45;
      const style = cfg.style || {};
      const colorSet = cfg.colorSet || colorSets[0];

      // Hightlight for Hover
      group.addShape("rect", {
        attrs: {
          x: -width * 0.55,
          y: -height * 0.6,
          width: width * 1.1,
          height: height * 1.2,
          fill: colorSet.mainFill,
          opacity: 0.9,
          lineWidth: 0,
          radius: (height / 2 || 13) * 1.2
        },
        name: "halo-shape",
        visible: false
      });

      // focus stroke for active (clicked)
      group.addShape("rect", {
        attrs: {
          x: -width * 0.55,
          y: -height * 0.6,
          width: width * 1.1,
          height: height * 1.2,
          fill: colorSet.mainFill, // '#3B4043',
          stroke: "#AAB7C4",
          lineWidth: 1,
          lineOpacty: 0.85,
          radius: (height / 2 || 13) * 1.2
        },
        name: "stroke-shape",
        visible: false
      });

      const keyShape = group.addShape("rect", {
        attrs: {
          ...style,
          x: -width / 2,
          y: -height / 2,
          width,
          height,
          fill: colorSet.mainFill, // || '#3B4043',
          stroke: colorSet.mainStroke,
          lineWidth: 2,
          radius: height / 2 || 13,
          lineDash: [2, 2]
        },
        name: "dimo-node-keyShape"
      });

      let labelStyle = {};
      if (cfg.labelCfg) {
        labelStyle = Object.assign(labelStyle, cfg.labelCfg.style);
      }
      
      group.addShape('image', {
          attrs: {
              x: 70,
              y: -16,
              width: 32,
              height: 32,
              img:cfg.icon.url
          },
          className: 'node-icon',
          name: 'node-icon',
          draggable: true,
      });


      group.addShape("text", {
        attrs: {
          text: cfg.label,
          x: 0,
          y: 0,
          textAlign: "center",
          textBaseline: "middle",
          cursor: "pointer",
          fontSize: 12,
          fill: "#fff",
          opacity: 0.85,
          fontWeight: 400
        },
        name: "node-label",
        className: "node-label",
        draggable: true
      });

      group.addShape("text", {
        attrs: {
          text: cfg.count,
          x: 0,
          y: 20,
          textAlign: "center",
          textBaseline: "middle",
          cursor: "pointer",
          fontSize: 10,
          fill: "#fff",
          opacity: 0.85,
          fontWeight: 400
        },
        name: "node-count",
        className: "node-count",
        draggable: true
      });


      if (cfg.icon.show){

          group.addShape('image', {
              attrs: {
                  x: 70,
                  y: -16,
                  width: 32,
                  height: 32,
                  img:cfg.icon.url
              },
              className: 'node-icon',
              name: 'node-icon',
              draggable: true,
          });
    }

      if (cfg.logo.show) {

          group.addShape('image', {
              attrs: {
                  x: -102,
                  y: -16,
                  width: 32,
                  height: 32,
                  img: cfg.logo.url
              },
              className: 'node-logo',
              name: 'node-logo',
              draggable: true,
          });
      }



      // tag for new node
      if (cfg.new) {
        group.addShape("circle", {
          attrs: {
            x: width / 2 - 3,
            y: -height / 2 + 3,
            r: 4,
            fill: "#6DD400",
            lineWidth: 0.5,
            stroke: "#FFFFFF"
          },
          name: "typeNode-tag-circle"
        });
      }
      return keyShape;
    },
    setState: (name, value, item) => {
      const group = item.get("group");
      if (name === "layoutEnd" && value) {
        const labelShape = group.find((e) => e.get("name") === "text-shape");
        if (labelShape) labelShape.set("visible", true);
      } else if (name === "hover") {
        if (item.hasState("focus")) {
          return;
        }
        const halo = group.find((e) => e.get("name") === "halo-shape");
        const keyShape = item.getKeyShape();
        const colorSet = item.getModel().colorSet || colorSets[0];
        if (value) {
          halo && halo.show();
          keyShape.attr("fill", colorSet.activeFill);
        } else {
          halo && halo.hide();
          keyShape.attr("fill", colorSet.mainFill);
        }
      } else if (name === "focus") {
        const stroke = group.find((e) => e.get("name") === "stroke-shape");
        const keyShape = item.getKeyShape();
        const colorSet = item.getModel().colorSet || colorSets[0];
        if (value) {
          stroke && stroke.show();
          keyShape.attr("fill", colorSet.selectedFill);
        } else {
          stroke && stroke.hide();
          keyShape.attr("fill", colorSet.mainFill);
        }
      }
    },






    update: undefined
  },
  "single-node"
);









// Custom super node
G6.registerNode(
  "dimo-node",
  {
    draw(cfg, group) {
      let width = 225,
        height = 45;
      const style = cfg.style || {};
      const colorSet = cfg.colorSet || colorSets[0];

      // Hightlight for Hover
      group.addShape("rect", {
        attrs: {
          x: -width * 0.55,
          y: -height * 0.6,
          width: width * 1.1,
          height: height * 1.2,
          fill: colorSet.mainFill,
          opacity: 0.9,
          lineWidth: 0,
          radius: (height / 2 || 13) * 1.2
        },
        name: "halo-shape",
        visible: false
      });

      // focus stroke for active (clicked)
      group.addShape("rect", {
        attrs: {
          x: -width * 0.55,
          y: -height * 0.6,
          width: width * 1.1,
          height: height * 1.2,
          fill: colorSet.mainFill, // '#3B4043',
          stroke: "#AAB7C4",
          lineWidth: 1,
          lineOpacty: 0.85,
          radius: (height / 2 || 13) * 1.2
        },
        name: "stroke-shape",
        visible: false
      });

      const keyShape = group.addShape("rect", {
        attrs: {
          ...style,
          x: -width / 2,
          y: -height / 2,
          width,
          height,
          fill: colorSet.mainFill, // || '#3B4043',
          stroke: colorSet.mainStroke,
          lineWidth: 2,
          radius: height / 2 || 13,
          lineDash: [2, 2]
        },
        name: "dimo-node-keyShape"
      });

      let labelStyle = {};
      if (cfg.labelCfg) {
        labelStyle = Object.assign(labelStyle, cfg.labelCfg.style);
      }
      
      group.addShape('image', {
          attrs: {
              x: 70,
              y: -16,
              width: 32,
              height: 32,
              img:cfg.icon.url
          },
          className: 'node-icon',
          name: 'node-icon',
          draggable: true,
      });

      if (cfg.logo.show) {

          group.addShape('image', {
              attrs: {
                  x: -102,
                  y: -16,
                  width: 32,
                  height: 32,
                  img: cfg.logo.url
              },
              className: 'node-logo',
              name: 'node-logo',
              draggable: true,
          });
      }



      group.addShape("text", {
        attrs: {
          text: cfg.label,
          x: 0,
          y: 0,
          textAlign: "center",
          textBaseline: "middle",
          cursor: "pointer",
          fontSize: 12,
          fill: "#fff",
          opacity: 0.85,
          fontWeight: 400
        },
        name: "count-shape",
        className: "count-shape",
        draggable: true
      });



      // tag for new node
      if (cfg.new) {
        group.addShape("circle", {
          attrs: {
            x: width / 2 - 3,
            y: -height / 2 + 3,
            r: 4,
            fill: "#6DD400",
            lineWidth: 0.5,
            stroke: "#FFFFFF"
          },
          name: "typeNode-tag-circle"
        });
      }
      return keyShape;
    },
    setState: (name, value, item) => {
      const group = item.get("group");
      if (name === "layoutEnd" && value) {
        const labelShape = group.find((e) => e.get("name") === "text-shape");
        if (labelShape) labelShape.set("visible", true);
      } else if (name === "hover") {
        if (item.hasState("focus")) {
          return;
        }
        const halo = group.find((e) => e.get("name") === "halo-shape");
        const keyShape = item.getKeyShape();
        const colorSet = item.getModel().colorSet || colorSets[0];
        if (value) {
          halo && halo.show();
          keyShape.attr("fill", colorSet.activeFill);
        } else {
          halo && halo.hide();
          keyShape.attr("fill", colorSet.mainFill);
        }
      } else if (name === "focus") {
        const stroke = group.find((e) => e.get("name") === "stroke-shape");
        const keyShape = item.getKeyShape();
        const colorSet = item.getModel().colorSet || colorSets[0];
        if (value) {
          stroke && stroke.show();
          keyShape.attr("fill", colorSet.selectedFill);
        } else {
          stroke && stroke.hide();
          keyShape.attr("fill", colorSet.mainFill);
        }
      }
    },






    update: undefined
  },
  "single-node"
);


// Custom super node
G6.registerNode(
  "dimo-text-node",
  {
    draw(cfg, group) {
      let width = 225


      const newLabel = formatTextNodeText(cfg.label)

      const numNewLines = (newLabel.match(new RegExp("\n", "g")) || []).length


      const height = Math.max(45, 20*numNewLines)


      const style = cfg.style || {};
      const colorSet = cfg.colorSet || colorSets[0];

      // Hightlight for Hover
      group.addShape("rect", {
        attrs: {
          x: -width * 0.55,
          y: -height * 0.6,
          width: width * 1.1,
          height: height * 1.2,
          fill: colorSet.mainFill,
          opacity: 0.9,
          lineWidth: 0,
          radius: (height / 2 || 13) * 1.2
        },
        name: "halo-shape",
        visible: false
      });

      // focus stroke for active (clicked)
      group.addShape("rect", {
        attrs: {
          x: -width * 0.55,
          y: -height * 0.6,
          width: width * 1.1,
          height: height * 1.2,
          fill: colorSet.mainFill, // '#3B4043',
          stroke: "#AAB7C4",
          lineWidth: 1,
          lineOpacty: 0.85,
          radius: (height / 2 || 13) * 1.2
        },
        name: "stroke-shape",
        visible: false
      });

      const keyShape = group.addShape("rect", {
        attrs: {
          ...style,
          x: -width / 2,
          y: -height / 2,
          width,
          height,
          fill: colorSet.mainFill, // || '#3B4043',
          stroke: colorSet.mainStroke,
          lineWidth: 2,
          radius: height / 2 || 13,
          lineDash: [2, 2]
        },
        name: "dimo-node-keyShape"
      });

      let labelStyle = {};
      if (cfg.labelCfg) {
        labelStyle = Object.assign(labelStyle, cfg.labelCfg.style);
      }
     

      group.addShape("text", {
        attrs: {
          text: newLabel,
          x: 0,
          y: 8,
          textAlign: "center",
          textBaseline: "middle",
          cursor: "pointer",
          fontSize: 12,
          fill: "#fff",
          opacity: 0.85,
          fontWeight: 400
        },
        name: "count-shape",
        className: "count-shape",
        draggable: true
      });


      return keyShape;
    },
    setState: (name, value, item) => {
      const group = item.get("group");
      if (name === "layoutEnd" && value) {
        const labelShape = group.find((e) => e.get("name") === "text-shape");
        if (labelShape) labelShape.set("visible", true);
      } else if (name === "hover") {
        if (item.hasState("focus")) {
          return;
        }
        const halo = group.find((e) => e.get("name") === "halo-shape");
        const keyShape = item.getKeyShape();
        const colorSet = item.getModel().colorSet || colorSets[0];
        if (value) {
          halo && halo.show();
          keyShape.attr("fill", colorSet.activeFill);
        } else {
          halo && halo.hide();
          keyShape.attr("fill", colorSet.mainFill);
        }
      } else if (name === "focus") {
        const stroke = group.find((e) => e.get("name") === "stroke-shape");
        const keyShape = item.getKeyShape();
        const colorSet = item.getModel().colorSet || colorSets[0];
        if (value) {
          stroke && stroke.show();
          keyShape.attr("fill", colorSet.selectedFill);
        } else {
          stroke && stroke.hide();
          keyShape.attr("fill", colorSet.mainFill);
        }
      }
    },






    update: undefined
  },
  "single-node"
);






// Custom the quadratic edge for multiple edges between one node pair
G6.registerEdge(
  "custom-cubic",
  {
    setState: (name, value, item) => {
      const group = item.get("group");
      const model = item.getModel();
      if (name === "focus") {

        const back = group.find((ele) => ele.get("name") === "back-line");
        if (back) {
          back.stopAnimate();
          back.remove();
          back.destroy();
        }
        const keyShape = group.find((ele) => ele.get("name") === "edge-shape");
        const arrow = model.style.endArrow;
        if (value) {
          if (keyShape.cfg.animation) {
            keyShape.stopAnimate(true);
          }
          keyShape.attr({
            strokeOpacity: animateOpacity,
            opacity: animateOpacity,
            stroke: edgeColor,
            endArrow: {
              ...arrow,
              stroke: edgeColor,
              fill: edgeColor
            }
          });
          if (model.isReal) {
            const { lineWidth, path, endArrow, stroke } = keyShape.attr();
            const back = group.addShape("path", {
              attrs: {
                lineWidth,
                path,
                stroke,
                endArrow,
                opacity: animateBackOpacity
              },
              name: "back-line"
            });
            back.toBack();
            const length = keyShape.getTotalLength();
            keyShape.animate(
              (ratio) => {
                // the operations in each frame. Ratio ranges from 0 to 1 indicating the prograss of the animation. Returns the modified configurations
                const startLen = ratio * length;
                // Calculate the lineDash
                const cfg = {
                  lineDash: [startLen, length - startLen]
                };
                return cfg;
              },
              {
                repeat: true, // Whether executes the animation repeatly
                duration // the duration for executing once
              }
            );
          } else {
            let index = 0;
            const lineDash = keyShape.attr("lineDash");
            const totalLength = lineDash[0] + lineDash[1];
            keyShape.animate(
              () => {
                index++;
                if (index > totalLength) {
                  index = 0;
                }
                const res = {
                  lineDash,
                  lineDashOffset: -index
                };
                // returns the modified configurations here, lineDash and lineDashOffset here
                return res;
              },
              {
                repeat: true, // whether executes the animation repeatly
                duration // the duration for executing once
              }
            );
          }
        } else {
          keyShape.stopAnimate();
          const stroke = edgeColor;
          const opacity = realEdgeOpacity;
          keyShape.attr({
            stroke,
            strokeOpacity: opacity,
            opacity,
            endArrow: {
              ...arrow,
              stroke,
              fill: stroke
            }
          });
        }
      }
    }
  },
  "cubic"
);




const hideEdgesPromise = () => {
  return new Promise((resolve, reject) => {
    graph.getEdges().forEach((edge)=> {
      graph.hideItem(edge, false)
    })
      resolve("Hiding Edges Worked.");
  });
};


const dragPromise = (node, dragdx, dragdy) => {
        return new Promise((resolve, reject) => {
            /*stuff using username, password*/
            const newX = node._cfg.model.x + dragdx
            const newY = node._cfg.model.y + dragdy
            graph.updateItem(node, {
                x: newX,
                y: newY
            });


            resolve("Stuff worked!");
        });
    };










// Custom the line edge for single edge between one node pair


const descendCompare = (p) => {
  // 这是比较函数
  return function (m, n) {
    const a = m[p];
    const b = n[p];
    return b - a; // 降序
  };
};

const clearFocusItemState = (graph) => {
  if (!graph) return;
  clearFocusNodeState(graph);
  clearFocusEdgeState(graph);
};

// 清除图上所有节点的 focus 状态及相应样式
const clearFocusNodeState = (graph) => {
  const focusNodes = graph.findAllByState("node", "focus");
  focusNodes.forEach((fnode) => {
    graph.setItemState(fnode, "focus", false); // false
  });
};

// 清除图上所有边的 focus 状态及相应样式
const clearFocusEdgeState = (graph) => {
  const focusEdges = graph.findAllByState("edge", "focus");
  focusEdges.forEach((fedge) => {
    graph.setItemState(fedge, "focus", false);
  });
};

// 截断长文本。length 为文本截断后长度，elipsis 是后缀
const formatText = (text, length = 5, elipsis = "...") => {
  if (!text) return "";
  if (text.length > length) {
    return `${text.substr(0, length)}${elipsis}`;
  }
  return text;
};

const labelFormatter = (text, minLength = 20) => {
  if (text && text.split("").length > minLength)
    return `${text.substr(0, minLength)}...`;
  return text;
};

const getForceLayoutConfig = (graph, largeGraphMode, configSettings) => {
  let {
    linkDistance,
    edgeStrength,
    nodeStrength,
    nodeSpacing,
    preventOverlap,
    nodeSize,
    collideStrength,
    alpha,
    alphaDecay,
    alphaMin
  } = configSettings || { preventOverlap: true };

  if (!linkDistance && linkDistance !== 0) linkDistance = 225;
  if (!edgeStrength && edgeStrength !== 0) edgeStrength = 10;
  if (!nodeStrength && nodeStrength !== 0) nodeStrength = 5000;
  if (!nodeSpacing && nodeSpacing !== 0) nodeSpacing = 1000;




  const config = {
    type: "gForce",
    minMovement: 0.01,
    maxIteration: 5000,
    preventOverlap: true,
    damping: 0.99,
    workerEnabled:true,
    gpuEnabled:true,
    nodeStrength:nodeStrength,
    linkDistance: (d) => {
      return linkDistance;
    },
    edgeStrength: (d) => {
      return edgeStrength;
    },
    nodeStrength: (d) => {
      return nodeStrength;
    },
    nodeSize: (d) => {
      return 200;
    },
    nodeSpacing: (d) => {
      return nodeSpacing;
    },
    onLayoutEnd: () => {
      if (largeGraphMode) {
        graph.getEdges().forEach((edge) => {
          if (!edge.oriLabel) return;
          edge.update({
            label: labelFormatter(edge.oriLabel, labelMaxLength)
          });
        });
      }
    },
    tick: () => {
      graph.refreshPositions();
    }
  };

  if (nodeSize) config["nodeSize"] = nodeSize;
  if (collideStrength) config["collideStrength"] = collideStrength;
  if (alpha) config["alpha"] = alpha;
  if (alphaDecay) config["alphaDecay"] = alphaDecay;
  if (alphaMin) config["alphaMin"] = alphaMin;

  return config;
};

const hideItems = (graph) => {
  hiddenItemIds.forEach((id) => {
    graph.hideItem(id);
  });
};

const showItems = (graph) => {
  graph.getNodes().forEach((node) => {
    if (!node.isVisible()) graph.showItem(node);
  });
  hiddenItemIds = [];
};



self.cacheNodePositions = (nodes) => {
  const positionMap = {};
  const nodeLength = nodes.length;
  for (let i = 0; i < nodeLength; i++) {

    const node = nodes[i].getModel();
    positionMap[node.id] = {
      x: node.x,
      y: node.y,
      level: node.level
    };
  }
  return positionMap;
};

const stopLayout = () => {
  if(layout.instance.stop){
  layout.instance.stop();
}
};

const bindListener = (graph) => {
  graph.on("keydown", (evt) => {
    if(self.modalOpen) {
      return
    }

    const code = evt.key;
    console.log("keydown",code)
    if (!code) {
      return;
    }
    
    if (code.toLowerCase() == 'z') {
      if (ctrlKeydown) {
        self.graphToolbar.undo();
      }
    }

    if (code.toLowerCase() === "shift") {
      shiftKeydown = true;
    } else {
      shiftKeydown = false;
    }
    if (code.toLowerCase() === "alt") {
      altKeydown = true;
      self.graph.setMode("brushSelect")
      console.log("mode",graph.getCurrentMode())
    } else {
      altKeydown = false;

    }

    if (code.toLowerCase() === "control" || code.toLowerCase() === "meta") {
      ctrlKeydown = true;
    } else {
      ctrlKeydown = false;
    }

    if (code.toLowerCase() == " ") {
      console.log("space")
      graph.fitView([20, 20]);
    }




  });

graph.on('afterlayout', function () {
  console.log("Layout Finished!")

function wait(ms){
   var start = new Date().getTime();
   var end = start;
   while(end < start + ms) {
     end = new Date().getTime();
  }
}


  if(graph.cfg.layout){
    if(graph.cfg.layout.type=="radial"){
      graph.destroyLayout()
}

}


});




  graph.on("keyup", (evt) => {
    
    const code = evt.key;

    if(self.modalOpen) {
      

      if (code=="Escape") {
        evt.preventDefault();
        self.closeAllModals()
      }

      if (self.settingsModalOpenBool) {
          if (code == "Enter") {
              evt.preventDefault();
              self.settingsModalSave()
              self.closeAllModals()
              
          }
      }





      return
    }

    if(code=="Enter" && !self.modalOpen){
      evt.preventDefault();
      self.searchModalOpen()
      return
    }
    if(code=="F1" && !self.modalOpen){
          evt.preventDefault();
          self.settingsModalOpen()
        }



    
    if (!code) {
      return;
    }
    if (code.toLowerCase() === "shift") {
      shiftKeydown = false;
    }
    if (code.toLowerCase() === "alt") {
      altKeydown = false;
      self.graph.setMode("default")
      console.log("mode",graph.getCurrentMode())
    }
    if (code.toLowerCase() === "control" || code.toLowerCase() === "meta") {
      ctrlKeydown = false;
    }

  });
  graph.on("node:mouseenter", (evt) => {
    const { item } = evt;
    const model = item.getModel();
    var currentLabel, newLabel
    if (model.class == "[Text]"){
       

    } else {
       currentLabel = model.label;
       newLabel = model.oriLabel
    model.oriFontSize = model.labelCfg.style.fontSize;
    item.update({
      label: newLabel
    });


    model.oriLabel = currentLabel;
    }

   

    graph.setItemState(item, "hover", true);
    item.toFront();

    if (altKeydown) {
      graph.setItemState(item, "focus", true);
    }


  });

  graph.on("node:mouseleave", (evt) => {
    const { item } = evt;
    const model = item.getModel();
    var currentLabel, newLabel


    if (model.class == "[Text]"){
       

    } else {
       currentLabel = model.label;
       newLabel = model.oriLabel
      item.update({
        label: newLabel
      });
      model.oriLabel = currentLabel;
    }


    graph.setItemState(item, "hover", false);
  });

  graph.on("edge:mouseenter", (evt) => {
    const { item } = evt;
    const model = item.getModel();
    const currentLabel = model.label;
    item.update({
      label: model.oriLabel
    });
    model.oriLabel = currentLabel;
    item.toFront();
    item.getSource().toFront();
    item.getTarget().toFront();
  });

  graph.on("edge:mouseleave", (evt) => {
    const { item } = evt;
    const model = item.getModel();
    const currentLabel = model.label;
    item.update({
      label: model.oriLabel
    });
    model.oriLabel = currentLabel;
  });
  // click node to show the detail drawer
  graph.on("node:click", (evt) => {
      stopLayout();
      if (!shiftKeydown) clearFocusItemState(graph);
      else clearFocusEdgeState(graph);
      const { item } = evt;
      // highlight the clicked node, it is down by click-select
      graph.setItemState(item, "focus", true);

      if (!shiftKeydown) {
          // 将相关边也高亮
          const relatedEdges = item.getEdges();
          relatedEdges.forEach((edge) => {
              graph.setItemState(edge, "focus", false);
          });

          setTimeout(() => {
              relatedEdges.forEach((edge) => {
                  graph.setItemState(edge, "focus", true);
              });
          }, 20);

      }
  });
    
  graph.on("canvas:contextmenu", (evt) => {
      self.mouseX = evt.canvasX
      self.mouseY = evt.canvasY
  });

    graph.on("node:dragstart", (evt) => {
      dragX = evt.x;
      dragY = evt.y;
      hideEdgesPromise();
      dragSelectedNodes = graph.findAllByState('node', 'focus');

  });

    graph.on("node:dragend", (evt) => {
      graph.findAllByState('node', 'focus').forEach((node)=>{
        graph.setItemState(node,"focus",false)
        graph.setItemState(node,"focus",true)
      })
            graph.getEdges().forEach((edge)=> {
        graph.showItem(edge, false)
      })
      dragSelectedNodes = undefined

  });



    graph.on("node:drag", (evt) => {
      dragdX = evt.x - dragX
      dragdY = evt.y - dragY
      dragX = evt.x
      dragY = evt.y

      const curItem = evt.item._cfg.id;
      
      dragSelectedNodes.forEach((node)=> {

        if (node._cfg.id != curItem){

        dragPromise(node, dragdX, dragdY)

        }
      })
  });


  // click edge to show the detail of integrated edge drawer
  graph.on("edge:click", (evt) => {
      stopLayout();
      if (!shiftKeydown) clearFocusItemState(graph);
      const { item } = evt;
      // highlight the clicked edge

      setTimeout(() => {
          graph.setItemState(item, "focus", true);
      }, 20);
  });

  // click canvas to cancel all the focus state
  graph.on("canvas:click", (evt) => {
    clearFocusItemState(graph);
  });
};


const dimogqlEndpoint = "https://api.dimo.zone/v1/graphql";
const dimogqlauthHeaders = {
            'x-hasura-admin-secret': 'DG93PEr6e2gq9Ldo7Ru3'
        }

self.graphQLClient = new GraphQLClient(dimogqlEndpoint, {headers: dimogqlauthHeaders});



function getUrlVars() {
    var vars = {};
    var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
        vars[key] = value;
    });
    return vars;
}


self.dimoProjects = {};
self.dimoOrgs = {};
self.dimoFunctions = {};
self.dimoDevices = {};
self.dimoResources = {};
self.dimoPeople = {};
self.dimoAggregates  = {};
self.dimoAggregatesMap = {};
self.dimoAggregatesMapReverse = {};
self.dimoAggregatesEdgeMap = {};
self.dimoEdgeMap = {};
self.dimoText = {};






self.formatTextNodeText = (label) => {

    const lineSizeLimit = 20;

    function addNewlines(str) {
        var result = '';
        while (str.length > 0) {
            result += str.substring(0, lineSizeLimit) + '\n';
            str = str.substring(lineSizeLimit);
        }
        return result;
    }


    const newLabel = addNewlines(label)
    return newLabel





}




self.CreateTextNode = (desiredText)=>{








    var node = {
        "id": uuidv4(),
        "type": "dimo-text-node",
        "class": "[Text]",
        "label": desiredText,
        "x": self.mouseX,
        "y": self.mouseY 
    };

    node.colorSet = colorSets[dimoTextColorIndex]

    node.labelCfg = {
        position: "bottom",
        offset: 5,
        style: {
            fill: global.node.labelCfg.style.fill,
            fontSize: 12,
            stroke: global.node.labelCfg.style.stroke,
            lineWidth: 3
        }
    }

    return node

}

self.gqlResourceDataToNode = (resource) => {
    const node = {
        "id": resource.id,
        "type": "dimo-node",
        "class": "[Resource]",
        "label": resource.name,
        "location": resource.location,
        "airtableURL": "https://airtable.com/tblAKJHMkBTTAbuXE/viwfjiEW7MrdgTysI/" + resource.id,
    };

    const geocodeSuccess = "🔵 ";

    if (resource.geocode && resource.geocode.startsWith(geocodeSuccess)) {
        const geoJsonRaw = resource.geocode.substring(geocodeSuccess.length);
        const geoJson = JSON.parse(atob(geoJsonRaw));

        node.lat = geoJson.o.lat;
        node.lng = geoJson.o.lng;
    }

    if (resource.resource_resource_types.length) {

      //  var url = JSON.parse(project.project_project_types[0].project_type.icon.replace(/\'/g, '"'))

        node._type = resource.resource_resource_types[0].resource_type.name
        var url = ""


        if (url.length) {
            node.logo = {
                "show": true,
                "url": url[0]
            }
        } else {
            node.logo = {
                "show": false,
            }
        }




    } else {
        node.logo = {
            "show": false,
        }
    }

    node.level = 1;


    node.icon = {
        "url": dimoResourceIcon
    }

    node.colorSet = colorSets[dimoResourceColorIndex]

    node.labelCfg = {
        position: "bottom",
        offset: 5,
        style: {
            fill: global.node.labelCfg.style.fill,
            fontSize: 12,
            stroke: global.node.labelCfg.style.stroke,
            lineWidth: 3
        }
    }



    return node



}






self.gqlProjectDataToNode = (project)=>{

    var node = {
        "id": project.id,
        "type": "dimo-node",
        "class": "[Project]",
        "label": project.name,
        "airtableURL": "https://airtable.com/tblpm4ls9gP94bmGA/viwbmZinIAOULOOCc/" + project.id,
    };

    if (project.project_project_types.length) {

        var url = JSON.parse(project.project_project_types[0].project_type.icon.replace(/\'/g, '"'))

        node._type = project.project_project_types[0].project_type.name

        if (url.length) {
            node.logo = {
                "show": true,
                "url": url[0]
            }
        } else {
            node.logo = {
                "show": false,
            }
        }




    } else {
        node.logo = {
            "show": false,
        }
    }

    node.level = 1;


    node.icon = {
        "url": dimoProjectIcon
    }

    node.colorSet = colorSets[dimoProjectColorIndex]

    node.labelCfg = {
        position: "bottom",
        offset: 5,
        style: {
            fill: global.node.labelCfg.style.fill,
            fontSize: 12,
            stroke: global.node.labelCfg.style.stroke,
            lineWidth: 3
        }
    }



    return node



}





self.gqlOrgDataToNode = (org)=>{

    var node = {
        "id": org.id,
        "type": "dimo-node",
        "class":"[Org]",
        "label":org.name,
        "airtableURL":"https://airtable.com/tblJopLUVAZR2Cfa5/viwuDxJer9n8E5Eze/" + org.id,
    };


    node.level = 1;

    if (org.logo.length) {
      node.logo = {
                    "show":true,
                    "url":org.logo[org.logo.length - 1]
      }
    }
    else {
      node.logo = {
                    "show":false
      }
    }

    if (org.org_org_types.length) {

        var url = JSON.parse(org.org_org_types[0].org_type.icon.replace(/\'/g, '"'))

        node._type = org.org_org_types[0].org_type.name

        if (url.length) {
            node.icon = {
                "url": url[0]
            }
        } else {
            node.icon = {
            "url": dimoOrgIcon,
        }
        }




    } else {
        node.icon = {
            "url": dimoOrgIcon,
        }
    }

    node.colorSet = colorSets[dimoOrgColorIndex]

    node.labelCfg = {
      position: "bottom",
      offset: 5,
      style: {
        fill: global.node.labelCfg.style.fill,
        fontSize: 12,
        stroke: global.node.labelCfg.style.stroke,
        lineWidth: 3
      }
    }



    return node



}





self.gqlFunctionDataToNode = (func)=>{

    var node = {
        "id": func.id,
        "type": "dimo-node",
        "class":"[Function]",
        "label":func.name,
        "airtableURL":"https://airtable.com/tbluJQFoXFEof7rdM/viwLeV2hJyBobLFZW/" + func.id,
    };
 
    if (func.function_function_types.length) {

        node._type = func.function_function_types[0].function_type.name

        var url = func.function_function_types[0].function_type.icon

        if (url.length) {
            node.logo = {
                "show": true,
                "url": url[0]
            }
        } else {
            node.logo = {
                "show": false,
            }
        }




    } else {
        node.logo = {
            "show": false,
        }
    }
    
    node.level = 1;


    node.icon = {
      "url":dimoFunctionIcon
    }

    node.colorSet = colorSets[dimoFunctionColorIndex]

    node.labelCfg = {
      position: "bottom",
      offset: 5,
      style: {
        fill: global.node.labelCfg.style.fill,
        fontSize: 12,
        stroke: global.node.labelCfg.style.stroke,
        lineWidth: 3
      }
    }
    return node



}







self.gqlDeviceDataToNode = (device)=>{

    var node = {
        "id": device.id,
        "type": "dimo-node",
        "class":"[Device]",
        "label":device.name,
        "airtableURL":"https://airtable.com/tblBfeuQ77VxrrGAx/viwrAkUlftN8UCRvK/" + device.id,
    };
 
    node.level = 1;


    if (device.device_device_types.length) {

        node._type = device.device_device_types[0].device_type.name

        var url = device.device_device_types[0].device_type.icon

        if (url.length) {
            node.logo = {
                "show": true,
                "url": url[0]
            }
        } else {
            node.logo = {
                "show": false,
            }
        }




    } else {
        node.logo = {
            "show": false,
        }
    }
    

    node.icon = {
      "url":dimoDeviceIcon
    }

    node.colorSet = colorSets[dimoDeviceColorIndex]
    

    node.labelCfg = {
      position: "bottom",
      offset: 5,
      style: {
        fill: global.node.labelCfg.style.fill,
        fontSize: 12,
        stroke: global.node.labelCfg.style.stroke,
        lineWidth: 3
      }
    }
    return node



}




self.dimoAggregatedNode = (nodes)=>{

    const nodeID = `node-${uuidv4()}`
    var node = {
        "id": nodeID,
        "type": "dimo-aggregated-node",
        "class":"[Aggregate]",
    };
 
    node.level = 1;
    node.count = 0;

    node.typeSet = new Set()
    node.tableSet = new Set()

    node.tableCount = {
                      "[Org]":0,
                      "[Project]":0,
                      "[Function]":0,
                      "[Device]":0,
                      "[Resource]":0,
                      "[People]":0,
                      }



    var subNode
    for (var i = nodes.length - 1; i >= 0; i--) {
        node.count += 1
        subNode = nodes[i]
        if(subNode._type!=undefined){
          node.typeSet.add(subNode._type)
        }
        node.tableSet.add(subNode.class)
        node.tableCount[subNode.class] += 1
    }




    if(node.typeSet.size==1){
        node.icon = nodes[0].icon
        



     } else {
       node.icon = {
           "show":false,
       }
     }

     if(node.tableSet.size==1){
       node.logo = {
         "show":true,
         "url":self.classToIcon[nodes[0].class]
       }

     } else {
       node.logo = {
         "show":false,
       }
     }

     node.label = window.prompt("Please Provide Group Node Name")


    node.labelCfg = {
        position: "bottom",
        offset: 5,
        style: {
            fill: global.node.labelCfg.style.fill,
            fontSize: 12,
            stroke: global.node.labelCfg.style.stroke,
            lineWidth: 3
        }
    }

    node.colorSet = colorSets[dimoAggregateColorIndex]
    return node



}


self.gqlPeopleDataToNode = (person)=>{

    var node = {
        "id": person.id,
        "type": "dimo-node",
        "class": "[People]",
        "label": person.full_name,
        "airtableURL": "https://airtable.com/tbldctvNPqAx3UlIm/viw0OpS8m5ttBgica/" + person.id,
    };

    if (person.people_people_types.length) {

        var url = JSON.parse(person.people_people_types[0].people_type.icon.replace(/\'/g, '"'))

        node._type = person.people_people_types[0].people_type.name

        if (url.length) {
            node.logo = {
                "show": true,
                "url": url[0]
            }
        } else {
            node.logo = {
                "show": false,
            }
        }




    } else {
        node.logo = {
            "show": false,
        }
    }

    node.level = 1;


    node.icon = {
        "url": dimoPeopleIcon
    }

    node.colorSet = colorSets[dimoPersonColorIndex]

    node.labelCfg = {
        position: "bottom",
        offset: 5,
        style: {
            fill: global.node.labelCfg.style.fill,
            fontSize: 12,
            stroke: global.node.labelCfg.style.stroke,
            lineWidth: 3
        }
    }

    return node

}

self.mapHandle = null;
self.popUpHandle = null;

function maybeShowMap(model) {
    // Ignoring the others, they aren't reliably geocoded yet
    if (model.class !== "[Resource]") {
        return;
    }
    
    self.graphQLClient
        .request(self.resourceFullQuery, {"resource_id": model.id})
        .then((data) => {
            if (!self.mapHandle) {
                self.mapHandle = L.map("mapContainer").setView([0.0, 0.0], 13);
                L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                        maxZoom: 19,
                        attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>'
                      }).addTo(self.mapHandle);
                self.popUpHandle = L.popup({closeButton: false, autoClose: false, closeOnEscapeKey: false, closeOnClick: false}).setLatLng([0.0, 0,0]).openOn(self.mapHandle);
                self.popUpHandle
            }
            const resource = data.resource[0];
            const resourceNode = self.gqlResourceDataToNode(resource);

            if (!resourceNode.lat) {
                alert("Resource has an invalid location, sorry!");
                return;
            }

            self.mapModalOpen();
            self.mapHandle.invalidateSize(false);
            self.mapHandle.setView([resourceNode.lat, resourceNode.lng], 13);
            self.popUpHandle.setLatLng([resourceNode.lat, resourceNode.lng]);
            self.popUpHandle.setContent("<strong>" + resourceNode.label + "</strong></br>" + resourceNode.location);
        })
}


function loadConnectedItems(model) {

    var nodes = [];
    var edges = [];

    self.searchModalOpen()

    if(model.class=="[Project]") {

      self.loadDimoProject(model.id,nodes, edges, false)

    }

    else if(model.class=="[Org]") {
      self.loadDimoOrg(model.id,nodes, edges, false)
    }

    else if (model.class=="[Device]") {
      self.loadDimoDevice(model.id,nodes,edges, false)
    }

    else if (model.class=="[Function]") {
      self.loadDimoFunction(model.id,nodes,edges, false)
    } else if (model.class=="[Resource]") {
      self.loadDimoResource(model.id,nodes,edges, false)
    } else if (model.class=="[People]") {
      self.loadDimoPerson(model.id,nodes,edges, false)
    }           
    





}


self.alignNewNodes = ()=>{
  var nodes = graph.getNodes()
  var newNodes = [];
  for (var i = nodes.length - 1; i >= 0; i--) {
    graph.setItemState(nodes[i],"focus",false)
    if(nodes[i]._cfg.model.new){
      newNodes.push(nodes[i])
    }
  }

  if(newNodes.length<2){
    return
  }

  const baseX = newNodes[0]._cfg.model.x
  const baseY = newNodes[0]._cfg.model.y
  var offset = 0;
  for (var i = newNodes.length - 1; i > 0; i--) {

    const newX = baseX
    const newY = baseY + (i+offset)*(50)
    graph.updateItem(newNodes[i],{x:newX,y:newY})
    graph.setItemState(newNodes[i],"focus",false)
    graph.setItemState(newNodes[i],"focus",true)



  }
  graph.setItemState(newNodes[0],"focus",false)
  graph.setItemState(newNodes[0],"focus",true)



}


self.addTextNode = (desiredText)=>{
  var newNode = self.CreateTextNode(desiredText)
  self.cachePositions = self.cacheNodePositions(graph.getNodes());
  self.refreshGraph([newNode],[])
}


self.changeTextForTextNode = (node)=>{


        
        var model = node.getModel()

        if (model.class=="[Text]"){
          self.mouseX = model.x
          self.mouseY = model.y
          const desiredText = window.prompt("Text for node?")
          graph.removeItem(node, true)
          self.addTextNode(desiredText)
        } else if (model.class == "[Aggregate]") {
          const newOriLabel = labelFormatter(desiredText)
          graph.updateItem(node, {label:desiredText,oriLabel:newOriLabel})
        }
        
}


self.refreshGraph = (nodes, edges_)=>{

    var edges = []

    var edge_;
    for (var i = edges_.length - 1; i >= 0; i--) {
      edge_ = edges_[i]

      if(self.dimoAggregatesEdgeMap[edge_.target]!=undefined){
        self.dimoAggregatesEdgeMap[edge_.target].push(edge_)
        edges.push({ "source": edge_.source, "target": self.dimoAggregatesMapReverse[edge_.target].id, type: "custom-cubic" })
        continue
      }

      if(self.dimoAggregatesEdgeMap[edge_.source]!=undefined){
        self.dimoAggregatesEdgeMap[edge_.source].push(edge_)
        edges.push({ "target": edge_.tar, "source": self.dimoAggregatesMapReverse[edge_.source].id, type: "custom-cubic" })
        continue
      }

      edges.push(edge_)


    }


    
    layout.instance.stop();
    nodes.forEach((node) => {
      node.skip = false;


    })

    edges.forEach((edge) => {
      edge.skip = false;


    })

    

    let currentNodeIds = [];
    let removeNodes = [];

    const graphNodes = graph.getNodes();
    const graphEdges = graph.getEdges();
    var node,edge;

     for (var i = graphNodes.length - 1; i >= 0; i--) {
       currentNodeIds.push(graphNodes[i]._cfg.id)
     }
     for (var i = nodes.length - 1; i >= 0; i--) {
       if(currentNodeIds.includes(nodes[i].id)){
         removeNodes.push(i);
       }
     }


     for (var i = 0; i <= removeNodes.length-1; i++) {
       
       nodes.splice(removeNodes[i],1)
        
     }


     for (var i = graphNodes.length - 1; i >= 0; i--) {
       //console.log(graphNodes[i].getModel())
       node = graphNodes[i].getModel()
       node.skip = true;
       if(node.class != "[Text]"){
         node.label = node.oriLabel;

       }
       nodes.push(node);
     }

     for (var i = graphEdges.length - 1; i >= 0; i--) {
       edge = graphEdges[i].getModel()
       edge.skip = true;
       edges.push(edge);
     }






    var edges_ = removeDuplicateEdges(edges);
    edges_ = removeDuplicateEdges(edges_);
    processAllNodesEdges(nodes,edges_, false);




    graph.changeData({nodes:nodes,edges:edges_},true);
    
  hideItems(graph);
  graph.getNodes().forEach((node) => {
    node.toFront();
  });

  

}



function initGraphData() {
  if(self.groupByType){
    console.info("Group By [Type] enabled")
  }
  if(self.groupByTable){
    console.info("Group By Table enabled")
  }
  if(self.groupByNone){
    console.info("No Grouping")
  }

  const vars = getUrlVars();
  console.info("initGraph",vars)

  if (vars["s3State"] != undefined){
    
    fetch("/graphviz-states/"+vars["s3State"]).then(rdata => {

      const jsonData = rdata.json().then(data => {

            console.log("jsonData",data)

      for (var i = data.nodes.length - 1; i >= 0; i--) {
      //colorSets[dimoProjectColorIndex]
      var indx;
      if (data.nodes[i].class == "[Project]"){
        self.dimoProjects[data.nodes[i].id] = data.nodes[i]
        indx = dimoProjectColorIndex
      } else if (data.nodes[i].class == "[Device]"){
        self.dimoDevices[data.nodes[i].id] = data.nodes[i]
        indx = dimoDeviceColorIndex
      } else if (data.nodes[i].class == "[Org]"){
        self.dimoOrgs[data.nodes[i].id] = data.nodes[i]
        indx = dimoOrgColorIndex
      } else if (data.nodes[i].class == "[Function]"){
        self.dimoFunctions[data.nodes[i].id] = data.nodes[i]
        indx = dimoFunctionColorIndex
      } else if (data.nodes[i].class == "[People]"){
        self.dimoPeople[data.nodes[i].id] = data.nodes[i]
        indx = dimoPersonColorIndex
      } else if (data.nodes[i].class == "[Resource]"){
        self.dimoResources[data.nodes[i].id] = data.nodes[i]
        indx = dimoResourceColorIndex
      } else if (data.nodes[i].class == "[Aggregate]"){
        self.dimoAggregates[data.nodes[i].id] = data.nodes[i]
        indx = dimoAggregateColorIndex
      } else if (data.nodes[i].class == "[Text]"){
        self.dimoText[data.nodes[i].id] = data.nodes[i]
        indx = dimoTextColorIndex
        data.nodes[i].label = data.nodes[i].label.replace(/(\r\n|\n|\r)/gm, "");
      }
      data.nodes[i].colorSet = colorSets[indx];
      data.nodes[i].labelCfg = {
      position: "bottom",
      offset: 5,
      style: {
        fill: global.node.labelCfg.style.fill,
        fontSize: 12,
        stroke: global.node.labelCfg.style.stroke,
        lineWidth: 3
      }
    }
    }
    self.dimoGraphData.nodes = data.nodes
    self.dimoGraphData.edges = data.edges
    var ndata = self.initGraph(data.nodes,data.edges,false);



    if(data.dimoAggregatesMapReverse!=undefined){
      self.dimoAggregatesMapReverse = data.dimoAggregatesMapReverse

    }
    if(data.dimoAggregatesMap!=undefined){
      self.dimoAggregatesMap = data.dimoAggregatesMap
      
    }

    if(data.dimoAggregatesEdgeMap!=undefined){
      self.dimoAggregatesEdgeMap = data.dimoAggregatesEdgeMap
      
    }


     for (var key in self.dimoAggregatesMap) {

       for (var i = self.dimoAggregatesMap[key].length - 1; i >= 0; i--) {
         
           self.dimoAggregatesMap[key][i]
       
            var indx;
            if (self.dimoAggregatesMap[key][i].class == "[Project]"){
              self.dimoProjects[self.dimoAggregatesMap[key][i].id] = self.dimoAggregatesMap[key][i]
              indx = dimoProjectColorIndex
            } else if (self.dimoAggregatesMap[key][i].class == "[Device]"){
              self.dimoDevices[self.dimoAggregatesMap[key][i].id] = self.dimoAggregatesMap[key][i]
              indx = dimoDeviceColorIndex
            } else if (self.dimoAggregatesMap[key][i].class == "[Org]"){
              self.dimoOrgs[self.dimoAggregatesMap[key][i].id] = self.dimoAggregatesMap[key][i]
              indx = dimoOrgColorIndex
            } else if (self.dimoAggregatesMap[key][i].class == "[Function]"){
              self.dimoFunctions[self.dimoAggregatesMap[key][i].id] = self.dimoAggregatesMap[key][i]
              indx = dimoFunctionColorIndex
            } else if (self.dimoAggregatesMap[key][i].class == "[Resource]"){
              self.dimoResources[self.dimoAggregatesMap[key][i].id] = self.dimoAggregatesMap[key][i]
              indx = dimoResourceColorIndex
            } else if (self.dimoAggregatesMap[key][i].class == "[People]"){
              self.dimoPeople[self.dimoAggregatesMap[key][i].id] = self.dimoAggregatesMap[key][i]
              indx = dimoPersonColorIndex
            } else if (self.dimoAggregatesMap[key][i].class == "[Aggregate]"){
              self.dimoAggregates[self.dimoAggregatesMap[key][i].id] = self.dimoAggregatesMap[key][i]
              indx = dimoAggregateColorIndex
            }
            self.dimoAggregatesMap[key][i].colorSet = colorSets[indx];
            self.dimoAggregatesMap[key][i].labelCfg = {
            position: "bottom",
            offset: 5,
            style: {
              fill: global.node.labelCfg.style.fill,
              fontSize: 12,
              stroke: global.node.labelCfg.style.stroke,
              lineWidth: 3
            }
          }


       }

     }




      })
    })



  } else if (vars["org_id"] != undefined) {
    self.loadDimoOrg(vars["org_id"], self.dimoGraphData.nodes, self.dimoGraphData.edges);

  } else if (vars["project_id"] != undefined) {
    self.loadDimoProject(vars["project_id"], self.dimoGraphData.nodes, self.dimoGraphData.edges)
  } else if (vars["device_id"] != undefined) {
    self.loadDimoDevice(vars["device_id"], self.dimoGraphData.nodes, self.dimoGraphData.edges)
  } else if (vars["function_id"] != undefined) {
    self.loadDimoFunction(vars["function_id"], self.dimoGraphData.nodes, self.dimoGraphData.edges)
  } else if (vars["resource_id"] != undefined) {
    self.loadDimoResource(vars["resource_id"], self.dimoGraphData.nodes, self.dimoGraphData.edges)
  } else if (vars["person_id"] != undefined) {
    self.loadDimoPerson(vars["person_id"], self.dimoGraphData.nodes, self.dimoGraphData.edges)
  }

}

self.dimoGraphData = { nodes: [], edges: [] };



initGraphData();






function processAllNodesEdges(nodes_, edges_, isNewGraph) {


    const currentNodeMap = {};
    let maxNodeCount = -Infinity;
    const paddingRatio = 0.3;
    const paddingLeft = paddingRatio * CANVAS_WIDTH;
    const paddingTop = paddingRatio * CANVAS_HEIGHT;
    nodes_.forEach((node) => {
      //console.log(node.skip)

      //console.log(node)
      node.labelLineNum = undefined;
      if (node.class == "[Text]"){

      } else {
              node.oriLabel = node.label;
              node.label = formatText(node.label, labelMaxLength, "...");        
      }

      node.degree = 0;
      node.inDegree = 0;
      node.outDegree = 0;
      nodeMap[node.id] = node;


      if (currentNodeMap[node.id]) {
        debugger;
        console.warn("node exists already!", node.id);
        node.id = `${node.id}${Math.random()}`;
      }
      currentNodeMap[node.id] = node;
      if (node.count > maxNodeCount) maxNodeCount = node.count;
      const cachePosition = self.cachePositions ? self.cachePositions[node.id] : undefined;
      if (cachePosition) {
        node.x = cachePosition.x;
        node.y = cachePosition.y;
        node.new = false;
      } else {
        node.new = isNewGraph ? false : true;
        if (manipulatePosition && !node.x && !node.y) {
          node.x =
            manipulatePosition.x + 30 * Math.cos(Math.random() * Math.PI * 2);
          node.y =
            manipulatePosition.y + 30 * Math.sin(Math.random() * Math.PI * 2);
        }
      }
    });



  edges_.forEach((edge) => {

      if (edge.skip == true){
        return
      }

    // to avoid the dulplicated id to nodes
    if (!edge.id) edge.id = `edge-${uuidv4()}`;
    else if (edge.id.split("-")[0] !== "edge") edge.id = `edge-${edge.id}`;
    // TODO: delete the following line after the queried data is correct
    if (!currentNodeMap[edge.source] || !currentNodeMap[edge.target]) {
      console.warn(
        "edge source target does not exist",
        edge.source,
        edge.target,
        edge.id
      );
      return;
    }
    const sourceNode = currentNodeMap[edge.source];
    const targetNode = currentNodeMap[edge.target];

    if (!sourceNode || !targetNode)
      console.warn(
        "source or target is not defined!!!",
        edge,
        sourceNode,
        targetNode
      );

    // calculate the degree
    sourceNode.degree++;
    targetNode.degree++;
    sourceNode.outDegree++;
    targetNode.inDegree++;
  });

  edges_.forEach((edge) => {

         if (edge.skip == true){
        return
      }

     debugger;
    // to avoid the dulplicated id to nodes
    if (!edge.id) edge.id = `edge-${uuidv4()}`;
    else if (edge.id.split("-")[0] !== "edge") edge.id = `edge-${edge.id}`;
    // TODO: delete the following line after the queried data is correct
    if (!currentNodeMap[edge.source] || !currentNodeMap[edge.target]) {
      console.warn(
        "edge source target does not exist",
        edge.source,
        edge.target,
        edge.id
      );
      return;
    }
    const sourceNode = currentNodeMap[edge.source];
    const targetNode = currentNodeMap[edge.target];

    if (!sourceNode || !targetNode)
      console.warn(
        "source or target is not defined!!!",
        edge,
        sourceNode,
        targetNode
      );

    // calculate the degree
    sourceNode.degree++;
    targetNode.degree++;
    sourceNode.outDegree++;
    targetNode.inDegree++;
  });
  const countRange = 7;
  const minEdgeSize = 1;
  const maxEdgeSize = 7;
  const edgeSizeRange = maxEdgeSize - minEdgeSize;

  edges_.forEach((edge) => {

         if (edge.skip == true){
        return
      }
    // set edges' style
    const targetNode = currentNodeMap[edge.target];

    const size = 5
    edge.size = size;

    const arrowWidth = Math.max(size / 2 + 2, 3);
    const arrowLength = 10;
    const arrowBeging = arrowLength;
    let arrowPath = `M ${arrowBeging},0 L ${
      arrowBeging + arrowLength
    },-${arrowWidth} L ${arrowBeging + arrowLength},${arrowWidth} Z`;
    let d = arrowLength;

    const sourceNode = currentNodeMap[edge.source];
    const isRealEdge = false
    const stroke = global.edge.style.stroke;
    const opacity = global.edge.style.strokeOpacity;
    const dash = Math.max(size, 2);
    const lineDash = [dash, dash];
    edge.style = {
      stroke,
      strokeOpacity: opacity,
      cursor: "pointer",
      lineAppendWidth: 5,
      fillOpacity: 1,
      lineDash,
      endArrow: arrowPath
        ? {
            path: arrowPath,
            d,
            fill: stroke,
            strokeOpacity: 0
          }
        : false
    };

    // arrange the other nodes around the hub
    const sourceDis = sourceNode.size / 2 + 20;
    const targetDis = targetNode.size / 2 + 20;
    if (sourceNode.x && !targetNode.x) {
      targetNode.x =
        sourceNode.x + sourceDis * Math.cos(Math.random() * Math.PI * 2);
    }
    if (sourceNode.y && !targetNode.y) {
      targetNode.y =
        sourceNode.y + sourceDis * Math.sin(Math.random() * Math.PI * 2);
    }
    if (targetNode.x && !sourceNode.x) {
      sourceNode.x =
        targetNode.x + targetDis * Math.cos(Math.random() * Math.PI * 2);
    }
    if (targetNode.y && !sourceNode.y) {
      sourceNode.y =
        targetNode.y + targetDis * Math.sin(Math.random() * Math.PI * 2);
    }

    if (!sourceNode.x && !sourceNode.y && manipulatePosition) {
      sourceNode.x =
        manipulatePosition.x + 30 * Math.cos(Math.random() * Math.PI * 2);
      sourceNode.y =
        manipulatePosition.y + 30 * Math.sin(Math.random() * Math.PI * 2);
    }
    if (!targetNode.x && !targetNode.y && manipulatePosition) {
      targetNode.x =
        manipulatePosition.x + 30 * Math.cos(Math.random() * Math.PI * 2);
      targetNode.y =
        manipulatePosition.y + 30 * Math.sin(Math.random() * Math.PI * 2);
    }
  });


}

function removeDuplicateEdges(edges) {
    var edge
    const newEdges = [];
    var toRemove = [];


    for (var i = edges.length - 1; i >= 0; i--) {

        if (!toRemove.includes(i)) {
            for (var j = edges.length - 1; j >= 0; j--) {

                if (j != i && !toRemove.includes(j)) {
                    if (edges[j].source == edges[i].source && edges[j].target == edges[i].target) {
                        console.warn(edges[i].source, edges[j].source,edges[i].target, edges[j].target)
                        toRemove.push(j)
                    }
                }

            }


        }
    }

    toRemove = [...new Set(toRemove)];

    for (var i = edges.length - 1; i >= 0; i--) {
        if (!toRemove.includes(i)) {
            for (var j = edges.length - 1; j >= 0; j--) {

                if (!toRemove.includes(j)) {
                    if (edges[j].source == edges[i].target && edges[j].target == edges[i].source) {
                        console.warn(edges[i].source, edges[j].target,edges[i].target, edges[j].source)
                        toRemove.push(j)
                    }
                }

            }
        }



    }

    toRemove = [...new Set(toRemove)];
    toRemove.sort();
    for (var i = edges.length - 1; i >= 0; i--) {
        if(toRemove.includes(i)!=true){
          newEdges.push(edges[i])
        }
    }

    return newEdges;


}

function atou(b64) {
  return decodeURIComponent(escape(atob(b64)));
}

function utoa(data) {
  return btoa(unescape(encodeURIComponent(data)));
}


function getStateURL() {




  var data = JSON.parse(JSON.stringify(graph.save()));
  console.log(data)
  var deleteNodes = [];
  var deleteEdges = [];
  for (var i = data.nodes.length - 1; i >= 0; i--) {
    delete data.nodes[i].colorSet
    
    if (data.nodes[i].class != "[Text]"){
          data.nodes[i].label = data.nodes[i].oriLabel
    }
    delete data.nodes[i].oriLabel
    delete data.nodes[i].degree
    delete data.nodes[i].inDegree
    delete data.nodes[i].outDegree
    delete data.nodes[i].labelCfg
    delete data.nodes[i].new
    delete data.nodes[i].style
    delete data.nodes[i].skip
    delete data.nodes[i].depth

    if (hiddenItemIds.includes(data.nodes[i].id)){
      deleteNodes.push(i)
    }
  }

  for (var i = data.edges.length - 1; i >= 0; i--) {
    delete data.edges[i].id
    delete data.edges[i].size
    delete data.edges[i].style
    delete data.edges[i].startPoint
    delete data.edges[i].endPoint
    delete data.edges[i].curveOffset
    delete data.edges[i].curvePosition
    delete data.edges[i].skip
    delete data.edges[i].depth
    
    if (hiddenItemIds.includes(data.edges[i].source)){
      deleteEdges.push(i)
    } 

    if (hiddenItemIds.includes(data.edges[i].target)){
      deleteEdges.push(i)
    }     
  }

  console.log(deleteNodes,deleteEdges,hiddenItemIds)
  for (var i = 0; i <= deleteNodes.length-1; i++) {
     data.nodes.splice(deleteNodes[i], 1);
  }

  for (var i = 0; i <= deleteEdges.length-1; i++) {
     data.edges.splice(deleteEdges[i], 1);
  }



  var dimoAggregatesMapReverse = {}
  var dimoAggregatesMap = {}
  var dimoAggregatesEdgeMap = {}

  var node_,newNode
  for (var key in self.dimoAggregatesMap) {
    dimoAggregatesMap[key] = []
    for (var i = self.dimoAggregatesMap[key].length - 1; i >= 0; i--) {
      node_ = self.dimoAggregatesMap[key][i]
      newNode = {}
      newNode.id = node_.id
      newNode.class = node_.class
      newNode.label = node_.oriLabel
      newNode.airtableURL = node_.airtableURL
      newNode.level = node_.level
      newNode.logo = node_.logo
      newNode._type = node_._type
      newNode.icon = node_.icon
      newNode.x = node_.x
      newNode.y = node_.y
      newNode.size = node_.size
      newNode.oriFontSize = node_.oriFontSize
      dimoAggregatesMap[key].push(newNode)
    }
  }

  for (var key in self.dimoAggregatesMapReverse) {
      node_ = self.dimoAggregatesMapReverse[key]
      newNode = {}
      newNode.id = node_.id
      dimoAggregatesMapReverse[key] = newNode
  }

  var edge_,newEdge
  for (var key in self.dimoAggregatesEdgeMap) {

    dimoAggregatesEdgeMap[key] = [];

    for (var i = self.dimoAggregatesEdgeMap[key].length - 1; i >= 0; i--) {
      edge_ = self.dimoAggregatesEdgeMap[key][i]
      newEdge = {}
      newEdge.source = edge_.source
      newEdge.target = edge_.target
      newEdge.type = edge_.type
      dimoAggregatesEdgeMap[key].push(newEdge)
    }
  }

  data.dimoAggregatesMapReverse = dimoAggregatesMapReverse
  data.dimoAggregatesMap = dimoAggregatesMap
  data.dimoAggregatesEdgeMap = dimoAggregatesEdgeMap


  console.log("saveData",data);
  const jsonData = JSON.stringify(data);
      fetch("/default/graphvizLambdaS3", {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
          },
          body: jsonData,

      }).then(data => {
          const s3resp = data.json().then(s3data => {
          const url = window.location.origin + window.location.pathname + "?s3State=" + s3data.url
          window.prompt("Page URL",url);

          })
          
      })




}


self.groupNodesByType = (nodes, edges)=>{

          var newNodes = []


          var typeGrouping = {
          }
          var typeGroupingSet = new Set()

          var node
          for (var i = nodes.length - 1; i >= 0; i--) {
            node = nodes[i]
            if(typeGroupingSet.has(node._type)){
              typeGrouping[node._type].push(node)
            } else {
              typeGroupingSet.add(node._type)
              typeGrouping[node._type] = [node]
            }
          }

          var newNode
          for (var key in typeGrouping) {

            if(typeGrouping[key].length){
              if(typeGrouping[key].length==1){
                newNodes.push(typeGrouping[key][0])
              } else {
                newNode = self.dimoAggregatedNode(typeGrouping[key])
                newNodes.push(newNode)
                self.dimoAggregatesMap[newNode.id] = new Set()
                self.dimoAggregates[newNode.id] = newNode
                for (var i = typeGrouping[key].length - 1; i >= 0; i--) {
                  self.dimoAggregatesMap[newNode.id].add(typeGrouping[key][i].id)
                  self.dimoAggregatesMapReverse[typeGrouping[key][i].id] = newNode
                }



              }
            }


          }


          var newEdges = self.fixAggregateEdges(edges)
          return [newNodes,newEdges]



}



self.fixAggregateEdges = (edges)=>{

  var newEdges = []

  var edge,newTarget,newSource
  for (var i = edges.length - 1; i >= 0; i--) {
    edge = edges[i]
    newTarget = edge.target
    newSource = edge.source

    if(self.dimoAggregatesMapReverse[edge.target]!=undefined){
      newTarget = self.dimoAggregatesMapReverse[edge.target].id
    }
    if(self.dimoAggregatesMapReverse[edge.source]!=undefined){
      newSource = self.dimoAggregatesMapReverse[edge.source].id
    }


    if(newTarget!=edge.target || newSource!=edge.source) {

        self.dimoEdgeMap[edge.target].push(edge)
        self.dimoEdgeMap[edge.source].push(edge)
        newEdges.push({ "source": newSource, "target": newTarget, type: "custom-cubic" })

    } else {
      newEdges.push(edge)
    }


  }

  return newEdges

}





self.groupNodesByTable = (nodes, edges)=>{

        var newNodes = []

        var tableGrouping = {
                      "[Org]":[],
                      "[Project]":[],
                      "[Function]":[],
                      "[Device]":[],
                      "[Resource]":[],
                      "[People]":[],
          }

          var node
          for (var i = nodes.length - 1; i >= 0; i--) {
            node = nodes[i]
            tableGrouping[node.class].push(node)
          }
          var newNode
          for (var key in tableGrouping) {

            if(tableGrouping[key].length){
              if(tableGrouping[key].length==1){
                newNodes.push(tableGrouping[key][0])
              } else {
                newNode = self.dimoAggregatedNode(tableGrouping[key])
                newNodes.push(newNode)
                self.dimoAggregatesMap[newNode.id] = new Set()
                self.dimoAggregates[newNode.id] = newNode
                for (var i = tableGrouping[key].length - 1; i >= 0; i--) {
                  self.dimoAggregatesMap[newNode.id].add(tableGrouping[key][i].id)
                  self.dimoAggregatesMapReverse[tableGrouping[key][i].id] = newNode
                }



              }
            }


          }
          var newEdges = self.fixAggregateEdges(edges)
          return [newNodes,newEdges]




}


self.aggregateNodes = (nodes_)=>{

  if (nodes_.length < 2) {
    return
  }



  for (var i = nodes_.length - 1; i >= 0; i--) {
    if(nodes_[i].getModel().class=="[Aggregate]"){
      window.alert("Can't Group a Group Node!")
      return
    }

  }



  var nodes = [];
  var nodeIds = new Set()

  for (var i = nodes_.length - 1; i >= 0; i--) {
    nodes.push(nodes_[i].getModel())

  }

  for (var i = nodes.length - 1; i >= 0; i--) {
    nodeIds.add(nodes[i].id)
    self.dimoAggregatesEdgeMap[nodes[i].id] = []
  }

  var groupNode = self.dimoAggregatedNode(nodes)
  self.dimoAggregatesMap[groupNode.id] = []

  for (var i = nodes.length - 1; i >= 0; i--) {
    self.dimoAggregatesMap[groupNode.id].push(nodes[i])
    self.dimoAggregatesMapReverse[nodes[i].id] = groupNode
  }


  var edges_ = graph.getEdges()
  var edges = [];

  var newEdges = []
  var edgeModel
  for (var i = edges_.length - 1; i >= 0; i--) {
      edgeModel = edges_[i].getModel()
    if(nodeIds.has(edgeModel.target) && nodeIds.has(edgeModel.source)) {

      console.log("Has BOTH",edgeModel)
      self.dimoAggregatesEdgeMap[edgeModel.target].push(edgeModel)
      self.dimoAggregatesEdgeMap[edgeModel.source].push(edgeModel)


    } else if(nodeIds.has(edgeModel.target) && !nodeIds.has(edgeModel.source)) {
      self.dimoAggregatesEdgeMap[edgeModel.target].push(edgeModel)
      newEdges.push({ "source": edgeModel.source, "target": groupNode.id, type: "custom-cubic" })


    } else if(nodeIds.has(edgeModel.source) && !nodeIds.has(edgeModel.target)) {
      self.dimoAggregatesEdgeMap[edgeModel.source].push(edgeModel)
      newEdges.push({ "source": groupNode.id, "target": edgeModel.target, type: "custom-cubic" })


    } else {
      newEdges.push(edgeModel)
    }
  }

  var newEdges_ = []

  for (var i = newEdges.length - 1; i >= 0; i--) {
     if(nodeIds.has(newEdges[i].target) || nodeIds.has(newEdges[i].source)){
       console.log(newEdges[i])
     } else {
       newEdges_.push(newEdges[i])
     }

    
  }




  for (var i = nodes_.length - 1; i >= 0; i--) {
    graph.removeItem(nodes_[i],false)
    
  }


  self.cachePositions = self.cacheNodePositions(graph.getNodes());
  self.refreshGraph([groupNode],newEdges_)
  // var newNodes = [groupNode];

  // var curNodes = graph.getNodes()
  // var model
  // for (var i = curNodes.length - 1; i >= 0; i--) {
  //   model = curNodes[i].getModel()
  //   if(!nodeIds.has(model.is)){
  //     newNodes.push(model)
  //   }
  // }

  // console.log("changeData",{nodes:newNodes,edges:newEdges})
  // graph.changeData({nodes:newNodes,edges:newEdges})







}


self.expandNode = (item)=>{


  var model = item.getModel()
  var newNodes = [];
  var newEdges =[];

  var node
  for (var i = self.dimoAggregatesMap[model.id].length - 1; i >= 0; i--) {
    node = self.dimoAggregatesMap[model.id][i]
    newNodes.push(node)
    for (var j = self.dimoAggregatesEdgeMap[node.id].length - 1; j >= 0; j--) {
      newEdges.push(self.dimoAggregatesEdgeMap[node.id][j])
    }
    delete self.dimoAggregatesMapReverse[node.id]
    delete self.dimoAggregatesEdgeMap[node.id]
  }

  delete self.dimoAggregatesMap[model.id]


  graph.removeItem(item,false)
  self.cachePositions = self.cacheNodePositions(graph.getNodes());
  self.refreshGraph(newNodes,newEdges)
  self.alignNewNodes()


}







self.initGraph = (nodes_, edges_, useLayout=true)=>{
  

  self.graphInit = true

  for (var i = nodes_.length - 1; i >= 0; i--) {
    self.dimoEdgeMap[nodes_[i].id] = []  
  }

  var edges__ = removeDuplicateEdges(edges_);

  var nodes = [];

  var idSet = new Set()

  for (var i = nodes_.length - 1; i >= 0; i--) {
      
      if(!idSet.has(nodes_[i].id)){
          idSet.add(nodes_[i].id)
          nodes.push(nodes_[i])
      }
      
  }



  var edges = edges__




  
  const container = document.getElementById("container");
  container.style.backgroundColor = "#2b2f33";
  CANVAS_WIDTH = container.scrollWidth;
  CANVAS_HEIGHT = (self.innerHeight);

   
    const contextMenu = new G6.Menu({
      shouldBegin(evt) {
        if (evt.target && evt.target.isCanvas && evt.target.isCanvas())
          return true;
        if (evt.item) return true;
        return false;
      },
      getContent(evt) {
        const { item } = evt;
        if (evt.target && evt.target.isCanvas && evt.target.isCanvas()) {
          return `<ul>
          <li id='show'>Show all Hidden Items</li>
          <li id='textNode'>Create Text Node</li>
        </ul>`;
        } else if (!item) return;
        const itemType = item.getType();
        const model = item.getModel();
        if (itemType && model) {
          if (itemType == "node") {
            if (model.class != "[Aggregate]" && model.class != "[Text]") {
              if (model.class == "[Resource]") {
                return `<ul>
                  <li id='hide'>Hide Selected</li>
                  <li id='map'>Show in Map</li>
                  <li id='url'>View in Database</li>
                  <li id='load'>Load Connections</li>
                  <li id='align'>Align Selected</li>
                  <li id='group'>Group Selected</li>
                  <li id='organizeAll'>Organize All</li>
                  <li id='selectConnections'>Select Connected</li>
                  <li id='selectByEntity'>Select By Entity</li>
                  <li id='selectByType'>Select By [Type]</li>
                  </ul>`;
              } else {
                return `<ul>
                  <li id='hide'>Hide Selected</li>
                  <li id='url'>View in Database</li>
                  <li id='load'>Load Connections</li>
                  <li id='align'>Align Selected</li>
                  <li id='group'>Group Selected</li>
                  <li id='organizeAll'>Organize All</li>
                  <li id='selectConnections'>Select Connected</li>
                  <li id='selectByEntity'>Select By Entity</li>
                  <li id='selectByType'>Select By [Type]</li>
                  </ul>`;
              }
            } else if (model.class == "[Text]") {

              return `<ul>
                     <li id='hide'>Hide Selected</li>
                     <li id='changeText'>Change Text</li>
                     </ul>`;

            } else if (model.class == "[Aggregate]") {
              return `<ul>
              <li id='hide'>Hide Selected</li>
              <li id='align'>Align Selected</li>
              <li id='organizeAll'>Organize All</li>
              <li id='selectConnections'>Select Connected</li>
              <li id='expand'>Expand Group</li>
              <li id='changeText'>Change Text</li>
            </ul>`;


            }
          }
        }
      },
      handleMenuClick: (target, item) => {
        const model = item && item.getModel();
        const liIdStrs = target.id.split("-");
        let mixedGraphData;
        const Nodes = graph.getNodes()
        var focusNodes
        switch (liIdStrs[0]) {
          case "hide":

            var hidNodes = graph.findAllByState("node", "focus");

            for (var i = hidNodes.length - 1; i >= 0; i--) {
              hiddenItemIds.push(hidNodes[i]._cfg.id);
              graph.hideItem(hidNodes[i])

            }
            //console.log(hiddenItemIds)
            
            break;
          case "map":
            maybeShowMap(model);
            break;
          case "show":
            showItems(graph);
            break;
          case "url":
            window.open(model.airtableURL, '_blank');
            break;
          case "load":
            self.cachePositions = self.cacheNodePositions(graph.getNodes());
            loadConnectedItems(model);
            break;
           case "selectConnections":
            item._cfg.edges.forEach((edge)=>{
              graph.setItemState(edge._cfg.source,"focus",true)
              graph.setItemState(edge._cfg.target,"focus",true)
            })
            break;
          case "align":
            focusNodes = graph.findAllByState("node", "focus");
            
            for (var i = focusNodes.length - 1; i >= 0; i--) {
              if(focusNodes[i]._cfg.id==item._cfg.id){
                focusNodes.splice(i,1)
                break;
              }
            }

            const baseX = item._cfg.model.x
            const baseY = item._cfg.model.y
            var offset = 0;
            for (var i = focusNodes.length - 1; i >= 0; i--) {

                 const newX = baseX
                 const newY = baseY + (i+1+offset)*(50)
                 graph.updateItem(focusNodes[i],{x:newX,y:newY})
                 graph.setItemState(focusNodes[i],"focus",false)
                 graph.setItemState(focusNodes[i],"focus",true)

              
            
            }
            graph.setItemState(item,"focus",false)
            graph.setItemState(item,"focus",true)
            break
          case "group":
            focusNodes = graph.findAllByState("node", "focus");
            for (var i = focusNodes.length - 1; i >= 0; i--) {
              if(focusNodes[i]._cfg.id==item._cfg.id){
                focusNodes.splice(i,1)
                break;
              }
            }
            focusNodes.push(item)
            self.aggregateNodes(focusNodes)
            break;
           case "expand":
           self.expandNode(item);
           break;
          case "selectByType":
          
            console.log(Nodes)
            for (var i = Nodes.length - 1; i >= 0; i--) {
              if(item._cfg.model._type==Nodes[i]._cfg.model._type){
                graph.setItemState(Nodes[i],"focus",true)
              }
            }            
            break;
          case "selectByEntity":
            console.log(Nodes)
            for (var i = Nodes.length - 1; i >= 0; i--) {
              if(item._cfg.model.class==Nodes[i]._cfg.model.class){
                graph.setItemState(Nodes[i],"focus",true)
              }
            }

            
            break;
          case "organizeAll":
           
            var radLayoutConfig = {
                type: 'radial',
                center: [item._cfg.model.x,item._cfg.model.y], // The center of the graph by default
                linkDistance: 100, // The edge length
                maxIteration: 2000,
                focusNode: item._cfg.id,
                unitRadius: 500,
                preventOverlap: true, // nodeSize or size in data is required for preventOverlap: true
                maxPreventOverlapIteration:10000,
                nodeSize: 200,
                strictRadial: true,
                workerEnabled: true, // Whether to activate web-worker

            }
            graph.set('animate', true);
            graph.updateLayout(radLayoutConfig)


            break;
          case "textNode":
            console.log("event",target, item)
            self.addTextNode(window.prompt("Text for node?"))

            break;
          case "changeText":
            self.changeTextForTextNode(item)
            break;
          default:
            break;
        }
      },
      // offsetX and offsetY include the padding of the parent container
      // 需要加上父级容器的 padding-left 16 与自身偏移量 10
      offsetX: 16 + 10,
      // 需要加上父级容器的 padding-top 24 、画布兄弟元素高度、与自身偏移量 10
      offsetY: 0,
      // the types of items that allow the menu show up
      // 在哪些类型的元素上响应
      itemTypes: ["node", "edge", "canvas"]
    });



  const tooltip = new G6.Tooltip({
    offsetX: 10,
    offsetY: 10,
    // the types of items that allow the tooltip show up
    // 允许出现 tooltip 的 item 类型
    itemTypes: ['edge','node'],

    shouldBegin: (e)=> {

      if (e.item.getType()=="edge"){
        return true
      } else if (e.item.getType()=="node") {
        var model = e.item.getModel()

        if (model.class == "[Aggregate]"){
          return false
        } else {

          return true

        }

      }


    },
    // custom the tooltip's content
    // 自定义 tooltip 内容
    getContent: (e) => {
      const outDiv = document.createElement('div');
      outDiv.style.width = 'fit-content';
      //outDiv.style.padding = '0px 0px 20px 0px';
      
      const itemType = e.item.getType()
      var model = e.item.getModel()
      if (itemType=="edge"){

        if(model.relationshipType!=undefined){



                if(model.relationshipType == "customer"){

                               outDiv.innerHTML = `<ul>
                                                       <li>Customer [Org]&#60;-&#62;[Org] Relationship</li>
                                                   </ul>
                                                   <ul>
                                                      <li>Provider: ${e.item.getSource().getModel().oriLabel}</li>
                                                   </ul>
                                                   <ul>
                                                      <li>Customer: ${e.item.getTarget().getModel().oriLabel}</li>
                                                   </ul>`;




                } else if (model.relationshipType == "invest") {


                               outDiv.innerHTML = `<ul>
                                                       <li>Investment [Org]&#60;-&#62;[Org] Relationship</li>
                                                   </ul>
                                                   <ul>
                                                      <li>Investor: ${e.item.getSource().getModel().oriLabel}</li>
                                                   </ul>
                                                   <ul>
                                                      <li>Reciever: ${e.item.getTarget().getModel().oriLabel}</li>
                                                   </ul>`;


                } else if (model.relationshipType == "subsidiary") {


                               outDiv.innerHTML = `<ul>
                                                       <li>Parent [Org]&#60;-&#62;[Org] Relationship</li>
                                                   </ul>
                                                   <ul>
                                                      <li>Subsidiary: ${e.item.getSource().getModel().oriLabel}</li>
                                                   </ul>
                                                   <ul>
                                                      <li>Parent: ${e.item.getTarget().getModel().oriLabel}</li>
                                                   </ul>`;


                }

        } else {

            outDiv.innerHTML = `
              <ul>
                <li>${e.item.getSource().getModel().class} &#60;-&#62; ${e.item.getTarget().getModel().class}</li>
              </ul>
              <ul>
                <li>Source: ${e.item.getSource().getModel().oriLabel}</li>
              </ul>
              <ul>
                <li>Target: ${e.item.getTarget().getModel().oriLabel}</li>
              </ul>`;


        }
      } else if (itemType=="node"){


      
      var typeString
      if(model._type!=undefined){
        typeString = model._type
      } else {
        typeString = "None"
      }
      //<img src="img_girl.jpg" alt="Girl in a jacket" width="500" height="600">
      var imgTag

      if (model.class != "[Org]") {
          if (model.logo.show) {
              imgTag = `<img src="${model.logo.url}" width="25" height="25">`
          } else {
              imgTag = ""
          }
      } else {
        imgTag = `<img src="${model.icon.url}" width="25" height="25">`
      }




      outDiv.innerHTML = `
        <ul>
        <h4>${model.class} Type</h4>
        </ul>
        <ul>
          ${imgTag} ${typeString}
        </ul>`;


      }

      return outDiv;
    },
  });







    const toolbar = new G6.ToolBar({
        getContent: () => {
            return `
<ul class="g6-component-toolbar" style="position: absolute;left: 25vw;right: 25vw;top: 9px;align:center">
    <li code="redo">
        <svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <path d="M256 682.666667c0-102.741333 66.730667-213.333333 213.333333-213.333334 107.008 0 190.762667 56.576 230.570667 125.354667L611.968 682.666667H853.333333v-241.365334l-91.562666 91.562667C704.768 448.469333 601.130667 384 469.333333 384c-196.096 0-298.666667 150.229333-298.666666 298.666667h85.333333z" fill="" p-id="2041"></path>
        </svg>
    </li>
    <li code="undo">
        <svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <path d="M170.666667 682.666667h241.365333l-87.936-87.978667C363.904 525.909333 447.658667 469.333333 554.666667 469.333333c146.602667 0 213.333333 110.592 213.333333 213.333334h85.333333c0-148.437333-102.570667-298.666667-298.666666-298.666667-131.797333 0-235.392 64.469333-292.48 148.821333L170.666667 441.301333V682.666667z" fill="" p-id="2764"></path>
        </svg>
    </li>
    <li code="zoomOut">
        <svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <path d="M658.432 428.736a33.216 33.216 0 0 1-33.152 33.152H525.824v99.456a33.216 33.216 0 0 1-66.304 0V461.888H360.064a33.152 33.152 0 0 1 0-66.304H459.52V296.128a33.152 33.152 0 0 1 66.304 0V395.52H625.28c18.24 0 33.152 14.848 33.152 33.152z m299.776 521.792a43.328 43.328 0 0 1-60.864-6.912l-189.248-220.992a362.368 362.368 0 0 1-215.36 70.848 364.8 364.8 0 1 1 364.8-364.736 363.072 363.072 0 0 1-86.912 235.968l192.384 224.64a43.392 43.392 0 0 1-4.8 61.184z m-465.536-223.36a298.816 298.816 0 0 0 298.432-298.432 298.816 298.816 0 0 0-298.432-298.432A298.816 298.816 0 0 0 194.24 428.8a298.816 298.816 0 0 0 298.432 298.432z"></path>
        </svg>
    </li>
    <li code="zoomIn">
        <svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="24" height="24">
            <path d="M639.936 416a32 32 0 0 1-32 32h-256a32 32 0 0 1 0-64h256a32 32 0 0 1 32 32z m289.28 503.552a41.792 41.792 0 0 1-58.752-6.656l-182.656-213.248A349.76 349.76 0 0 1 480 768 352 352 0 1 1 832 416a350.4 350.4 0 0 1-83.84 227.712l185.664 216.768a41.856 41.856 0 0 1-4.608 59.072zM479.936 704c158.784 0 288-129.216 288-288S638.72 128 479.936 128a288.32 288.32 0 0 0-288 288c0 158.784 129.216 288 288 288z" p-id="3853"></path>
        </svg>
    </li>
    <li code="autoZoom">
        <svg class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" width="20" height="24">
            <path d="M684.288 305.28l0.128-0.64-0.128-0.64V99.712c0-19.84 15.552-35.904 34.496-35.712a35.072 35.072 0 0 1 34.56 35.776v171.008h170.944c19.648 0 35.84 15.488 35.712 34.432a35.072 35.072 0 0 1-35.84 34.496h-204.16l-0.64-0.128a32.768 32.768 0 0 1-20.864-7.552c-1.344-1.024-2.816-1.664-3.968-2.816-0.384-0.32-0.512-0.768-0.832-1.088a33.472 33.472 0 0 1-9.408-22.848zM305.28 64a35.072 35.072 0 0 0-34.56 35.776v171.008H99.776A35.072 35.072 0 0 0 64 305.216c0 18.944 15.872 34.496 35.84 34.496h204.16l0.64-0.128a32.896 32.896 0 0 0 20.864-7.552c1.344-1.024 2.816-1.664 3.904-2.816 0.384-0.32 0.512-0.768 0.768-1.088a33.024 33.024 0 0 0 9.536-22.848l-0.128-0.64 0.128-0.704V99.712A35.008 35.008 0 0 0 305.216 64z m618.944 620.288h-204.16l-0.64 0.128-0.512-0.128c-7.808 0-14.72 3.2-20.48 7.68-1.28 1.024-2.752 1.664-3.84 2.752-0.384 0.32-0.512 0.768-0.832 1.088a33.664 33.664 0 0 0-9.408 22.912l0.128 0.64-0.128 0.704v204.288c0 19.712 15.552 35.904 34.496 35.712a35.072 35.072 0 0 0 34.56-35.776V753.28h170.944c19.648 0 35.84-15.488 35.712-34.432a35.072 35.072 0 0 0-35.84-34.496z m-593.92 11.52c-0.256-0.32-0.384-0.768-0.768-1.088-1.088-1.088-2.56-1.728-3.84-2.688a33.088 33.088 0 0 0-20.48-7.68l-0.512 0.064-0.64-0.128H99.84a35.072 35.072 0 0 0-35.84 34.496 35.072 35.072 0 0 0 35.712 34.432H270.72v171.008c0 19.84 15.552 35.84 34.56 35.776a35.008 35.008 0 0 0 34.432-35.712V720l-0.128-0.64 0.128-0.704a33.344 33.344 0 0 0-9.472-22.848zM512 374.144a137.92 137.92 0 1 0 0.128 275.84A137.92 137.92 0 0 0 512 374.08z"></path>
        </svg>
    </li>
    <li code="saveState">
        <svg class="icon" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="20" height="24"> <g> <g> <g> <path d="M416,0H152.64L48,122.08V464c0,26.51,21.49,48,48,48h320c26.51,0,48-21.49,48-48V48C464,21.49,442.51,0,416,0z M432,464 c0,8.837-7.163,16-16,16H96c-8.837,0-16-7.163-16-16v-48h64v-32H80V133.92L167.36,32H416c8.837,0,16,7.163,16,16V464z"/> <rect x="176" y="64" width="32" height="128"/> <rect x="240" y="64" width="32" height="128"/> <rect x="304" y="64" width="32" height="128"/> <rect x="368" y="64" width="32" height="128"/> </g> </g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> 
        </svg>
    </li>
    <li code="settings">
        <svg class="icon" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="25" height="24" style="-ms-transform: rotate(360deg); -webkit-transform: rotate(360deg); transform: rotate(360deg);" viewBox="0 0 28 28"><g fill="none"><path d="M14 9.5a4.5 4.5 0 1 0 0 9a4.5 4.5 0 0 0 0-9zM11 14a3 3 0 1 1 6 0a3 3 0 0 1-6 0z" fill="#000000"/><path d="M21.71 22.395l-1.728-.759a1.72 1.72 0 0 0-1.542.086c-.467.27-.765.747-.824 1.284l-.208 1.88a.923.923 0 0 1-.703.796a11.67 11.67 0 0 1-5.412 0a.923.923 0 0 1-.702-.796l-.208-1.877a1.701 1.701 0 0 0-.838-1.281a1.694 1.694 0 0 0-1.526-.086l-1.728.759a.92.92 0 0 1-1.043-.215a12.064 12.064 0 0 1-2.707-4.672a.924.924 0 0 1 .334-1.016l1.527-1.128a1.7 1.7 0 0 0 0-2.74l-1.527-1.125a.924.924 0 0 1-.334-1.017A12.059 12.059 0 0 1 5.25 5.821a.92.92 0 0 1 1.043-.214l1.72.757a1.707 1.707 0 0 0 2.371-1.376l.21-1.878a.923.923 0 0 1 .715-.799c.881-.196 1.78-.3 2.704-.311c.902.01 1.8.115 2.68.311a.922.922 0 0 1 .715.8l.209 1.878a1.701 1.701 0 0 0 1.688 1.518c.233 0 .464-.049.68-.144l1.72-.757a.92.92 0 0 1 1.043.214a12.057 12.057 0 0 1 2.708 4.667a.924.924 0 0 1-.333 1.016l-1.525 1.127c-.435.32-.698.829-.698 1.37c0 .54.263 1.049.699 1.37l1.526 1.126c.316.234.45.642.334 1.017a12.065 12.065 0 0 1-2.707 4.667a.92.92 0 0 1-1.043.215zm-5.447-.198a3.162 3.162 0 0 1 1.425-1.773a3.22 3.22 0 0 1 2.896-.161l1.344.59a10.565 10.565 0 0 0 1.97-3.398l-1.189-.877v-.001a3.207 3.207 0 0 1-1.309-2.578c0-1.027.497-1.98 1.307-2.576l.002-.001l1.187-.877a10.56 10.56 0 0 0-1.971-3.397l-1.333.586l-.002.001c-.406.18-.843.272-1.286.272a3.202 3.202 0 0 1-3.178-2.852v-.002l-.163-1.46a11.476 11.476 0 0 0-1.95-.193c-.674.009-1.33.074-1.975.193l-.163 1.461A3.207 3.207 0 0 1 7.41 7.737l-1.336-.588a10.558 10.558 0 0 0-1.971 3.397l1.19.877a3.201 3.201 0 0 1 0 5.155l-1.19.878a10.565 10.565 0 0 0 1.97 3.403l1.345-.59a3.194 3.194 0 0 1 2.878.16a3.2 3.2 0 0 1 1.579 2.411v.005l.162 1.464c1.297.255 2.63.255 3.927 0l.162-1.467c.024-.22.07-.437.138-.645z" fill="#000000"/></g>
        </svg>
    </li>
    <li code="search">
       <svg class="icon" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" aria-hidden="true" focusable="false" width="20" height="24" style="-ms-transform: rotate(360deg); -webkit-transform: rotate(360deg); transform: rotate(360deg);" viewBox="0 0 24 24"><g fill="#000000"><path d="M15.25 0a8.25 8.25 0 0 0-6.18 13.72L1 22.88l1.12 1l8.05-9.12A8.251 8.251 0 1 0 15.25.01V0zm0 15a6.75 6.75 0 1 1 0-13.5a6.75 6.75 0 0 1 0 13.5z"/></g></svg>
    </li>


</ul>`
        },
        handleClick: (code, graph) => {
            const n = graph.getZoom()
            if (code === 'undo') {
                toolbar.undo()
            } else if (code == "redo") {
                toolbar.redo()
            } else if (code == "zoomIn") {
                var i = 1 - .05 * self.graphToolbar._cfgs.zoomSensitivity;
                if (i * n < (graph.get("minZoom"))) return;
                graph.zoomTo(n * i);
            } else if (code == "zoomOut") {
                var r = 1 / (1 - .05 * self.graphToolbar._cfgs.zoomSensitivity);
                if (r * n > (graph.get("maxZoom"))) return;
                graph.zoomTo(n * r);
            } else if (code == "autoZoom") {
              graph.fitView([20, 20]);
            } else if (code == "saveState") {
                  const pageUrl = getStateURL();
                  
            } else if (code == "settings") {
                    self.settingsModalOpen()
            } else if (code == "search") {
                    self.searchModalOpen()
            }

        }


    })
    self.graphToolbar = toolbar;

    graph = new G6.Graph({
    container: "container",
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
    linkCenter: true,
    minZoom: 0.1,
    groupByTypes: false,
    enabledStack: true,
    animate:false,
    renderer: "canvas",
    modes: {
        default: [{
                type: "drag-canvas",
                enableOptimize: true
            },
            {
                type: "zoom-canvas",
                enableOptimize: true,
                optimizeZoom: 0.01
            },
            "drag-node",
            "drag-combo",
            "collapse-expand-combo",
        ],
        brushSelect: [{
            includeEdges:false,
            type: "brush-select",
            selectedState: "focus",
            onSelect: (nodes, edges) => {
                console.log('onSelect', nodes, edges);
                },
            trigger: "drag"
        }]
    },
    defaultNode: {
        type: "dimo-node",
        size: DEFAULTNODESIZE
    },
    plugins: [contextMenu, toolbar, tooltip]
});

    self.graph = graph;
    graph.get("canvas").set("localRefresh", false);
    var layoutConfig = getForceLayoutConfig(graph, largeGraphMode);
    layoutConfig.center = [CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2];
    layout.instance = new G6.Layout["gForce"](layoutConfig);
    layout.instance.init(self.dimoGraphData);
    if (useLayout) {


    layout.instance.execute();
}




    bindListener(graph);
    

    processAllNodesEdges(nodes,edges,true);


    graph.data({nodes:nodes,edges:edges});
    graph.render();


}


if (typeof window !== "undefined")
  window.onresize = () => {
    if (!graph || graph.get("destroyed")) return;
    const container = document.getElementById("container");
    if (!container) return;
    CANVAS_WIDTH = container.scrollWidth;
    CANVAS_HEIGHT = self.innerHeight
    graph.changeSize(CANVAS_WIDTH, CANVAS_HEIGHT);
  };













