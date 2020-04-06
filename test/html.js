const { parseFile, createProcessor } = require("../markright");
const mr = parseFile("html.mr");

const html = createProcessor();

html.line(({ content }) => [...content].join(""));
html.markright(({ content }) => [].concat(...[...content]));

const tag = ({ cmd: { name, args }, content }) => {
  const children = content.next().value;
  return [
    `<${name}${args ? " " + args.join(" ") : ""}>`,
    ...children.map((line) => "  " + line),
    `</${name}>`,
  ];
};

const inlineTag = ({ cmd: { name, args }, content }) =>
  `<${name}${args ? " " + args.join(" ") : ""}>${[...content]}</${name}>`;

html.cmd("*", tag);
html.cmdList(["em", "li", "h1", "strong"], inlineTag);
html.cmd("", () => "<br>");

const lines = html.process(mr);
lines.forEach((line) => process.stdout.write(line + "\n"));
