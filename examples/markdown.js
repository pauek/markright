const mr = require("../markright");
const markdown = new mr.FuncMap();
const out = new mr.Printer();

markdown.on("<markright>", (M, walk) => {
  for (let i = 0; i < M.content.length; i++) {
    if (i > 0) out.endl();
    walk(M.content[i]);
  }
});

markdown.on("<paragraph>", (paragraph, walk) => {
  paragraph.content.forEach(walk);
  out.endl();
});

markdown.on("<break>", () => out.endl());

markdown.on("<text>", (text) => out.write(text));

markdown.on(["h1", "h2", "h3", "h4", "h5", "h6"], (cmd, walk) => {
  const level = Number(cmd.name.slice(1));
  out.write("#".repeat(level) + " ");
  cmd.content.forEach(walk);
});

markdown.on("em", (cmd, walk) => {
  out.write("*"), cmd.content.forEach(walk), out.write("*");
});
markdown.on("em/em", (cmd, walk) => {
  out.write("_"), cmd.content.forEach(walk), out.write("_");
});
markdown.on("strong", (cmd, walk) => {
  out.write("**"), cmd.content.forEach(walk), out.write("**");
});
markdown.on("strong/strong", (cmd, walk) => {
  out.write("__"), cmd.content.forEach(walk), out.write("__");
});
markdown.on("strike", (cmd, walk) => {
  out.write("~~"), cmd.content.forEach(walk), out.write("~~");
});

markdown.on("ul", (cmd, walk) => {
  for (let i = 0; i < cmd.content.length; i++) {
    const number = `${i + 1}. `
    out.write(number);
    out.withIndent(number.length, () => {
      walk(cmd.content[i]);
    });
    out.endl();
  }
});

markdown.on("li", (cmd, walk) => {
  cmd.content.forEach(walk);
});

markdown.on("href", (cmd, walk) => {
  out.write("["), cmd.content.forEach(walk), out.write("]");
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
