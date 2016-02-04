'use strict'

var Auth = require('seneca-auth')

// Hapi Plugin for wiring up Vidi
module.exports = function (server, options, next) {
  server.dependency('chairo')

  // Set up our seneca plugins
  var seneca = server.seneca

  // set up our own local auth
  seneca.use(Auth, {restrict: '/api'})

  // Set up a default user in concorda
  // timeout is a @hack. I need to know when mesh is available
  // so I can register this user
  setTimeout(function () {
    seneca.act({
      role: 'user',
      cmd: 'register',
      name: process.env.USER_NAME || 'Admin',
      email: process.env.USER_EMAIL || 'admin@vidi.com',
      password: process.env.USER_PASS || 'vidi'
    }, function (err, result) {
      console.log(err, result)
    })
  }, 30 * 1000)

  seneca.use(require('seneca-pubsub'))

  seneca.subscribe({role: 'metrics', cmd: 'sub'},
    function (msg) {
      var uri = '/metrics/' + msg.source + '/' + msg.metric
      server.subscription(uri)

      // Sometimes an interval is all you need for real-time data
      setInterval(function () {
        seneca.act({role: msg.role, source: msg.source, metric: msg.metric},
          function (err, data) {
            if (err) {
              console.log(err.stack || err)
              return
            }

            if (data) {
              console.log(data)
              server.publish(uri, data)
            }
          })
      }, 1000)
    })

  seneca.use(require('./vidi-msgstats-metrics'))

  next()
}


// Hapi plugin metadata
module.exports.attributes = {
  name: 'vidi'
}
