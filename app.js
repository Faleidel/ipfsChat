baseApiUrl = "http://127.0.0.1:5001/api/v0/";

var entityMap = { "&": "&amp;"
                , "<": "&lt;"
                , ">": "&gt;"
                , '"': '&quot;'
                , "'": '&#39;'
                , "/": '&#x2F;'
                };

function escapeHtml(string)
{
    return String(string).replace(/[&<>"'\/]/g, function (s)
    {
        return entityMap[s];
    });
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
    for (i in l2)
        l1.push(l2[i]);
    return l1
}

function emptyFunction(){}

function error(s){ return function(){log(s)} }

httpGet = function( url , cont )
{
    var xhReq = new XMLHttpRequest();
    xhReq.open("GET", url, true);
    xhReq.onload = function(e){ console.log(e) ; cont( e.currentTarget.responseText , e  ) };
    xhReq.send(null);
}

httpPost = function( url , content , cont )
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

function ipfsGet( hash , cont )
{
    httpGet( baseApiUrl + "cat?arg=" + hash , cont );
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

function writeDefaultChatConfig( cont )
{
    var room = defaultRoomConfig();
    ipfsAdd( JSON.stringify(room) , function(roomHash)
    {
        userChatConfig = { first : roomHash
                         };
        saveChatconfig( cont );
    });
}

function saveChatconfig( cont )
{
    ipfsAdd( JSON.stringify( userChatConfig ) , function( configHash )
    {
        pointIpnsTo( configHash , cont );
    } );
}

function saveRoom( name , json , cont )
{
    if (json == undefined || json == null) { console.log("ERROR SAVING UNDEFINED ROOM",json,name,cont) ; return ; }
    
    ipfsAdd( JSON.stringify( json ) , function(hash)
    {
        userChatConfig[name] = hash;
        
        saveChatconfig( cont );
    });
}


function withRoom( roomName , cont )
{
    ipfsGet( userChatConfig[roomName] , function(r)
    {
        safeParseCont( r , emptyFunction , cont);
    });
}

function addChatMessage( roomName , content , cont )
{
    ipfsGet( userChatConfig[roomName] , function(r)
    {
        safeParseCont( r , emptyFunction , function(room)
        {
            var message = { content : room.userName + ": " + content
                          , timeStamp : timeStamp()
                          };
            
            room.hotMessages.push( message );
            sortMessages( room.hotMessages );
            saveRoom( roomName , room , cont );
        });
    });
}

function init()
{
    if ( document.location.href.indexOf("api=") != -1 )
        baseApiUrl = document.location.href.split("api=")[1]
    
    userChatConfig = {};
    chatLogLength = 15;
    userHash = "Didn't get the ID yet";
    currentRoom = "first";
    
    failFunction = function(){ setStatus("You need to press the init button!!!") ; generateUI(currentRoom) ; };
    
    setStatus("Getting your ID");
    httpGet( baseApiUrl + "config?arg=Identity.PeerID" , function(r)
    {
        setStatus("Got your ID");
        
        safeParseCont( r , failFunction , function(userHashR)
        {
            userHash = userHashR.Value;
            
            ipfsResolveName( userHash , function(r)
            {
                userPointedHash = r;
                setStatus("Got your config hash");
                
                ipfsGet( userPointedHash , function(r)
                {
                    safeParseCont( r , failFunction , function(config)
                    {
                        setStatus("Got your config");
                        userChatConfig = config;
                        
                        var updateTimer = setInterval( function(){ update(currentRoom) } , 1000 * 60 * 1 );
                        generateUI(currentRoom);
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
        statusDiv.innerHTML = s;
    else
        console.log("WARNING STATUS DIV NOT PRESENT");
}

function update( roomName )
{
    withRoom( roomName , function(room)
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
                            for ( i in othersDiff )
                                room.others.push( othersDiff[i] );
                            
                            for ( i in diff )
                                room.hotMessages.push( diff[i] );
                            sortMessages( room.hotMessages );
                            
                            saveRoom( roomName , room , function()
                            {
                                if ( n >= room.others.length - 1 )
                                {
                                    console.log( "Start archiving" );
                                    archiveMessages( roomName , refreshChatcontent );
                                }
                                else
                                    updateOtherUsers( n+1 );
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

function refreshChatcontent()
{
    withRoom( currentRoom , function(room){ getChatLog( room , setChatContent ) } );
}

function archiveMessages( roomName , cont )
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
                        saveRoom( roomName , room , function(){ archiveMessages( roomName , cont ) } );
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

function generateUI( roomName )
{
    ipfsGet( userChatConfig[roomName] , function(r)
    {
        safeParseCont( r , error("ERROR PARSING ROOM DATA") , function(room)
        {
            body = document.body;
            body.innerHTML = "";
            body.style.backgroundColor = "lightblue";
            body.style.backgroundImage = "url(bc.png)";
            body.style.color = "black";
            body.style.padding = "0";
            body.style.margin = "0";
            
            leftSection = addDivTo( body );
            chatSection = addDivTo( body );
            
            logoDiv = addDivTo( leftSection );
            uiHead = addDivTo( leftSection );
            
            leftSection.style.float = chatSection.style.float = "left";
            leftSection.style.width = "33%";
            uiHead.style.margin = "20px";
            
            chatSection.style.width = "67%";
            
            logoDiv.style.backgroundImage = "url(logo.png)";
            logoDiv.style.backgroundRepeat = "no-repeat";
            logoDiv.style.backgroundPosition = "center";
            logoDiv.style.height = "300px";
            
            if ( !roomIsValid(room) ) // THIS IS A HACK...
            {
                initButton = addButtonTo( uiHead );
                initButton.innerHTML = "Init";
                initButton.onclick = function()
                {
                    document.body.innerHTML = "Writing to your ipns can take some time. Please refresh the page in a minute.";
                    if (window["updateTimer"]) clearInterval( updateTimer );
                    writeDefaultChatConfig(emptyFunction);
                };
                
                return;
            }
            
            roomText = addDivTo( uiHead );
            roomTextP1 = addETo( "span" , roomText ); roomTextP1.innerHTML = "Your are in ";
            roomTextP2 = addETo( "span" , roomText ); roomTextP2.innerHTML = "room " + currentRoom;
            roomTextP3 = addETo( "span" , roomText ); roomTextP3.innerHTML = ". This room is connected to " + room.others.length + " other persons.";
            
            roomText.style.fontSize = "25px";
            roomTextP2.style.color = "darkred";
            
            initButton = addButtonTo( uiHead );
            initButton.innerHTML = "Init";
            initButton.onclick = function()
            {
                document.body.innerHTML = "Writing to your ipns can take some time. Please refresh the page in a minute.";
                if (window["updateTimer"]) clearInterval( updateTimer );
                writeDefaultChatConfig(emptyFunction);
            };
            forceUpdate = addButtonTo( uiHead );
            forceUpdate.innerHTML = "Force update";
            forceUpdate.style.marginLeft = "10px";
            forceUpdate.onclick = function()
            {
                update(currentRoom);
            };
            
            userHashBox = addDivTo( uiHead );
            userHashBox.innerHTML = "The room id to share is : ";
            userHashBoxValue = addInputTo( userHashBox );
            userHashBoxValue.value = userHash + "/" + currentRoom;
            userHashBoxValue.style.display = "block";
            
            statusDiv = addDivTo( uiHead );
            statusDiv.innerHTML = "Ready";
            
            userNameBox = addDivTo( uiHead );
            
            userNameBoxText = addDivTo( userNameBox );
            userNameBoxText.innerHTML = "User name (press enter to submit):";
            
            userNameInput = addInputTo( userNameBox );
            userNameInput.value = room.userName;
            onEnter( userNameInput , function()
            {
                withRoom( roomName , function(room)
                {
                    room.userName = userNameInput.value;
                    saveRoom( roomName , room , emptyFunction );
                });
            });
            
            addOtherBox = addDivTo( uiHead );
            
            addOtherText = addDivTo( addOtherBox );
            addOtherText.innerHTML = "Connect with someone else room id (press enter to submit):";
            
            addOtherInput = addInputTo( addOtherBox );
            onEnter( addOtherInput , function()
            {
                withRoom( roomName , function(room)
                {
                    var hash = addOtherInput.value.split("/")[0];
                    var otherRoomName = addOtherInput.value.split("/")[1];
                    room.others.push( { hash : hash , roomName : otherRoomName } );
                    addOtherInput.value = "";
                    saveRoom( roomName , room , emptyFunction );
                });
            } );
            
            chatLengthDiv = addETo( "div" , uiHead );
            chatLengthText = addETo( "div" , chatLengthDiv );
            chatLengthText.innerHTML = "Chat size";
            chatLengthInput = addInputTo( chatLengthDiv );
            chatLengthInput.value = chatLogLength;
            onEnter( chatLengthInput , function()
            {
                chatLogLength = parseInt( chatLengthInput.value );
                refreshChatcontent();
            } );
            
            addChatRoomDiv = addDivTo( uiHead );
            addChatRoomText = addDivTo( addChatRoomDiv );
            addChatRoomText.innerHTML = "Add chat room (press enter to submit):";
            addChatRoomInput = addInputTo( addChatRoomDiv );
            onEnter( addChatRoomInput , function()
            {
                ipfsAdd( JSON.stringify( defaultRoomConfig() ) , function(hash)
                {
                    userChatConfig[ addChatRoomInput.value ] = hash;
                    addChatRoomInput.value = "";
                    saveChatconfig( function(){ generateUI(currentRoom) } );
                });
            });
            
            roomsButtons = addDivTo( uiHead );
            for ( i in userChatConfig )
            {
                var b = addButtonTo( uiHead );
                b.innerHTML = "Switch to room: " + i;
                b.style.display = "block";
                b.style.marginTop = "10px";
                b.onclick = (function(i){return function() // extra function and strange calling to fix javascript scopping
                {
                    currentRoom = i;
                    generateUI( currentRoom );
                }})(i);
            }
            
            getChatLog( room , function(chatLog)
            {
                chatContainer = addETo( "div" , chatSection );
                setChatContent( chatLog );
                
                addMessageInput = cinput();
                addMessageInput.style.width = "100%";
                addMessageInput.style.height = "25px";
                
                onEnter( addMessageInput , function()
                {
                    var content = addMessageInput.value;
                    
                    if ( content != "" )
                    {
                        addMessageInput.value = "";
                        addChatMessage( roomName , content , function()
                        {
                            refreshChatcontent();
                        } );
                    }
                } );
                
                chatSection.appendChild( addMessageInput );
            } );
        });
    });
}

function setChatContent( chatLog )
{
    chatContainer.innerHTML = "";
    
    for ( var i = chatLog.length-1 ; i >= 0 ; i-- )
    {
        if (chatLog[i] != null && chatLog[i] != undefined)
        {
            var message = ce("pre");
            message.innerHTML = escapeHtml( chatLog[i].content );
            chatContainer.appendChild(message);
        }
        else
            console.log( "NULL OR UNDEFINED MESSAGE IN SET CHAT CONTENT" , chatLog );
    }
}

function getChatLog( room , cont )
{
    var log = JSON.parse( JSON.stringify( room.hotMessages ) );
    if ( log.length < chatLogLength )
    {
        if (room.archive != "")
        {
            var l = chatLogLength - log.length;
            getChatLogArchive( room.archive , l , function(log2)
            {
                for ( i in log2 )
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
