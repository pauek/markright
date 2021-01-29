const markright = require("../markright");

const [_, __, ...testsToRun] = process.argv;

const shouldRun = (name) => testsToRun.length === 0 || testsToRun.indexOf(name) !== -1;
class LineWriter {
  constructor() {
    this.lines = [];
    this.currLine = null;
    this.indentation = 0;
  }
  endl() {
    this.lines.push(this.currLine ? this.currLine : "");
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

const isCommand = (elem, name) =>
  elem instanceof markright.Command && elem.name === name;

const lineArraysDifferent = (A, B) => {
  const maxLen = Math.max(A.length, B.length);
  for (let i = 0; i < maxLen; i++) {
    if (i >= A.length) {
      return true;
    }
    if (i >= B.length) {
      return true;
    }
    if (A[i] !== B[i]) {
      return true;
    }
  }
  return false;
};

const lineArraysComparison = (bad, good) => {
  const maxLen = (lineArray) =>
    lineArray.reduce((m, line) => Math.max(m, line.length), 0);

  const pad = (s, sz, D = "`") =>
    D + s.replace(/ /g, "_") + D + " ".repeat(sz - s.length);

  const szGood = maxLen(good) + 3;
  const szBad = maxLen(bad) + 2;
  const maxLines = Math.max(good.length, bad.length);

  let result = "\n";
  result += "  ";
  result += pad("EXPECTED", szGood + 2, "");
  result += "    ";
  result += pad("OUTPUT", szBad, "");
  result += "\n";
  result +=
    "  " + "-".repeat(szGood - 1) + "       " + "-".repeat(szBad) + "\n";

  for (let i = 0; i < maxLines; i++) {
    const show = (array, sz) =>
      i < array.length ? pad(array[i], sz) : " ".repeat(sz + 2);

    result += "  ";
    result += show(good, szGood);
    result += good[i] != bad[i] ? "<>  " : "    ";
    result += show(bad, szBad);
    result += "\n";
  }
  return result;
};

const printAst = (root) => {
  const out = new LineWriter(process.stdout);
  const astFuncMap = new markright.FuncMap();

  astFuncMap.on(["<markright>", "<paragraph>"], (elem, walk) => {
    out.writeln(elem.constructor.name);
    out.indented(() => {
      elem.content.forEach(walk);
    });
  });

  astFuncMap.on("<break>", () => {
    out.writeln("Break");
  });

  astFuncMap.on("<text>", (text) => out.writeln(`"${text}"`));

  const cmdType = new Map([
    [markright.Command.BLOCK, "Block"],
    [markright.Command.INLINE, "Inline"],
    [markright.Command.INPARAGRAPH, "Inparagraph"],
  ]);

  astFuncMap.on("*", (cmd, walk) => {
    out.write(`${cmdType.get(cmd.type)}Cmd(${cmd.name}`);
    if (cmd.args) {
      out.write(`, [${cmd.args.map((a) => `"${a}"`).join(", ")}]`);
    }
    out.writeln(")");
    if (cmd.isRaw()) {
      out.indented(() => {
        splitLines(cmd.content).forEach((line) => out.writeln(`"${line}"`));
      });
    } else {
      if (cmd.content) {
        out.indented(() => cmd.content.forEach(walk));
      }
    }
  });

  markright.walk(root, astFuncMap);
  return out.lines;
};

// Tests

const errors = [];

const checkTitleArgument = (cmd) => {
  if (!Array.isArray(cmd.args) || cmd.args.length !== 1) {
    throw new Error(
      `@${cmd.name} should have a single argument (the title of the test)`
    );
  }
  return cmd.args[0];
};

const splitLines = (str) => {
  if (str[str.length - 1] === "\n") {
    str = str.substring(0, str.length - 1);
  }
  return str.split("\n");
};

const parseTest = (input, expected) => {
  try {
    const mr = markright.parse(input);
    const output = printAst(mr);
    const expectedLines = splitLines(expected);
    return (
      lineArraysDifferent(output, expectedLines) &&
      lineArraysComparison(output, expectedLines)
    );
  } catch (e) {
    console.error(e);
    return `  ${e}\n`;
  }
};

const errorMessageTest = (input, expected) => {
  try {
    markright.parse(input);
    return `  Should have given an error\n`;
  } catch (e) {
    const err = e.toString().trim();
    const exp = expected.trim();
    if (err !== exp) {
      return `  Actual:   "${err}"\n  Expected: "${exp}"\n`;
    }
  }
};

const addResult = (name, fn) => {
  const errorMessage = fn();
  if (errorMessage) {
    process.stdout.write("x");
    errors.push({ name, msg: errorMessage });
  } else {
    process.stdout.write(".");
  }
};

const showErrors = () => {
  errors.forEach((e) => {
    process.stderr.write(`\nFailed test "${e.name}":\n`);
    process.stderr.write(e.msg);
  });
};

const getInputAndExpected = (mr) => {
  let input, expected;
  for (let elem of mr) {
    if (isCommand(elem, "input*")) {
      input = elem.content;
    } else if (isCommand(elem, "expected*")) {
      expected = elem.content;
    } else {
      throw new Error(
        `A test should only have @input* and @expected* subcommands`
      );
    }
  }
  return { input, expected };
};

const testFuncMap = new markright.FuncMap();

testFuncMap.on("/<markright>", (mr, walk) => {
  mr.content.forEach(walk);
  process.stdout.write("\n");
});

testFuncMap.on("print-test*", (cmd) => {
  const title = checkTitleArgument(cmd);
  if (shouldRun(title)) {
    const expected = cmd.content;
    const expectedLines = splitLines(expected);
    const mr = markright.parse(expected);
    const lineWriter = new LineWriter();
    markright.print(mr, lineWriter);
    addResult(
      title,
      () =>
        lineArraysDifferent(lineWriter.lines, expectedLines) &&
        lineArraysComparison(lineWriter.lines, expectedLines)
    );
  }
});

testFuncMap.on("parse-test", (cmd) => {
  const title = checkTitleArgument(cmd);
  if (shouldRun(title)) {
    let { input, expected } = getInputAndExpected(cmd.content);
    addResult(title, () => parseTest(input, expected));
  }
});

testFuncMap.on("error-message-test", (cmd) => {
  const title = checkTitleArgument(cmd);
  if (shouldRun(title)) {
    let { input, expected } = getInputAndExpected(cmd.content);
    addResult(title, () => errorMessageTest(input, expected));
  }
});

testFuncMap.on("disabled", () => {});

const tests = markright.parseFile("./test/tests.mr");
markright.walk(tests, testFuncMap);
showErrors();
