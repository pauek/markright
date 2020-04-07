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
  const maxLen = Math.max(A.length, B.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= A.length) {
      return `<nothing> !== "${B[i]}"`;
    }
    if (i >= B.length) {
      return `<nothing> !== "${B[i]}"`;
    }
    if (A[i] !== B[i]) {
      return `  Mismatch at line ${i}:\n    "${A[i]}"\n    "${B[i]}"\n`;
    }
  }
  return null; // -> means "no error"
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

const errors = [];

testFuncMap.on("test", (cmd) => {
  let input, output;
  if (!Array.isArray(cmd.args) || cmd.args.length !== 1) {
    throw new Error(`@text should have a single argument (the name of the test)`);
  }
  const { args: [name], content: mr } = cmd;
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

  const errorMessage = performTest(input, output);
  if (errorMessage) {
    process.stdout.write("x");
    errors.push({ name, msg: errorMessage });
  } else {
    process.stdout.write(".");
  }
});

const tests = markright.parseFile("tests.mr");
markright.walk(tests, testFuncMap);
process.stdout.write("\n");

errors.forEach((e) => {
  process.stderr.write(`\nFailed test "${e.name}":\n`);
  process.stderr.write(e.msg);
});
