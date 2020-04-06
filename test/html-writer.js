const mr = require("../markright");
const Writer = require("./writer");

const root = mr.parseFile("html.mr");
const out = new Writer(process.stdout);
const html = new mr.FuncMap();

html.on("<text>", (text) => out.write(text));

html.on("<paragraph>", (paragraph, process) => {
  paragraph.content.forEach((node) => {
    process(node);
    out.endl();
  });
});

const processTag = (cmd, process) => {
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

html.on("*", processTag);

html.on("", () => out.write("<br>"));

mr.process(root, html);
