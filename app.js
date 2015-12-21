var baseApiUrl = "http://127.0.0.1:5001/api/v0/";

var appState = {};
appState.userChatConfig = {};
appState.chatLogLength = 15;
appState.userHash = "Didn't get the ID yet";
appState.currentRoom = "first";

function body(){ return document.body }

var entityMap = { "&": "&amp;"
                , "<": "&lt;"
                , ">": "&gt;"
                , '"': '&quot;'
                , "'": '&#39;'
                , "/": '&#x2F;'
                };

function escapeHtml( string )
{
    return String(string).replace(/[&<>"'\/]/g, function (s)
    {
        return entityMap[s];
    });
}

function getImgDataUri(url, cont) {
    var image = new Image();

    image.onload = function ()
    {
        var canvas = document.createElement('canvas');
        canvas.width = this.naturalWidth;
        canvas.height = this.naturalHeight;

        canvas.getContext('2d').drawImage(this, 0, 0);

        cont(canvas.toDataURL('image/png'));
    };

    image.src = url;
}

function hash(s)
{
    var hash = 0, i, chr, len;
    if (s.length === 0) return hash;
    for (i = 0, len = s.length; i < len; i++)
    {
        chr   = s.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return hash;
};

function rn(min,max)
{
    var res = Math.random() * (max-min);
    res += min;
    return Math.floor(res);
}

function rng(g)
{
    return function(min,max)
    {
        var res = g() * (max-min);
        res += min;
        return Math.floor(res);
    };
}

function rd(seed)
{
    var r = new MersenneTwister(seed);
    return function(){ return r.random() };
}

function randomImg(g)
{
    if (g == undefined)
        g = rn;
    else
        g = rng(g);
    
    var c = ce("canvas");
    c.width = 50;
    c.height = 50;
    
    var ctx = c.getContext("2d");
    
    ctx.fillStyle = "rgb(" + g(0,255) + "," + g(0,255) + "," + g(0,255) + ")";
    ctx.fillRect( 0 , 0 , 50 , 50 );
    for ( var i = 0 ; i < Math.random() * 10 ; i++ )
    {
        ctx.fillStyle = "rgb(" + g(0,255) + "," + g(0,255) + "," + g(0,255) + ")";
        ctx.fillRect( g(0,50) , g(0,50) , g(10,50) , g(10,50) );
    }
    
    var img = ce("img");
    img.src = c.toDataURL("image/png");
    
    return img;
}

function log(n)
{
    console.log(n);
}

function safeParse( s )
{
    try
    {
        return JSON.parse(s);
    }
    catch (e)
    {
        return null;
    }
}

function safeParseCont( s , faild , ok )
{
    var r = safeParse(s);
    if (r == null)
        faild();
    else
        ok(r);
}

function diffArraysOld(a,b)
{
    return a.filter( function(i){ return b.indexOf(i) < 0 ; } );
}

function diffArrays(a1, a2) {

    var a = [], diff = [];

    for (var i = 0; i < a1.length; i++) {
        a[a1[i]] = true;
    }

    for (var i = 0; i < a2.length; i++) {
        if (a[a2[i]]) {
            delete a[a2[i]];
        } else {
            a[a2[i]] = true;
        }
    }

    for (var k in a) {
        diff.push(k);
    }

    return diff;
};


function compHotLists( l1 , l2 )
{
    if ( l1.length == 0 )
        return l2;
    if ( l2.length == 0 )
        return [];
    
    var lr = [];
    
    var i = 0;
    var j = 0;
    for (;;)
    {
        var endL1 = i >= l1.length;
        var endL2 = j >= l2.length;
        if ( endL1 )
        {
            for ( ; j < l2.length ; j++ )
                lr.push( l2[j] );
            return lr;
        }
        if ( endL2 )
            return lr;
        
        if ( l1[i].timeStamp == l2[j].timeStamp && l1[i].content == l2[j].content )
        {
            i += 1;
            j += 1;
        }
        else
        {
            if ( l1[i].timeStamp > l2[j].timeStamp )
            {
                i += 1; 
            }
            else
            {
                lr.push( l2[j] );
                j += 1;
            }
        }
    }
}

function timeStamp()
{
    return Date.now();
}

function sortMessages(list)
{
    var l = list.sort( function(a,b)
    {
        if ( a.timeStamp < b.timeStamp )
            return 1;
        else if ( a.timeStamp > b.timeStamp )
            return -1;
        else
            return 0;
    } );
    l = l.filter( function(e){return e != null;} )
    return l
}

function unsafeConcat(l1,l2)
{
    for (var i in l2)
        l1.push(l2[i]);
    return l1
}

function emptyFunction(){}

function error(s){ return function(){log(s)} }

function httpGet( url , cont )
{
    var xhReq = new XMLHttpRequest();
    xhReq.open("GET", url, true);
    xhReq.onload = function(e){ console.log(e) ; cont( e.currentTarget.responseText , e  ) };
    xhReq.send(null);
}

var ipfsCacheArrayBuffer = {};
function ipfsGetImg( hash , format , cont )
{
    if ( ipfsCacheArrayBuffer[hash] == undefined )
    {
        ipfsCacheArrayBuffer[hash] = { timeStamp : timeStamp() , callBacks : [] };
        
        var xmlHTTP = new XMLHttpRequest();
        xmlHTTP.open("GET" , baseApiUrl + "cat?arg=" + hash , true);
        xmlHTTP.responseType = 'arraybuffer';
        
        xmlHTTP.onload = function(e)
        {
            var arr = new Uint8Array(this.response);
            var raw = String.fromCharCode.apply(null,arr);
            var b64=btoa(raw);
            var dataURL="data:image/"+format+";base64,"+b64;
            
            ipfsCacheArrayBuffer[hash].content = b64;
            cont( dataURL );
            
            var calls = ipfsCacheArrayBuffer[hash].callBacks;
            for (var i in calls)
                calls[i](b64);
        };
    
        xmlHTTP.send();
    }
    else
    {
        if ( ipfsCacheArrayBuffer[hash].content != undefined )
            cont( "data:image/"+format+";base64," + ipfsCacheArrayBuffer[hash].content );
        else
            ipfsCacheArrayBuffer[hash].callBacks.push( data => cont( "data:image/"+format+";base64," + data ) );
    }
}

function httpPost( url , content , cont )
{
    var xhReq = new XMLHttpRequest();
    xhReq.open("POST", url, true);
    xhReq.onload = function(e){ console.log(e) ; cont( e.currentTarget.responseText , e ) };
    
    var c = 'Content-Disposition: file; filename=""\nContent-Type: application/octet-stream\n\n';
    
    var sBoundary = "---------------------------" + Date.now().toString(16);
    xhReq.setRequestHeader("Content-Type", "multipart/form-data; boundary=" + sBoundary);
    xhReq.send("--" + sBoundary + "\r\n" + c + content + "\r\n--" + sBoundary + "--\r\n");
}

function ipfsAdd( content , cont )
{
    httpPost( baseApiUrl + "add" , content , function(r)
    {
        cont( JSON.parse(r).Hash );
    } );
}

var ipfsCache = {};
function ipfsGet( hash , cont )
{
    if ( ipfsCache[hash] == undefined )
    {
        ipfsCache[hash] = { timeStamp : timeStamp() , callBacks : [] };
        httpGet( baseApiUrl + "cat?arg=" + hash , data =>
        { 
            ipfsCache[hash].content = data;
            cont(data);
            var calls = ipfsCache[hash].callBacks;
            ipfsCache[hash].callBacks = [];
            for (var i in calls)
                calls[i](data);
        });
    }
    else
    {
        if ( ipfsCache[hash].content == undefined )
            ipfsCache[hash].callBacks.push(cont);
        else
            cont( ipfsCache[hash].content );
    }
}

function ipfsResolveName( name , cont )
{
    httpGet( baseApiUrl + "name/resolve?arg=" + name, function(r)
    {
        var hash = JSON.parse(r).Path.split("/")[2];
        cont(hash);
    } );
}

function writeDefaultMessage( cont )
{
    var m = { content : "Conversation Start"
            , parent : ""
            };
    
    ipfsAdd( JSON.stringify(m) , cont );
}

function pointIpnsTo( hash , cont )
{
    setStatus( "Updating ipns" );
    httpGet( baseApiUrl + "name/publish?arg=" + hash , function(e){ setStatus("Ready") ; cont() ; } );
}

function defaultRoomConfig()
{
    return { others : []
           , hotMessages : []
           , archive : ""
           , hotMessageAgeLimit : 1000 * 60 * 60
           , userName : "Anon"
           };
}

function writeDefaultChatConfig( appState , cont )
{
    var room = defaultRoomConfig();
    ipfsAdd( JSON.stringify(room) , function(roomHash)
    {
        appState.userChatConfig = { first : roomHash
                         };
        saveChatconfig( userChatConfig , cont );
    });
}

function saveChatconfig( userChatConfig , cont )
{
    ipfsAdd( JSON.stringify( userChatConfig ) , function( configHash )
    {
        pointIpnsTo( configHash , cont );
    } );
}

function saveRoom( userChatConfig , name , json , cont )
{
    if (json == undefined || json == null) { console.log("ERROR SAVING UNDEFINED ROOM",json,name,cont) ; return ; }
    
    ipfsAdd( JSON.stringify( json ) , function(hash)
    {
        userChatConfig[name] = hash;
        
        saveChatconfig( userChatConfig , cont );
    });
}


function withRoom( roomHash , cont )
{
    ipfsGet( roomHash , function(r)
    {
        safeParseCont( r , emptyFunction , cont);
    });
}

function addChatMessage( userChatConfig , roomName , content , cont )
{
    ipfsGet( userChatConfig[roomName] , function(r)
    {
        safeParseCont( r , emptyFunction , function(room)
        {
            var message = { content : room.userName + ": " + content
                          , timeStamp : timeStamp()
                          };
            
            if (room.userIcon)
                message.icon = room.userIcon;
            
            room.hotMessages.push( message );
            sortMessages( room.hotMessages );
            getChatLog( room , log => setChatContent(userChatConfig,log) );
            saveRoom( userChatConfig , roomName , room , cont );
        });
    });
}

function init()
{
    if ( document.location.href.indexOf("api=") != -1 )
        baseApiUrl = document.location.href.split("api=")[1]
    
    var failFunction = function(){ setStatus("You need to press the init button!!!") ; generateUI( appState.userChatConfig , appState.currentRoom) ; };
    
    setStatus("Getting your ID");
    httpGet( baseApiUrl + "config?arg=Identity.PeerID" , function(r)
    {
        setStatus("Got your ID");
        
        safeParseCont( r , failFunction , function(userHashR)
        {
            appState.userHash = userHashR.Value;
            
            ipfsResolveName( appState.userHash , function(r)
            {
                appState.userPointedHash = r;
                setStatus("Got your config hash");
                
                ipfsGet( appState.userPointedHash , function(r)
                {
                    safeParseCont( r , failFunction , function(config)
                    {
                        setStatus("Got your config");
                        appState.userChatConfig = config;
                        
                        var updateTimer = setInterval( function(){ update(appState.userChatConfig,appState.currentRoom) } , 1000 * 60 * 1 );
                        generateUI( appState.userChatConfig , appState.currentRoom );
                    });
                });
            });
        });
    } );
}

function setStatus(s)
{
    console.log("SET STATUS" , s);
    if (window["statusDiv"])
        window["statusDiv"].innerHTML = s;
    else
        console.log("WARNING STATUS DIV NOT PRESENT");
}

function update( userChatConfig , roomName )
{
    withRoom( userChatConfig[roomName] , function(room)
    {
        setStatus("Starting update");
        
        function updateOtherUsers( n )
        {
            var p = room.others[n];
            console.log("For other",p);
            
            ipfsResolveName( p.hash , function(p2ConfigHash)
            {
                console.log("Resolved other name");
                ipfsGet( p2ConfigHash , function(p2ConfigR)
                {
                    console.log("Got other config");
                    var p2RoomHash = JSON.parse( p2ConfigR )[p.roomName];
                    
                    ipfsGet( p2RoomHash , function(p2RoomString)
                    {
                        safeParseCont( p2RoomString , emptyFunction , function(p2Room)
                        {
                            console.log("P2 ROOM" , p2Room , room);
                            var diff = compHotLists( room.hotMessages , p2Room.hotMessages );
                            var time = timeStamp();
                            if (diff.length > 10)
                            {
                                diff = diff.filter( function(e)
                                {
                                    return (e.timeStamp > time-room.hotMessageAgeLimit) && (e.timeStamp < time);
                                } );
                            }
                            console.log("DIFF2",diff);
                            
                            var othersDiff = diffArrays( p2Room.others , room.others );
                            for ( var i in othersDiff )
                                room.others.push( othersDiff[i] );
                            
                            for ( var i in diff )
                                room.hotMessages.push( diff[i] );
                            sortMessages( room.hotMessages );
                            
                            getChatLog( room , log =>
                            {
                                setChatContent(userChatConfig,log);
                                
                                saveRoom( userChatConfig , roomName , room , function()
                                {
                                    if ( n >= room.others.length - 1 )
                                    {
                                        console.log( "Start archiving" );
                                        archiveMessages( userChatConfig , roomName , () => refreshChatcontent(userChatConfig) );
                                    }
                                    else
                                        updateOtherUsers( n+1 );
                                });
                            });
                        });
                    });
                } );
            } );
        }
        
        if (room.others.length != 0)
            updateOtherUsers( 0 );
        else
            setStatus("Ready");
    });
}

function refreshChatcontent( userChatConfig )
{
    withRoom( appState.userChatConfig[appState.currentRoom] , function(room){ getChatLog( room , log => setChatContent(userChatConfig,log) ) } );
}

function archiveMessages( userChatConfig , roomName , cont )
{
    ipfsGet( userChatConfig[roomName] , function(r)
    {
        safeParseCont( r , emptyFunction , function(room)
        {
            if ( room.hotMessages.length != 0 )
            {
                var lm = room.hotMessages[ room.hotMessages.length-1 ];
                
                if ( lm.timeStamp < timeStamp() - room.hotMessageAgeLimit )
                {
                    var message = room.hotMessages.splice( room.hotMessages.length-1 , 1 )[0];
                    message.parent = room.archive;
                    
                    ipfsAdd( JSON.stringify( message ) , function(mHash)
                    {
                        room.archive = mHash;
                        saveRoom( userChatConfig , roomName , room , function(){ archiveMessages( userChatConfig , roomName , cont ) } );
                    } );
                }
                else
                    cont();
            }
        });
    });
}

function ce(p)
{
    return document.createElement(p);
}

function cDiv()
{
    return ce("div");
}

function cinput()
{
    var i = ce("input");
    i.style.border = "none";
    i.style.borderLeft = "3px solid green";
    i.style.backgroundColor = "grey";
    i.style.color = "white";
    i.style.width = "100%";
    return i;
}

function cbutton()
{
    var b = ce("button");
    b.style.border = "3px solid darkred";
    b.style.backgroundColor = "black";
    b.style.color = "white";
    b.style.cursor = "pointer";
    return b;
}

function addDivTo( e )
{
    var d = cDiv();
    e.appendChild(d);
    return d;
}

function addInputTo( e )
{
    var i = cinput();
    e.appendChild(i);
    return i;
}

function addButtonTo( e )
{
    var b = cbutton();
    e.appendChild(b);
    return b;
}

function addETo( st , e )
{
    var d = ce( st );
    e.appendChild( d );
    return d;
}

function onEnter(el,cont)
{
    el.onkeypress = function(e)
    {
        if (!e) e = window.event;
        var keyCode = e.keyCode || e.which;
        if (keyCode == '13')
        {
            cont();
            return false;
        }
    };
}

function roomIsValid(room)
{
    return room["others"] != undefined && room["hotMessages"] != undefined && room["archive"] != undefined;
}

function generateUI( userChatConfig , roomName )
{
    ipfsGet( userChatConfig[roomName] , function(r)
    {
        safeParseCont( r , error("ERROR PARSING ROOM DATA") , function(room)
        {
            body().innerHTML = "";
            body().style.backgroundColor = "lightblue";
            body().style.backgroundImage = "url(bc.png)";
            body().style.color = "black";
            body().style.padding = "0";
            body().style.margin = "0";
            
            var leftSection = addDivTo( body() );
            var chatSection = addDivTo( body() );
            
            var logoDiv = addDivTo( leftSection );
            var uiHead = addDivTo( leftSection );
            
            leftSection.style.float = chatSection.style.float = "left";
            leftSection.style.width = "33%";
            uiHead.style.margin = "20px";
            
            chatSection.style.width = "67%";
            
            logoDiv.style.backgroundImage = "url(logo.png)";
            logoDiv.style.backgroundRepeat = "no-repeat";
            logoDiv.style.backgroundPosition = "center";
            logoDiv.style.height = "300px";
            
            if (room.logo != undefined)
            {
                ipfsGetImg( room.logo , "jpg" , data =>
                {
                    logoDiv.style.backgroundImage = "url("+data+")";
                });
            }
            if (room.background != undefined)
            {
                ipfsGetImg( room.background , "jpg" , data =>
                {
                    body().style.backgroundImage = "url("+data+")";
                });
            }
            
            if ( !roomIsValid(room) ) // THIS IS A HACK...
            {
                console.log( "Invalid room" , room );
                var initButton = addButtonTo( uiHead );
                initButton.innerHTML = "Init";
                initButton.onclick = function()
                {
                    body().innerHTML = "Writing to your ipns can take some time. Please refresh the page in a minute.";
                    if (window["updateTimer"]) clearInterval( updateTimer );
                    writeDefaultChatConfig(appState,emptyFunction);
                };
                
                return;
            }
            
            var roomText = addDivTo( uiHead );
            var roomTextP1 = addETo( "span" , roomText ); roomTextP1.innerHTML = "Your are in ";
            var roomTextP2 = addETo( "span" , roomText ); roomTextP2.innerHTML = "room " + appState.currentRoom;
            var roomTextP3 = addETo( "span" , roomText ); roomTextP3.innerHTML = ". This room is connected to " + room.others.length + " other persons.";
            
            roomText.style.fontSize = "25px";
            roomTextP2.style.color = "darkred";
            
            var initButton = addButtonTo( uiHead );
            initButton.innerHTML = "Init";
            initButton.onclick = function()
            {
                body().innerHTML = "Writing to your ipns can take some time. Please refresh the page in a minute.";
                if (window["updateTimer"]) clearInterval( updateTimer );
                writeDefaultChatConfig(appState,emptyFunction);
            };
            var forceUpdate = addButtonTo( uiHead );
            forceUpdate.innerHTML = "Force update";
            forceUpdate.style.marginLeft = "10px";
            forceUpdate.onclick = function()
            {
                update(userChatConfig,appState.currentRoom);
            };
            
            var userHashBox = addDivTo( uiHead );
            userHashBox.innerHTML = "The room id to share is : ";
            var userHashBoxValue = addInputTo( userHashBox );
            userHashBoxValue.value = appState.userHash + "/" + appState.currentRoom;
            userHashBoxValue.style.display = "block";
            
            window["statusDiv"] = addDivTo( uiHead );
            window["statusDiv"].innerHTML = "Ready";
            
            var userNameBox = addDivTo( uiHead );
            
            var userNameBoxText = addDivTo( userNameBox );
            userNameBoxText.innerHTML = "User name (press enter to submit):";
            
            var userNameInput = addInputTo( userNameBox );
            userNameInput.value = room.userName;
            onEnter( userNameInput , function()
            {
                withRoom( userChatConfig[roomName] , function(room)
                {
                    room.userName = userNameInput.value;
                    saveRoom( userChatConfig , roomName , room , emptyFunction );
                });
            });
            
            var userIconBox = addDivTo( uiHead );
            
            var userIconBoxText = addDivTo( userIconBox );
            userIconBoxText.innerHTML = "Chat icon (press enter to submit):";
            
            var userIconInput = addInputTo( userIconBox );
            userIconInput.value = room.userIcon || "";
            onEnter( userIconInput , function()
            {
                withRoom( userChatConfig[roomName] , function(room)
                {
                    room.userIcon = userIconInput.value;
                    saveRoom( userChatConfig , roomName , room , emptyFunction );
                });
            });
            
            var addOtherBox = addDivTo( uiHead );
            
            var addOtherText = addDivTo( addOtherBox );
            addOtherText.innerHTML = "Connect with someone else room id (press enter to submit):";
            
            var addOtherInput = addInputTo( addOtherBox );
            onEnter( addOtherInput , function()
            {
                withRoom( userChatConfig[roomName] , function(room)
                {
                    var hash = addOtherInput.value.split("/")[0];
                    var otherRoomName = addOtherInput.value.split("/")[1];
                    room.others.push( { hash : hash , roomName : otherRoomName } );
                    addOtherInput.value = "";
                    saveRoom( userChatConfig , roomName , room , emptyFunction );
                });
            } );
            
            var chatLengthDiv = addETo( "div" , uiHead );
            var chatLengthText = addETo( "div" , chatLengthDiv );
            chatLengthText.innerHTML = "Chat size";
            var chatLengthInput = addInputTo( chatLengthDiv );
            chatLengthInput.value = appState.chatLogLength;
            onEnter( chatLengthInput , function()
            {
                appState.chatLogLength = parseInt( chatLengthInput.value );
                refreshChatcontent( userChatConfig );
            } );
            
            var addChatRoomDiv = addDivTo( uiHead );
            var addChatRoomText = addDivTo( addChatRoomDiv );
            addChatRoomText.innerHTML = "Add chat room (press enter to submit):";
            var addChatRoomInput = addInputTo( addChatRoomDiv );
            onEnter( addChatRoomInput , function()
            {
                ipfsAdd( JSON.stringify( defaultRoomConfig() ) , function(hash)
                {
                    userChatConfig[ addChatRoomInput.value ] = hash;
                    addChatRoomInput.value = "";
                    saveChatconfig( userChatConfig , () => generateUI(userChatConfig, appState.currentRoom) );
                });
            });
            
            var roomsButtons = addDivTo( uiHead );
            for ( var i in userChatConfig )
            {
                var b = addButtonTo( uiHead );
                b.innerHTML = "Switch to room: " + i;
                b.style.display = "block";
                b.style.marginTop = "10px";
                b.onclick = (function(i){return function() // extra function and strange calling to fix javascript scopping
                {
                    appState.currentRoom = i;
                    generateUI( userChatConfig , appState.currentRoom );
                }})(i);
            }
            
            getChatLog( room , function(chatLog)
            {
                userChatConfig.chatContainer = addETo( "div" , chatSection );
                setChatContent( userChatConfig , chatLog );
                
                var addMessageInput = addInputTo( chatSection );
                addMessageInput.style.width = "100%";
                addMessageInput.style.height = "25px";
                
                onEnter( addMessageInput , function()
                {
                    var content = addMessageInput.value;
                    
                    if ( content != "" )
                    {
                        addMessageInput.value = "";
                        addChatMessage( userChatConfig , roomName , content , function()
                        {
                            refreshChatcontent( userChatConfig ); // addChatMessage refresh déja mais...
                        } );
                    }
                } );
            } );
        });
    });
}

function setChatContent( userChatConfig , chatLog )
{
    userChatConfig.chatContainer.innerHTML = "";
    
    for ( var i = chatLog.length-1 ; i >= 0 ; i-- )
    {
        if (chatLog[i] != null && chatLog[i] != undefined)
        {
            var cont = addDivTo( userChatConfig.chatContainer );
            cont.style.clear = "both";
            cont.style.overflow = "hidden";
            cont.style.marginBottom = "10px";
            var imgSide = addDivTo(cont);
            var textSide = addDivTo(cont);
            imgSide.style.float = "left";
            
            var message = addDivTo( textSide );
            message.innerHTML = escapeHtml( chatLog[i].content );
            var img = randomImg( rd( hash(JSON.stringify(chatLog[i])) ) );
            imgSide.appendChild(img);
            img.style.marginRight = "10px";
            img.width = 50;
            img.height = 50;
            //ipfsGet( "QmUApkqo5EW7ALHcUnEgz3zNjC8zah47dbtZ4DCuciLCZJ" , ( (img,imgSide) => (data => {img.src = data;imgSide.appendChild(img)}) ) (img,imgSide) );
            if ( chatLog[i].icon )
            {
                ipfsGetImg( chatLog[i].icon
                          , "jpg"
                          , ( (img,imgSide) => ( data => {
                                                   img.src = data;
                                                   imgSide.appendChild(img);
                                               })
                            )
                            (img,imgSide));
            }
        }
        else
            console.log( "NULL OR UNDEFINED MESSAGE IN SET CHAT CONTENT" , chatLog );
    }
}

function getChatLog( room , cont )
{
    var log = JSON.parse( JSON.stringify( room.hotMessages ) );
    if ( log.length < appState.chatLogLength )
    {
        if (room.archive != "")
        {
            var l = appState.chatLogLength - log.length;
            getChatLogArchive( room.archive , l , log2 =>
            {
                for ( var i in log2 )
                    log.push( log2[i] );
                cont( log );
            } );
        }
        else
            cont(log);
    }
    else
        cont( log );
}

function getChatLogArchive( startHash , num , cont )
{
    if (!startHash || num == 0)
        cont([]);
    else
    {
        function loop( hash , list , num , funct , cont )
        {
            ipfsGet( hash , function(r)
            {
                var message = JSON.parse(r);
                
                list.push(message);
                
                if (!message.parent || num == 0)
                    cont( list );
                else
                    funct( message.parent , list , num-1 , funct , cont );
            } );
        }
        
        loop( startHash , [] , num , loop , cont );
    }
}
