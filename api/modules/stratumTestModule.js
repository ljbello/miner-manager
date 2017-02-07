const net = require('net');
const tls = require('tls');

var self = module.exports = {
  testStratum : function (pool,callback){
    var callbackSent=false;
    var mysocket;
    var arr = pool.url.split("://");
    arr = arr[(arr.length===1 ? 0 : 1)].split(":");
    var hostname = arr[0];
    var port = arr[1];

    if(pool.isSSL){
      mysocket = new tls.connect({host:hostname,port:port,rejectUnauthorized:false});
    }else{
      mysocket = new net.Socket().connect(port, hostname);
    }

    mysocket.setTimeout(10000);

    mysocket.on('connect', function() {
      var req;
      switch(pool.algo){
        case "cryptonight":
          req = '{"id":2, "jsonrpc":"2.0", "method":"login", "params": {"login":"'+pool.worker+'", "pass": "'+pool.pass+'", "agent": "stratumTest"}}';
          break;
        default:
          req = '{"id":1, "jsonrpc":"2.0", "method":"mining.subscribe", "params": []}';
      }
      mysocket.write(req + '\n');
      mysocket.setTimeout(10000);
    });


    mysocket.on('timeout', function() {
      mysocket.destroy();
      callbackSent=true;
      callback({working:false,data:"timeout"});
    });

    mysocket.on('data', function(data) {
      var parsed=null;
      try{
        //incase multiline invalid json incoming (not comma seperated)
        parsed=data.toString('utf8').split('\n').map(function(line) {
          if(line!=="")
            return JSON.parse(line);
          else
            return "";
        });
      }catch(error){
        console.log(data.toString('utf8'));
        console.log(error);
        callbackSent=true;
        callback({working:false,data:"json error"});
      }

      for(var i=0;i<parsed.length;i++){
        if(parsed[i]!==""&&(parsed[i].id===1||parsed[i].id===2)){
          //ignore other stuff
          parsed=parsed[i];
          break;
        }
      }
      //console.log(JSON.stringify(parsed,null,2));
      if(parsed!==null)
        switch(pool.algo){
          default:
            switch (parsed.id){
              case 1:
                if(parsed.error!==undefined&&parsed.error===null){
                  var req = '{"id": 2, "jsonrpc":"2.0", "method": "mining.authorize", "params": ["'+pool.worker+'", "'+pool.pass+'"]}';
                  mysocket.write(req + '\n');
                  mysocket.setTimeout(10000);
                }else{
                  //console.log("Error: \n"+JSON.stringify(parsed.error,null,2));
                  callbackSent=true;
                  callback({working:false,data:"subscribe error"});
                }
                break;
              case 2:
                if(parsed.error!==undefined&&parsed.error===null){
                  mysocket.end();
                  mysocket.destroy();
                  callbackSent=true;
                  callback({working:true,data:"success"});
                }else{
                  //console.log("Error: \n"+JSON.stringify(parsed.error,null,2));
                  callbackSent=true;
                  callback({working:false,data:"authorize error"});
                }
                break;
            }
        }
    });

    mysocket.on('close', function() {
      if(!callbackSent)
        callback({working:false,data:"closed connection"});
    });

    mysocket.on('error', function(e) {
      //console.log("socket error: " + e.message);
      callbackSent=true;
      callback({working:false,data:"socket error"});
    });
  }
};