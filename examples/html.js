const { parseFile, walk, FuncMap, Printer } = require("../markright");

const mr = parseFile("html.mr");
const html = new FuncMap();
const out = new Printer();

html.on("<text>", (text) => out.write(text));

html.on("<paragraph>", (paragraph, walk) => {
  paragraph.content.forEach((elem) => {
    walk(elem);
    out.endl();
  });
});

html.on("*", (cmd, walk) => {
  if (cmd.name === "") {
    out.write(`<br>`);
    return;
  }
  out.write(`<${cmd.name}`);
  out.write(cmd.args ? " " + cmd.args.join(" ") : "");
  out.write(">");
  if (cmd.isInline()) {
    walk(cmd.content);
  } else {
    out.endl();
    out.indented(() => {
      if (cmd.isRaw()) {
        cmd.content.forEach((item) => out.writeln(item));
      } else {
        walk(cmd.content);
      }
    });
  }
  out.write(`</${cmd.name}>`);
  if (cmd.isBlock()) {
    out.endl();
  }
});

walk(mr, html);
