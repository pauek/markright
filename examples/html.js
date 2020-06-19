const mr = require("../markright");

const out = new mr.Printer(process.stdout);
const html = new mr.FuncMap();

html.on("<paragraph>", (paragraph, walk) => {
  paragraph.content.forEach((node) => {
    walk(node);
    out.endl();
  });
});

html.on("<text>", (text) => out.write(text));

html.on("*", ({ name, args, type, content }, walk) => {
  if (type === "inline") {
    out.write(`<${name}${args ? " " + args.join(" ") : ""}>`);
    walk(content);
    out.write(`</${name}>`);
  } else {
    out.writeln(`<${name}${args ? " " + args.join(" ") : ""}>`);
    out.indented(() => walk(content));
    out.write(`</${name}>`);
    if (type === "block") {
      out.endl();
    }
  }
});

html.on("", () => out.write("<br>"));

mr.walk(mr.parseFile("html.mr"), html);
