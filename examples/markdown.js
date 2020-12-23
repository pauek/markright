const mr = require("../markright");
const { Command } = require("../markright");

const markdown = new mr.FuncMap();
const out = new mr.Printer();

markdown.on("<paragraph>", (paragraph, walk) => {
  paragraph.content.forEach((line) => {
    walk(line);
    out.endl();
  });
  out.endl();
});
markdown.on("<text>", (text) => out.write(text));

markdown.on(["h1", "h2", "h3", "h4", "h5", "h6"], (cmd, walk) => {
  const level = Number(cmd.name.slice(1));
  out.write("#".repeat(level) + " ");
  walk(cmd.content);
});

markdown.on("em", (cmd, walk) => {
  out.write("*"), walk(cmd.content), out.write("*");
});
markdown.on("em/<line>/em", (cmd, walk) => {
  out.write("_"), walk(cmd.content), out.write("_");
});
markdown.on("strong", (cmd, walk) => {
  out.write("**"), walk(cmd.content), out.write("**");
});
markdown.on("strong/<line>/strong", (cmd, walk) => {
  out.write("__"), walk(cmd.content), out.write("__");
});
markdown.on("strike", (cmd, walk) => {
  out.write("~~"), walk(cmd.content), out.write("~~");
});

markdown.on("ul", (cmd, walk) => {
  walk(cmd.content);
});
markdown.on("ul/<markright>", (cmd, walk) => {
  let index = 1;
  for (let item of cmd.content) {
    out.write(index + ". ");
    walk(item);
    index++;
  }
});

markdown.on("li", (cmd, walk) => {
  walk(cmd.content);
});

markdown.on("href", (cmd, walk) => {
  out.write("["), walk(cmd.content), out.write("]");
  out.write(`(${cmd.args[0]})`);
});

markdown.on("code*", (cmd) => {
  if (cmd.type === "block") {
    out.write("```" + (cmd.args[0] ? cmd.args[0] : ""));
    out.write(cmd.content);
    out.write("```");
  } else {
    out.write("`"), out.write(cmd.content), out.write("`");
  }
});

mr.walk(mr.parseFile("markdown.mr"), markdown);
