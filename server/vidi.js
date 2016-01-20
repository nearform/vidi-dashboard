'use strict'

var Path = require('path')
var Boom = require('boom')
var Package = require('../package.json')

var ClientRoutes = require('./routes/client')
var UserRoutes = require('./routes/user')

module.exports = function (server, options, next) {
  // Set our realitive path (for our routes)
  var relativePath = Path.join(__dirname, '../dist/')
  server.realm.settings.files.relativeTo = relativePath

  // Session stuff
  server.state('session', {
    ttl: 24 * 60 * 60 * 1000,
    isSecure: true,
    path: '/',
    encoding: 'base64json'
  })

  // Wire up our http routes, these are
  // mostly for managing the dashboard.
  server.route(ClientRoutes)
  server.route(UserRoutes)

  // Only allow connections from localhost
  server.select('web').ext('onRequest', function (request, reply) {
    var host = request.raw.req.connection.address().address
    if (host !== '127.0.0.1') {
      return reply(Boom.forbidden())
    }

    return reply.continue()
  })

  // Set up our seneca plugins
  var seneca = server.seneca
  seneca.use(require('./plugins/seneca-pubsub-decorator'))

  seneca.client({type: 'tcp', port: '3055', pin: 'role:user, cmd:*'})

  // Set up a default user
  seneca.act({
    role: 'user',
    cmd: 'register',
    name: process.env.USER_NAME || 'Admin',
    email: process.env.USER_EMAIL || 'admin@vidi.com',
    password: process.env.USER_PASS || 'vidi'
  })

  // Handle subscription wireup. This is very naive right
  // now, only handles a single subscription.
  seneca.subscribe({role: 'metrics', cmd: 'sub'},
    function (msg) {
      var uri = '/metrics/' + msg.source + '/' + msg.metric
      server.subscription(uri)

      // Sometimes an interval is all you need for real-time data
      setInterval(function () {
        seneca.act({role: msg.role, source: msg.source, metric: msg.metric},
          function (err, data) {
            if (err) {
              //console.log(err.stack || err)
              return
            }

            if (data) {
              server.publish(uri, data)
            }
          })
      }, 1000)
    })

  next()
}

// Hapi uses this metadata. It's convention to provide
// it even though we are actually the same package.
module.exports.attributes = {
  pkg: Package
}
