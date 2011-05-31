var fs = require('fs'),
    path = require('path'),
    sys = require('sys'),
    hl = require('highlight').Highlight,
    spawn = require('child_process').spawn;

var md;
try {
  var robotskirt = require('//robotskirt');
  md = function(s) {
    ret = robotskirt.toHtmlSync(s.toString());
    console.log(s);
    console.log(ret);
    return ret;
  };
} catch (e) {
  try {
    md = require('discount').parse;
  } catch (e) {
    md = require('github-flavored-markdown').parse;
  }
}

if (!md) {
  console.log('require a markdown parser, e.g. discount, github-flavored-markdown');
}

exports.run = function(args) {

  var options = {};

  var arg;
  while (arg = args.shift()) {
    switch (arg) {
    case '--html':
      options.html = true;
      break;
    default:
      if (! options.input_filename) {
        options.input_filename = arg;
      } else {
        options.output_filename = arg;
      }
    }
  }

  var text = fs.readFileSync(options.input_filename, 'utf-8');
  var title = getTitle(text);
  var body = slidefy(text);
  var html = makeStaticHtml(title, body);
  var outfile = options.output_filename || options.input_filename.replace(/\.[^\.]*$/, '.pdf');
  if (outfile == args[0]) {
    outfile = outfile + '.pdf';
  }

  var htmlfile = options.input_filename.replace(/\.[^\.]*$/, '.html');
  fs.writeFileSync(htmlfile, html, 'utf-8');

  var proc = spawn('wkhtmltopdf', ['-L', '0', '-R', '0', '-T', '2', '-B', '2', '--page-width', '240', '--page-height', '180', htmlfile, outfile]);
  // proc.stdin.write(html);
  // proc.stdin.end();
  proc.stderr.on('data', function(data) {
      process.stderr.write(data);
  });

  proc.stdout.on('data', function(data) {
      process.stdout.write(data);
  });

};

function makeStaticHtml(title, body, css) {
  css = path.resolve(css || 'style.css');
  css = path.existsSync(css) ? css : (__dirname + '/style.css');
  return '<!DOCTYPE HTML>' +
  '<html>' +
  '<head>' +
  '        <meta charset="utf-8">' +
  '        <title>' + title + '</title>' +
  '        <link rel=stylesheet type="text/css" href="' + __dirname + '/sunburst.css">' +
  '        <link rel=stylesheet type="text/css" href="' + css + '">' +
  '</head>' +
  '<body>' +
  body +
  '</body>' +
  '</html>';
}

function getTitle(text) {
  return text.split('\n', 1)[0].replace(/^#*\s*/, '');
}

function slidefy(text) {
  text = text.replace(/\r\n/g, '\n');
  var lines = text.split('\n');
  var pages = [];
  var curr_page = [];
  var curr_pages = [curr_page];

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];

    if (curr_page.length > 0 && (/^##? /.test(line) || /^(-+|=+)$/.test(lines[i + 1]))) {
      pages.push(curr_page);
      curr_page = [];
      curr_pages = [curr_page];
    }

    var m;
    if (m = /^\+\+(\.\S+)?\s(.*)/.exec(line)) {
      var cls = pages.length > 0 ? 'page' : 'first page';
      if (m[1]) {
        cls += m[1].replace(/\./g, ' ');
      }
      pages.push(curr_page);
      curr_page = curr_page.slice();
      curr_pages.push(curr_page);
      line = m[2];
    }

    if (m = /^\-\- (.*)$/.exec(line)) {
      line = m[1];
      for (var j = 0; j < curr_pages.length; j++) {
        curr_pages[j].push(line);
      }
    } else {
      curr_page.push(line);
    }
  }

  pages.push(curr_page);

  var ret = '';
  for (var i = 0; i < pages.length; i++) {
    var clz = 'page';
    if (i == 0) {
      clz = 'page first';
    }
    if (i == pages.length - 1) {
      clz = 'page last';
    }
    ret += makePage(pages[i], clz);
  }
  return ret;
}

function makePage(lines, clazz) {
  return '\n<div class="' + clazz + '">\n' + highlight_code(md(lines.join('\n')), false, true) + '\n</div>\n';
}

function highlight_code(html) {
  return html.replace(/\n/g, '\uffff').replace(/<code>(.*?)<\/code>/gm, function(original, source) {
      return '<code>' + hl(decodeXml(source.replace(/\uffff/g, '\n'))) + '</code>';
  }).replace(/&amp;(\w+;)/g, '&$1').replace(/\uffff/g, '\n');
}

var xml_special_to_escaped_one_map = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;'
};

var escaped_one_to_xml_special_map = {
  '&amp;': '&',
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>'
};

function encodeXml(string) {
  return string.replace(/([\&"<>])/g, function(str, item) {
      return xml_special_to_escaped_one_map[item];
  });
}

function decodeXml(string) {
  return string.replace(/(&quot;|&lt;|&gt;|&amp;)/g,
    function(str, item) {
      return escaped_one_to_xml_special_map[item];
  });
}
