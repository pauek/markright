const { parseFile, print } = require("../markright");
const mr = parseFile("test.mr");
// console.dir(mr, { depth: null });
print(mr);
