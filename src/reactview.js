#!/usr/bin/env node

'use strict'

var concat = require('concat-stream');
var http = require('http')
var url = require('url')
var fs = require('fs')
var tty = require('tty');
var open = require("open");

var webpack = require('webpack')
var React = require('react')

require('babel/polyfill')

function getPropsFromStdin (cb) {
  if (tty.isatty(process.stdin)) return cb(null, {})

  process.stdin.pipe(concat(raw => {
    try {
      cb(null, JSON.parse(raw))
    }
    catch (e) {
      cb(e)
    }
  }))
}

class ReactView{

  constructor(props={}){
    var componentPath = process.cwd()
    var componentName = process.argv[2]
    var fullPath = `${componentPath}/${componentName}`
    this.port = 1337
    //if the 3rd argument isn't a number, it is the component class name
    if(isNaN(process.argv[3]) && process.argv[3]){
      var component = process.argv[3]
      //if they also passed a port
      if(process.argv[4]) this.port = process.argv[4]
    }
    //if the 3rd argument is a number, it's the port
    else if(!isNaN(process.argv[3])) this.port = process.argv[3]

    this.fullPath = fullPath
    this.bundle = `${__dirname}/component/bundle.js`

    this.compiler = webpack({
      context: __dirname,
      entry: fullPath,
      output: {
           path: __dirname + "/component",
           filename: "bundle.js"
      },
      module: {
          loaders: [
              {
                  test: /\.jsx$/,
                  loader: 'babel-loader?stage=0'
              },
              {
                  test: /\.jsx$/,
                  loader: 'render-placement-loader',
                  query: { props: props, component: component || '' }
              },
              { 
                test: /\.css$/,
                loader: "style-loader!css-loader" 
              },

          ]
      },
      resolve: {
          extensions: ['', '.js', '.jsx']
      }
    })

    this.compile()
    .then(() => {
      this.serve()
    })

  }

  compile(){
     var promise = new Promise((resolve, reject) => {
      
      this.compiler.watch({ // watch options:
        aggregateTimeout: 300, // wait so long for more changes
        poll: true // use polling instead of native watchers
        // pass a number to set the polling interval
      },
      function(err, stats) {
        if(err) {
          console.log(err)
          return reject()
        }
        
        var jsonStats = stats.toJson()
        
        if(jsonStats.errors.length > 0) {
          for (var error of jsonStats.errors) console.error(error)
          return reject()
        }

        if(jsonStats.warnings.length > 0) {
          for (var warning of jsonStats.warnings) console.warn(warning)
          return reject()
        }
        console.log('Successfully Compiled')
        return resolve(true)
      })

    })
    return promise
  }

  serve(){
    http.createServer(function (req, res) {

      var location = url.parse(req.url,true).pathname

      if(location == '/bundle.js'){
        fs.readFile(this.bundle, function(error, content) {
          console.log('loading')
          if (error) {
            res.writeHead(500);
            res.end();
          }
          else {
            res.writeHead(200, { 'Content-Type': 'text/javascript' });
            res.end(content, 'utf-8');
          }
        });
      }
      else {
        res.writeHead(200, {'Content-Type': 'text/html; charset=UTF-8'});
        res.end('<html><head><title>React View</title></head><body><script src="/bundle.js"></script></body></html>')
      }
    }.bind(this)).listen(this.port);
    open('http://localhost:'+ this.port);
    console.log('running!')
  }
}

getPropsFromStdin((err, props) => {
  if (err) throw err
  new ReactView(props)
});
