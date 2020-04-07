const mr = require("../markright");

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

const root = mr.parseFile("html.mr");
const out = new Writer(process.stdout);
const html = new mr.FuncMap();

html.on("<paragraph>", (paragraph, process) => {
  paragraph.content.forEach((node) => {
    process(node);
    out.endl();
  });
});

html.on("<text>", (text) => out.write(text));

const walkTag = (cmd, process) => {
  const { name, args, type } = cmd;
  if (type === "block") {
    out.writeln(`<${name}${args ? " " + args.join(" ") : ""}>`);
    out.indented(() => process(cmd.content));
    out.writeln(`</${name}>`);
  } else {
    out.write(`<${name}${args ? " " + args.join(" ") : ""}>`);
    process(cmd.content);
    out.write(`</${name}>`);
  }
};

html.on("*", walkTag);

html.on("", () => out.write("<br>"));

mr.process(root, html);
