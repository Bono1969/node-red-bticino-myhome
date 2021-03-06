module.exports = function(RED) {
  let net = require('net')
  let mhutils = require('./myhome-utils')

  const ACK  = '*#*1##'
  const NACK = '*#*0##'
  const START_MONITOR = '*99*1##'


  function MyHomeGatewayNode(config) {
    RED.nodes.createNode(this, config);

    var node = this,
        state = 'disconnected'

    node.client = undefined
    node.host = config.host
    node.port = config.port
    node.pass = config.pass
    node.timeout = parseInt(config.timeout) || 0
    node.time
    node.last_packet_timeout = undefined
    node.setMaxListeners(100)

    node.status({fill: "red", shape: "dot", text: state})


    node.on ('close', function() {
      node.log('node close called')
      close()
      clearTimeout(node.last_packet_timeout)
    })

    function instanciateClient() {
      node.log("instanciate client")
      node.client = new net.Socket()

      node.client.on('error', function() {
        node.error("Gateway socket error")
        state = 'disconnected'
        //  propably the reason for the timeout issue?
        // node.client.end()
        // node.client.destroy()
        if(node.last_packet_timeout !== undefined)
          clearTimeout(node.last_packet_timeout)
        node.log('clearTimeout3')
        if (node.timeout != 0) {
          node.last_packet_timeout = setTimeout(check_connection, (node.timeout+5)*1000)
          node.log('setTimeout3')
        }
      })

      node.client.on('data', function(data) {
        if(data === undefined) return
        clearTimeout(node.last_packet_timeout)
        parsePacket(data)
        if (node.timeout != 0) {
          node.last_packet_timeout = setTimeout(check_connection, (node.timeout+5)*1000)
          // node.log('reset connection timeout to ' + (node.timeout+5) + ' seconds.')
        }
      })

      node.client.on('close', function() {
        node.error('IP connection closed')
      })

      node.client.connect(node.port, node.host, function() {
        node.status({fill:"yellow",shape:"ring",text:"connecting"})
        // request monitoring session
        node.log('start moitoring')
        node.client.write(START_MONITOR)
        node.log('started moitoring')
        if (node.timeout != 0) {
          node.last_packet_timeout = setTimeout(check_connection, (node.timeout+5)*1000)
          node.log('setTimeout2')
        }
      })
    }

    function parsePacket(data) {
      var sdata = data.toString()

      while (sdata.length > 0) {
        var m = sdata.match(/(\*.+?##)(.*)/)
        packet = m[1]
        sdata = m[2]

        if (state !== 'monitoring') {
          if(packet === ACK) {
            switch(state) {
              case 'disconnected':
                state = 'logged-in'
                node.status({fill:"yellow",shape:"ring",text:"logged-in"})
                break
              case 'logged-in':
                state = 'monitoring'
                node.log('connected to gateway: ' + node.host)
                node.status({fill:"green",shape:"dot",text:"connected"})
                mhutils.execute_command('*#1*0##', node,
                        function(data) {
                          node.log('Updated states')
                        }, function(data) {
                          node.error('failed requesting time. connection seems broken. Reconnecting to gateway.' )
                          close()
                          instanciateClient()
                        })
                break
              default:
                node.log('unknown state: ' + state)
            }
            node.log("new state:" + state)
          } else {
            node.log('command was not acknowledged: ' + packet)
          }
        } else {
          node.emit('OWN', packet)
        }
      }
    }

    function close() {
      state = 'disconnected'
      node.log('disconnected from gateway')
      node.status({fill:"red",shape:"dot",text:"disconnected"});
      if(node.client !== undefined)
        node.client.destroy()
    }

    function check_connection() {
      node.log("checking connection")
      mhutils.execute_command('*#13**0##', node,
              function(data) {
                node.log({payload: {'state': 'up'}, topic: config.topic})
                if (state == 'disconnected')
                  instanciateClient()
              }, function(data) {
                node.error('failed requesting time. connection seems broken. Reconnecting to gateway.' )
                close()
                instanciateClient()
              })
    }

    instanciateClient()
  }

  RED.nodes.registerType("myhome-gateway", MyHomeGatewayNode);
}
