var fs = require('fs'),
    path = require('path'),
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

if(!md){
  console.log('require a markdown parser, e.g. discount, github-flavored-markdown')
}

exports.run = function(args){

  var filename = args[0];
  var text = fs.readFileSync(filename, 'utf-8');
  var title = getTitle(text);
  var body = slidefy(text);
  var output = makeStaticHtml(title, body);
  var outfile = args[1] || filename.replace(/\.[^\.]*$/, '.pdf');
  if(outfile == args[0]) {
    console.log('output file should not same as input');
    process.exit(1);
  }

  var proc = spawn('wkhtmltopdf', ['--page-width', '320', '--page-height', '240', '-', outfile]);
  proc.stdin.write(output)
  proc.stdin.end();

}

function makeStaticHtml(title, body, css) {
  css = path.resolve(css || 'style.css');
  css = path.existsSync(css) ? css : (__dirname + '/style.css');
  return '<!DOCTYPE HTML>' +
  '<html>' +
  '<head>' +
  '        <meta charset="utf-8">' +
  '        <title>' + title + '</title>' +
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
    if (m = /^\+\+(\.\S+)? /.exec(line)) {
      var cls = pages.length > 0 ? 'page' : 'first page';
      if (m[1]) {
        cls += m[1].replace(/\./g, ' ');
      }
      pages.push(curr_page);
      curr_page = curr_page.slice();
      curr_pages.push(curr_page);
      line = line.substring(3);
    }

    if (m = /^\-\- (.*)$/.test(line)){
      line = line.substring(3);
      for(var j = 0; j < curr_pages.length; j++) {
        curr_pages[j].push(line);
      }
    } else {
      curr_page.push(line);
    }
  }

  pages.push(curr_page);

  var ret = '';
  for(var i=0;i<pages.length;i++){
    var clz = 'page';
    if(i == 0){
      clz = 'page first';
    }
    if(i == pages.length - 1){
      clz = 'page last';
    }
    ret += makePage(pages[i], clz);
  }
  return ret;
}

function makePage(lines, clazz) {
  return '\n<div class="' + clazz + '">\n' + md(lines.join('\n')) + '\n</div>\n';
}

