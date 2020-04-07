const markright = require("../markright");

const root = markright.parseFile("a.mr");
const tableMap = new markright.FuncMap();

tableMap.on("/<markright>", (mr, walk) => mr.content.map(walk));

tableMap.on("table", (cmd, walk) => walk(cmd.content));
tableMap.on("table/<markright>", (mr, walk) => {
  const rows = [];
  // aggregate rows in different paragraphs
  for (let paragraph of mr.content) {
    for (let row of walk(paragraph)) {
      rows.push(row);
    }
  }
  return rows;
});
tableMap.on("table/<markright>/<paragraph>", (paragraph, walk) =>
  paragraph.content.map(walk)
);
tableMap.on("table/<markright>/<paragraph>/<line>", (line, walk) => {
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

tableMap.on("em", (em, walk) => {
  return `*${walk(em.content)}*`;
});

const printTable = (table) => {
  const colSize = (col) => {
    let sz = 0;
    for (let i = 0; i < table.length; i++) {
      sz = Math.max(sz, table[i][col].length);
    }
    return sz;
  };
  const numCols = table[0].length;
  const colSizes = [];
  for (let i = 0; i < numCols; i++) {
    colSizes.push(colSize(i) + 2);
  }

  const showLine = () => {
    process.stdout.write("+");
    for (let i = 0; i < colSizes.length; i++) {
      process.stdout.write("-".repeat(colSizes[i] + 2));
      process.stdout.write("+");
    }
    process.stdout.write("\n");
  };

  const showRow = (row) => {
    process.stdout.write("| ");
    for (let i = 0; i < row.length; i++) {
      const space = " ".repeat(colSizes[i] - row[i].length);
      process.stdout.write(row[i] + space);
      process.stdout.write(" | ");
    }
    process.stdout.write('\n');
  };

  showLine();
  for (let i = 0; i < table.length; i++) {
    showRow(table[i]);
    showLine();
  }
};

for (let table of markright.walk(root, tableMap)) {
  printTable(table);
}
