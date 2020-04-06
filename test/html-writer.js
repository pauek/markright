const { parseFile, createProcessor } = require("../markright");
const Writer = require("./writer");

const mr = parseFile("html.mr");
const out = new Writer(process.stdout);
const html = createProcessor();

html.text(({ content }) => out.write(content));

html.paragraph(({ content }) => {
  for (let _ of content) out.endl();
});

const tag = ({ cmd: { name, args, type }, content }) => {
  if (type === "block") {
    out.writeln(`<${name}${args ? " " + args.join(" ") : ""}>`);
    out.indented(() => content.next());
    out.writeln(`</${name}>`);
  } else {
    out.write(`<${name}${args ? " " + args.join(" ") : ""}>`);
    content.next();
    out.write(`</${name}>`);
  }
};

html.cmd("*", tag);
html.cmd("", () => out.write("<br>"));

html.process(mr);
