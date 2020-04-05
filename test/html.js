const { parseFile, createProcessor } = require("../markright");
const mr = parseFile("html.mr");
const H = createProcessor();

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

const out = new Writer(process.stdout);

H.cmd("<line>", ({ content }) => {
  content();
  out.endl();
});

H.cmd("<text>", ({ content }) => {
  out.write(content());
})

const tag = (cmd) => ({ content, args, type }) => {
  out.writeln(`<${cmd}${args ? " " + args.join(" ") : ""}>`);
  out.indented(content);
  out.writeln(`</${cmd}>`);
};

H.cmd('*', tag);

H.cmd("em", ({ content, type }) => {
  out.write(`<em ${type}>`);
  content();
  out.write(`</em>`);
})

H.process(mr);