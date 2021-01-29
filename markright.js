const fs = require("fs");

const COMMAND_CHAR = "@";

// These are matching tables...
const OPEN_DELIMS = "[{<";
const CLOSE_DELIMS = "]}>";
const getCloseDelim = (c) => CLOSE_DELIMS[OPEN_DELIMS.indexOf(c)];

// Regular Expressions
const rCommandChar = /[*a-zA-Z0-9_-]/;

// Types
class Markright {
  constructor(blocks) {
    this.content = blocks;
  }
}

class Paragraph {
  constructor(items) {
    this.content = items;
  }
}

class Break {}

class Command {
  constructor(name, args) {
    this.name = name;
    if (args) this.args = args;
  }
  isRaw() {
    return this.name[this.name.length - 1] === "*";
  }
  get openDelim() {
    const { open, length } = this.delims;
    return open.repeat(length);
  }
  get closeDelim() {
    const { close, length } = this.delims;
    return close.repeat(length);
  }
}
Command.BLOCK = "block";
Command.INLINE = "inline";

// Parser

class ParseError extends Error {
  constructor(lin, col, message) {
    super(message);
    this.name = "ParseError";
    this.lin = lin;
    this.col = col;
  }
  toString() {
    return `${this.lin}:${this.col}: ${this.name}: ${this.message}`;
  }
}

const parse = (input) => {
  let baseIndent = 0;
  let i = 0;
  let lin = 1;
  let col = 1;

  const error = (msg, _lin, _col) => {
    throw new ParseError(_lin || lin, _col || col, msg);
  };

  const atEnd = () => i >= input.length;

  const advance = (n) => {
    for (let k = 0; k < n; k++) {
      if (!atEnd()) {
        if (input[i] === "\n") {
          i++;
          lin++;
          col = 1;
        } else {
          i++;
          col++;
        }
      }
    }
    // "@cmd1\n    @inline1 a b c\n  and more text\n"
  };

  const nextLine = () => {
    const endlPos = input.indexOf("\n", i);
    if (endlPos === -1) {
      const jump = input.length - i;
      advance(jump);
    } else {
      i = endlPos + 1;
      lin++;
      col = 1;
    }
  };

  const indentLength = () => {
    if (atEnd()) {
      return 0;
    }
    let k = 0;
    while (input[i + k] === " ") {
      k++;
      if (i + k >= input.length) break;
    }
    return k;
  };

  const skipIndent = () => {
    advance(indentLength());
  };

  const getDelimiters = () => {
    const open = input[i];
    if (OPEN_DELIMS.indexOf(open) === -1) {
      return null;
    }
    let length = 1;
    while (i + length < input.length && input[i + length] === open) {
      length++;
    }
    return { open, close: getCloseDelim(open), length };
  };

  const atEmptyLine = () => {
    let k = i;
    while (k < input.length && input[k] === " ") {
      k++;
    }
    return k === input.length || input[k] === "\n";
  };

  const at = (str) => {
    const remaining = input.length - i;
    if (str.length > remaining) {
      return false;
    }
    for (let k = 0; k < str.length; k++) {
      if (input[i + k] !== str[k]) return false;
    }
    return true;
  };

  const atCommand = () => input[i] === COMMAND_CHAR;

  const collectRawLines = () => {
    let lines = "";
    while (true) {
      if (atEnd()) {
        break;
      }
      if (atEmptyLine()) {
        // Careful with empty lines with lower indent than baseIndent
        nextLine();
        lines += "\n";
        continue;
      }
      if (indentLength() >= baseIndent) {
        let start = i + baseIndent;
        nextLine();
        lines += input.substring(start, i);
        continue;
      }
      break;
    }
    return lines;
  };

  const collectRawText = (closeDelim) => {
    let text = "";
    while (true) {
      if (atEnd()) {
        break;
      }
      if (at(closeDelim)) {
        advance(1);
        break;
      }
      text += input[i];
      advance(1);
    }
    return text;
  };

  const parseCommandHeader = () => {
    // Command char
    if (input[i] !== COMMAND_CHAR) {
      error(`Assertion failed: expected ${COMMAND_CHAR}`);
    }
    advance(1);

    // Command name
    let name = "";
    while (rCommandChar.test(input[i])) {
      name += input[i];
      advance(1);
    }

    // Arguments
    if (input[i] !== "(") {
      // No arguments
      return new Command(name);
    }

    advance(1); // skip "("
    let start = i;
    while (input[i] !== ")") {
      advance(1);
      // TODO: Detect ")" below baseIndent
      if (atEnd()) {
        error(`Found end of text while looking for ')'`);
      }
    }
    const args = input
      .substring(start, i)
      .split(",")
      .map((s) => s.trim());

    advance(1);
    return new Command(name, args);
  };

  const parseParagraphContent = (startCmd, closeDelim) => {
    let items = [];
    if (startCmd) {
      // There could be content after the command header
      parseInlineCommandContent(startCmd);
      items = [startCmd];
    }

    let text = "";
    const addText = () => {
      if (text) {
        items.push(text);
        text = "";
      }
    };
    const append = (x) => {
      addText();
      items.push(x);
    };

    let lineStart = startCmd != null;
    while (!atEnd()) {
      if (input[i] === "\n") {
        append(new Break());
        advance(1);
        if (atEmptyLine()) {
          if (closeDelim) {
            error(`Found newline while looking for ${closeDelim}`);
          }
          nextLine();
          break;
        }
        if (indentLength() < baseIndent) {
          if (closeDelim) {
            error(`Expected to find '${closeDelim}' before indentation break`);
          }
          break;
        }
        skipIndent();
        lineStart = true;
        continue;
      }
      if (closeDelim && at(closeDelim)) {
        addText();
        advance(closeDelim.length);
        break;
      }
      if (atCommand()) {
        const startPos = { lin, col };
        const cmd = parseCommandHeader();
        if (atEmptyLine()) {
          if (lineStart) {
            error(`Block command inside paragraph`, startPos.lin, startPos.col);
          }
        }
        parseInlineCommandContent(cmd);
        append(cmd);
        lineStart = false;
        continue;
      }
      // Accumulate text
      text += input[i];
      lineStart = false;
      advance(1);
    }

    // Remove a Break at the end
    const len = items.length;
    const last = items[len - 1];
    if (last instanceof Break) {
      items.splice(len - 1, 1);
    }

    return items;
  };

  const parseInlineCommandContent = (cmd) => {
    cmd.type = Command.INLINE;
    const delims = getDelimiters();
    if (delims) {
      cmd.delims = delims;
      advance(delims.length);
      if (cmd.isRaw()) {
        cmd.content = collectRawText(cmd.closeDelim);
      } else {
        cmd.content = parseParagraphContent(null, cmd.closeDelim);
      }
    }
  };

  const parseBlockCommand = (cmd) => {
    cmd.type = Command.BLOCK;
    baseIndent += 2;
    if (cmd.isRaw()) {
      cmd.content = collectRawLines();
    } else {
      cmd.content = _parse();
    }
    baseIndent -= 2;
    return cmd;
  };

  const _parse = () => {
    const blocks = [];
    while (!atEnd()) {
      if (atEmptyLine()) {
        nextLine();
        continue;
      }
      if (indentLength() < baseIndent) {
        // Check after empty line because the empty line might not have indentation
        break;
      }
      if (indentLength() > baseIndent) {
        skipIndent();
        error(`Wrong indentation`);
      }
      skipIndent();
      /* ???
      if (input[i] === " ") {
        error(`wrong indentation`);
      } */

      let newBlock;
      if (atCommand()) {
        // Either: a) block command or b) paragraph starting with an inline command.
        const cmd = parseCommandHeader();
        if (atEmptyLine()) {
          nextLine();
          newBlock = parseBlockCommand(cmd);
        } else {
          const content = parseParagraphContent(cmd);
          newBlock = new Paragraph(content);
        }
      } else {
        skipIndent();
        const content = parseParagraphContent();
        newBlock = new Paragraph(content);
      }
      blocks.push(newBlock);
    }
    return blocks.length > 0 ? blocks : null;
  };

  return new Markright(_parse());
};

const parseFile = (filename) => {
  const text = fs.readFileSync(filename).toString();
  return parse(text);
};

// Walker

const rInternal = /^<.*>$/;
const isInternal = (pathElem) => rInternal.test(pathElem);

const parsePath = (str) => str.split("/");

const pathMatch = (modelPath, path) => {
  const _elemMatch = (modelElem, elem) => {
    return (
      (modelElem === "*" && !isInternal(elem)) ||
      (modelElem === "<*>" && isInternal(elem)) ||
      modelElem === elem
    );
  };
  for (let i = 0; i < modelPath.length; i++) {
    const j = path.length - 1 - i;
    const mj = modelPath.length - 1 - i;
    if (j < 0) {
      return false; // path is not long enough
    }
    if (!_elemMatch(modelPath[mj], path[j])) {
      return false;
    }
  }
  return true;
};

class FuncMap {
  constructor() {
    this.table = [];
  }
  on(pathStr, func) {
    if (Array.isArray(pathStr)) {
      pathStr.forEach((pstr) => {
        this.table.push({ path: parsePath(pstr), func });
      });
    } else {
      this.table.push({ path: parsePath(pathStr), func });
    }
  }
  get(path) {
    for (let i = this.table.length - 1; i >= 0; i--) {
      const { path: modelPath, func } = this.table[i];
      if (pathMatch(modelPath, path)) {
        return func;
      }
    }
    return null;
  }
}

class ResolveError extends Error {
  constructor(path, ...params) {
    super(...params);
    this.name = "ResolveError";
    this.path = path;
  }
  get message() {
    return `Cannot resolve "${this.path.join("/")}"`;
  }
}

const walk = (root, funcMap) => {
  const currPath = [""];

  const _containerDefault = (mr) => mr.content.map(_walk);
  const _elemDefault = (mr) => mr;

  const _walkElem = (mr, name, defaultFunc) => {
    currPath.push(name);
    const processFunc = funcMap.get(currPath) || defaultFunc;
    const result = processFunc(mr, _walk, currPath);
    currPath.pop();
    return result;
  };

  const _walk = (mr) => {
    if (mr === null || mr === undefined) {
      return;
    }
    switch (mr.constructor) {
      case Markright:
        return _walkElem(mr, "<markright>", _containerDefault);
      case Paragraph:
        return _walkElem(mr, "<paragraph>", _containerDefault);
      case Break:
        return _walkElem(mr, "<break>", _elemDefault);
      case String:
        return _walkElem(mr, "<text>", _elemDefault);
      case Command: {
        currPath.push(mr.name);
        const walkFunc = funcMap.get(currPath);
        if (walkFunc == null) {
          throw new ResolveError(currPath);
        }
        const result = walkFunc(mr, _walk, currPath);
        currPath.pop();
        return result;
      }
      default:
        throw new Error(`Unexpected ${mr.constructor.name} (${mr})`);
    }
  };

  return _walk(root);
};

// Printer

class Printer {
  constructor(wstream = process.stdout) {
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
  withIndent(n, fn) {
    const lastIndent = this.indentation;
    this.indentation = n;
    fn();
    this.indentation = lastIndent;
  }
  write(x) {
    if (this.lineStart) {
      this.wstream.write(" ".repeat(this.indentation));
      this.lineStart = false;
    }
    this.wstream.write(x);
  }
  writeln(x) {
    this.write(x);
    this.endl();
  }
}

const print = (markright, out = new Printer()) => {
  const printer = new FuncMap();

  printer.on("<markright>", (M, walk) => {
    for (let i = 0; i < M.content.length; i++) {
      if (i > 0) out.endl();
      walk(M.content[i]);
    }
  });

  printer.on("<paragraph>", (P, walk) => {
    for (let i = 0; i < P.content.length; i++) {
      walk(P.content[i]);
    }
    out.endl();
  });

  printer.on("<break>", () => out.endl());

  printer.on("<text>", (text) => out.write(text));

  printer.on("*", (cmd, walk) => {
    out.write(`@${cmd.name}`);
    if (cmd.args) {
      out.write(`(${cmd.args.join(",")})`);
    }
    switch (cmd.type) {
      case Command.INLINE: {
        if (cmd.content) {
          out.write(`${cmd.openDelim}`);
          cmd.content.forEach(walk);
          out.write(`${cmd.closeDelim}`);
        }
        break;
      }
      case Command.BLOCK: {
        out.endl();
        out.indented(() => {
          if (cmd.content) {
            for (let i = 0; i < cmd.content.length; i++) {
              if (i > 0) out.endl();
              walk(cmd.content[i]);
            }
          }
        });
        break;
      }
    }
  });

  walk(markright, printer);
};

module.exports = {
  Markright,
  Paragraph,
  Command,
  Break,

  parse,
  parseFile,

  FuncMap,
  walk,

  print,
  Printer,
};
