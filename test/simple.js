// Testing if print outputs the same file
const { parseFile, print } = require("../markright");
const mr = parseFile("simple.mr");
print(mr);
