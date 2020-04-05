const { parseFile, print, createProcessor } = require("../markright");
const mr = parseFile("html.mr");
// print(mr);
// console.dir(mr, { depth: null });

class Writer {
  constructor(wstream) {
    this.wstream = wstream;
    this.indentation = 0;
    this.lineStart = true;
  }
  endl() {
    this.wstream.write("\n");
    this.lineStart = true;
  }
  indented(fn) {
    this.indentation += 2;
    fn();
    this.indentation -= 2;
  }
  indent(n) {
    this.indentation += n;
  }
  write(x) {
    if (this.lineStart) {
      this.lineStart = false;
      this.wstream.write(" ".repeat(this.indentation));
    }
    this.wstream.write(x);
  }
  writeln(x) {
    this.write(x);
    this.endl();
  }
}

const html = createProcessor();

html.line(({ content }) => content().join(""));
html.markright(({ content }) => [].concat(...content()));

const tag = ({ cmd: { name, args }, content }) => {
  let c = content();
  if (!Array.isArray(c)) c = [c];
  return [
    `<${name}${args ? " " + args.join(" ") : ""}>`,
    ...c.map((line) => "  " + line),
    `</${name}>`,
  ];
};

const inlineTag = ({ cmd: { name, args }, content }) =>
  `<${name}${args ? " " + args.join(" ") : ""}>${content()}</${name}>`;

html.cmd("*", tag);
html.cmdList(["em", "li", "h1"], inlineTag);
html.cmd("", () => "<br>");

const lines = html.process(mr);
lines.forEach((line) => process.stdout.write(line + "\n"));
