const markright = require("../markright");

const root = markright.parseFile("a.mr");
const map = new markright.FuncMap();

map.on("/<markright>", (mr, walk) => mr.content.map(walk));

map.on("table", (cmd, walk) => walk(cmd.content));
map.on("table/<markright>", (mr, walk) => {
  const rows = [];
  // aggregate rows in different paragraphs
  for (let paragraph of mr.content) {
    for (let row of walk(paragraph)) {
      rows.push(row);
    }
  }
  return rows;
});
map.on("table/<markright>/<paragraph>", (paragraph, walk) =>
  paragraph.content.map(walk)
);
map.on("table/<markright>/<paragraph>/<line>", (line, walk) => {
  let currCell = [];
  const cells = [];
  for (let item of line.content) {
    if (item instanceof markright.Command && item.name === "") {
      // Separator
      cells.push(currCell.join(""));
      currCell = [];
    } else {
      currCell.push(walk(item));
    }
  }
  cells.push(currCell.join(""));
  return cells;
});

map.on("em", (em, walk) => {
  return `*${walk(em.content)}*`;
});

console.log(markright.walk(root, map));
