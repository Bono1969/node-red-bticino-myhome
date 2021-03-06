module.exports = function(RED) {
  let mhutils = require('./myhome-utils')

  function MyHomeSwitchNode(config) {
    RED.nodes.createNode(this,config)
    var node = this,
        state = {}
        gateway = RED.nodes.getNode(config.gateway)

    gateway.on('OWN', function(packet) {
      var payload = ''

      // check if message is a status update
      if(new RegExp('\\*1\\*(\\d+)\\*(' + config.switchid + '|0)##').test(packet)) {
          var m = packet.match('\\*1\\*(\\d+)\\*(' + config.switchid + '|0)##'),
              what = parseInt(m[1])
          if (m == undefined) {
            node.error('failed parsing OWN packet: ' + packet)
            return
          }
          payload = (what == "1") ? 'ON' : 'OFF'
          payload == 'ON' ? node.status({fill: 'yellow', shape: 'dot', text: 'On'}) : node.status({fill: 'grey', shape: 'dot', text: 'Off'})
          node.send({payload: payload, topic: 'state/' + config.topic})
      }
    })


    node.on('input', function(msg) {
      // check if message is boolean indicating desired state of switch
      if (typeof(msg) === 'string')
        msg = JSON.parse(msg)

      var payload = msg.payload
      if (msg.topic === 'cmd/' + config.topic) {

        var command = '*1*' + (payload == 'ON' ? 1 : 0) + '*' + config.switchid + '##'
        mhutils.execute_command(command, RED.nodes.getNode(config.gateway),
        function(data) {
          // updating node state
          payload == 'ON' ? node.status({fill: 'yellow', shape: 'dot', text: 'On'}) : node.status({fill: 'grey', shape: 'dot', text: 'Off'})
          node.send({payload: payload, topic: 'state/' + config.topic})
        }, function(data) {
          node.error('command failed' + command)
          node.status({fill: 'red', shape: 'dot', text: 'command failed: ' + command})
        })

        return
      }
    })
  }
  RED.nodes.registerType("myhome-switch", MyHomeSwitchNode);
}
