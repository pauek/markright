const markright = require("../markright");

class LineWriter {
  constructor() {
    this.lines = [];
    this.currLine = null;
    this.indentation = 0;
  }
  endl() {
    this.lines.push(this.currLine);
    this.currLine = null;
  }
  indented(fn) {
    this.indentation += 2;
    fn();
    this.indentation -= 2;
  }
  write(x) {
    if (this.currLine == null) {
      this.currLine = " ".repeat(this.indentation);
    }
    this.currLine += x;
  }
  writeln(x) {
    this.write(x);
    this.endl();
  }
}

const equalStringArrays = (A, B) => {
  if (A.length !== B.length) {
    return false;
  }
  for (let i = 0; i < A.length; i++) {
    if (A[i] !== B[i]) return false;
  }
  return true;
};

const printAst = (root) => {
  const out = new LineWriter(process.stdout);
  const astFuncMap = new markright.FuncMap();

  astFuncMap.on(["<markright>", "<paragraph>", "<line>"], (elem, walk) => {
    out.writeln(elem.constructor.name);
    out.indented(() => {
      elem.content.forEach(walk);
    });
  });

  astFuncMap.on("<text>", (text) => out.writeln(`"${text}"`));

  astFuncMap.on("*", (cmd, walk) => {
    out.write(`Cmd(${cmd.name}`);
    if (cmd.args) {
      out.write(`, [${cmd.args.map((a) => `"${a}"`).join(", ")}]`);
    }
    out.writeln(")");
    if (cmd.content) {
      out.indented(() => walk(cmd.content));
    }
  });

  markright.walk(root, astFuncMap);
  return out.lines;
};

const performTest = (input, modelOutput) => {
  const mr = markright.parse(input);
  const output = printAst(mr);
  return equalStringArrays(output, modelOutput);
};

const testFuncMap = new markright.FuncMap();

const isCommand = (elem, name) =>
  elem instanceof markright.Command && elem.name === name;

testFuncMap.on("test", (cmd) => {
  let input, output;
  const mr = cmd.content;
  for (let elem of mr.content) {
    if (isCommand(elem, "input*")) {
      input = elem.content;
    } else if (isCommand(elem, "output*")) {
      output = elem.content;
    } else {
      throw new Error(
        `A test should only have two @input* and @output* commands`
      );
    }
  }
  if (performTest(input, output)) {
    process.stdout.write(".");
  } else {
    console.error("error!");
  }
});

const tests = markright.parseFile("tests.mr");
markright.walk(tests, testFuncMap);
process.stdout.write('\n');
