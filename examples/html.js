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
    content.forEach(walk);
    out.write(`</${name}>`);
  } else {
    out.writeln(`<${name}${args ? " " + args.join(" ") : ""}>`);
    out.indented(() => content.forEach(walk));
    out.write(`</${name}>`);
    if (type === "block") {
      out.endl();
    }
  }
});

html.on("", () => out.write("<br>"));

try {
  mr.walk(mr.parseFile("html.mr"), html);
} catch (e) {
  console.log(e.toString());
}
